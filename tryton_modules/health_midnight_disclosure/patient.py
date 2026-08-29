# SPDX-License-Identifier: GPL-3.0-or-later
#
# "Request Disclosure" wizard — triggered as a form-action button on the
# patient view (see health_midnight_disclosure.xml), following the same
# ir.action.wizard + ir.action.keyword(form_action) pattern GNU Health's own
# health_imaging module uses for its "Generate Result" button. No user
# input needed: the single 'start' state does the real work (pull this
# patient's real data, POST it to the bridge) and transitions straight to a
# read-only result screen.
#
# Deliberately narrow scope (Prompt 4): submits ONE record bundle for the
# CURRENT patient using their real GNU Health data. Does not attempt
# disclosure-token issuance or verification from Tryton yet — that's a
# later step once this first real connection is proven.

import hashlib
import json
import urllib.error
import urllib.request
from datetime import timezone

from trytond.exceptions import UserError
from trytond.model import ModelView, fields
from trytond.pool import Pool
from trytond.transaction import Transaction
from trytond.wizard import StateTransition, StateView, Button, Wizard

# The bridge service runs on the WSL2 Ubuntu host, outside this container;
# trytond runs inside gnuhealth-spike. host.docker.internal was tried first
# (Docker Desktop's usual container->host route) but resolves to the
# Windows host's own network stack, not specifically into the WSL2 network
# namespace where the bridge is actually listening — confirmed empirically
# (DNS resolved, but connection was refused even with the bridge running).
# WSL2 Ubuntu's own eth0 address works instead (verified reachable via curl
# from inside this container before writing this fix). This address is
# assigned by WSL2 and can change across reboots — fine for this narrow-scope
# local proof, but worth a config option before this goes further.
BRIDGE_URL = 'http://192.168.204.19:4000'
HTTP_TIMEOUT_SECONDS = 120  # first call triggers real wallet sync + deploy


def bytes32_hex(label):
    """32-byte hex identifier from an arbitrary real-data string (e.g. a
    vaccine or lab-analyte name) — SHA-256 already produces exactly 32
    bytes, so no truncation/padding tricks are needed (unlike the bridge's
    own bytes32() helper, which left-pads short literal labels)."""
    return hashlib.sha256(label.encode('utf-8')).hexdigest()


def unix_seconds(dt):
    if dt is None:
        return 0
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp())


class RequestDisclosureResult(ModelView):
    'Request Disclosure Result'
    __name__ = 'health_midnight_disclosure.request_disclosure.result'

    record_id = fields.Char('Record ID', readonly=True)
    contract_address = fields.Char('Contract Address', readonly=True)
    vaccination_note = fields.Char('Vaccination Bundle', readonly=True)
    lab_result_note = fields.Char('Lab Result Bundle', readonly=True)
    critical_flags_note = fields.Char('Critical Flags Bundle', readonly=True)


class RequestDisclosure(Wizard):
    'Request Disclosure'
    __name__ = 'health_midnight_disclosure.request_disclosure'

    start = StateTransition()
    result = StateView(
        'health_midnight_disclosure.request_disclosure.result',
        'health_midnight_disclosure.request_disclosure_result_view_form', [
            Button('Close', 'end', 'tryton-close', True),
        ])

    def transition_start(self):
        pool = Pool()
        Patient = pool.get('gnuhealth.patient')
        patient = Patient(Transaction().context.get('active_id'))

        vaccination_payload, vaccination_note = self._vaccination_bundle(patient)
        lab_payload, lab_note = self._lab_result_bundle(patient)
        critical_flags_payload = self._critical_flags_bundle(patient)

        body = {
            'vaccination': vaccination_payload,
            'labResult': lab_payload,
            'criticalFlags': critical_flags_payload,
        }
        response = self._post_bridge('/record-bundle', body)

        self.result.record_id = response['recordId']
        self.result.contract_address = response['contractAddress']
        self.result.vaccination_note = vaccination_note
        self.result.lab_result_note = lab_note
        self.result.critical_flags_note = (
            'Submitted this patient\'s real crit_* flags from gnuhealth.patient.')
        return 'result'

    def default_result(self, fields_names):
        return {
            'record_id': self.result.record_id,
            'contract_address': self.result.contract_address,
            'vaccination_note': self.result.vaccination_note,
            'lab_result_note': self.result.lab_result_note,
            'critical_flags_note': self.result.critical_flags_note,
        }

    @staticmethod
    def _vaccination_bundle(patient):
        pool = Pool()
        Vaccination = pool.get('gnuhealth.vaccination')
        records = Vaccination.search(
            [('patient', '=', patient.id)], order=[('date', 'DESC')], limit=1)
        if not records:
            # Real absence of data, encoded honestly rather than faked —
            # see PLAN.md Prompt 4 findings: not every demo patient has
            # vaccination records (only patient id=2 does in this dataset).
            return {
                'vaccineId': bytes32_hex('NO_VACCINATION_ON_FILE'),
                'dose': 0,
                'administeredDate': 0,
                'hasNextDose': False,
                'nextDoseDate': 0,
                'completed': False,
            }, 'No vaccination record found for this patient — submitted an explicit "not on file" placeholder.'
        vaccination = records[0]
        payload = {
            'vaccineId': bytes32_hex(vaccination.vaccine.rec_name),
            'dose': vaccination.dose or 0,
            'administeredDate': unix_seconds(vaccination.date),
            'hasNextDose': vaccination.next_dose_date is not None,
            'nextDoseDate': unix_seconds(vaccination.next_dose_date),
            'completed': vaccination.state == 'done',
        }
        return payload, 'Real vaccination: %s (dose %s, %s) from gnuhealth.vaccination id=%s.' % (
            vaccination.vaccine.rec_name, vaccination.dose, vaccination.state, vaccination.id)

    @staticmethod
    def _lab_result_bundle(patient):
        pool = Pool()
        Lab = pool.get('gnuhealth.lab')
        Critearea = pool.get('gnuhealth.lab.test.critearea')

        labs = Lab.search(
            [('patient', '=', patient.id), ('state', '=', 'validated')],
            order=[('date_analysis', 'DESC')], limit=1)
        if labs:
            lab = labs[0]
            analytes = Critearea.search([
                ('gnuhealth_lab_id', '=', lab.id),
                ('result', '!=', None),
                ('lower_limit', '!=', None),
                ('upper_limit', '!=', None),
            ], limit=1)
            if analytes:
                analyte = analytes[0]
                # Compact's Uint<32> is integer-only — real lab values here
                # carry one decimal place (e.g. HGB 10.7), so scale by 10
                # rather than truncate (same offset-scale technique the
                # prior Assay project used for temperature readings).
                payload = {
                    'testTypeId': bytes32_hex(analyte.name),
                    'resultValue': round(analyte.result * 10),
                    'rangeLow': round(analyte.lower_limit * 10),
                    'rangeHigh': round(analyte.upper_limit * 10),
                    'analysisDate': unix_seconds(lab.date_analysis),
                }
                note = (
                    'Real lab result: %s = %s (range %s-%s) from gnuhealth.lab id=%s, '
                    'test %s (values x10-scaled for Compact\'s integer-only Uint<32>).'
                    % (analyte.name, analyte.result, analyte.lower_limit,
                       analyte.upper_limit, lab.id, lab.test.rec_name))
                return payload, note
        # No validated lab (or no analyte with a real numeric result/range)
        # for this patient — same honest-placeholder treatment as vaccination.
        return {
            'testTypeId': bytes32_hex('NO_VALIDATED_LAB_ON_FILE'),
            'resultValue': 0,
            'rangeLow': 0,
            'rangeHigh': 0,
            'analysisDate': 0,
        }, 'No validated lab result found for this patient — submitted an explicit "not on file" placeholder.'

    @staticmethod
    def _critical_flags_bundle(patient):
        # Direct, always-available real data — every patient has these
        # fields (possibly all NULL/false), so no placeholder is ever
        # needed here.
        return {
            'critDbt': bool(patient.crit_dbt),
            'critCardio': bool(patient.crit_cardio),
            'critAllergic': bool(patient.crit_allergic),
            'critCancer': bool(patient.crit_cancer),
            'critImmuno': bool(patient.crit_immuno),
            'critMental': bool(patient.crit_mental),
            'critNutrition': bool(patient.crit_nutrition),
            'critSocial': bool(patient.crit_social),
            'critCognitive': bool(patient.crit_cognitive),
        }

    @staticmethod
    def _post_bridge(path, body):
        data = json.dumps(body).encode('utf-8')
        request = urllib.request.Request(
            BRIDGE_URL + path, data=data, method='POST',
            headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except urllib.error.HTTPError as err:
            detail = err.read().decode('utf-8', errors='replace')
            raise UserError(
                'Bridge request failed',
                'POST %s returned HTTP %s:\n%s' % (path, err.code, detail))
        except urllib.error.URLError as err:
            raise UserError(
                'Could not reach the bridge service',
                'POST %s failed: %s\n\nIs the bridge running (npm run dev:bridge)?'
                % (path, err.reason))
