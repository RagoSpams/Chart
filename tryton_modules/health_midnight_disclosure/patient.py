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

import json
import os
import urllib.error
import urllib.request
from .encoding import bytes32_hex, unix_seconds, scaled_uint32

from trytond.exceptions import UserError
from trytond.model import ModelView, fields
from trytond.pool import Pool
from trytond.transaction import Transaction
from trytond.wizard import StateTransition, StateView, Button, Wizard

# Default to loopback. Set CHART_BRIDGE_URL explicitly when Tryton runs in
# another container/namespace; never hard-code a developer's WSL2 address.
BRIDGE_URL = os.environ.get('CHART_BRIDGE_URL', 'http://127.0.0.1:4000').rstrip('/')
HTTP_TIMEOUT_SECONDS = 600  # first call triggers real wallet sync + deploy




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
        if os.environ.get('CHART_SYNTHETIC_ONLY') != 'true':
            raise UserError('Synthetic demo only', 'Set CHART_SYNTHETIC_ONLY=true only on a database containing fictional patients.')
        if not Transaction().context.get('active_id') or Transaction().context.get('active_model') != 'gnuhealth.patient':
            raise UserError('Select a patient', 'Run this wizard from a synthetic patient record.')
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
                    'resultValue': scaled_uint32(analyte.result),
                    'rangeLow': scaled_uint32(analyte.lower_limit),
                    'rangeHigh': scaled_uint32(analyte.upper_limit),
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
            headers={'Content-Type': 'application/json',
                     'Authorization': 'Bearer ' + os.environ.get('CHART_BRIDGE_API_KEY', '')})
        try:
            with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except urllib.error.HTTPError as err:
            raise UserError(
                'Bridge request failed',
                'POST %s returned HTTP %s' % (path, err.code))
        except urllib.error.URLError as err:
            raise UserError(
                'Could not reach the bridge service',
                'POST %s failed: %s\n\nIs the bridge running (npm run dev:bridge)?'
                % (path, err.reason))
