"""Seed a dedicated GNU Health database and execute the registered wizard.

Never point this helper at an existing clinical database. It refuses any
database name or URI outside the dedicated local synthetic test service.
"""
import json
import os
from pathlib import Path
from datetime import datetime, timezone
from uuid import uuid4

if os.environ.get('CHART_SYNTHETIC_ONLY') != 'true':
    raise RuntimeError('CHART_SYNTHETIC_ONLY=true is required')

from trytond.config import config
config.update_etc(str(Path('.validation/trytond.conf').resolve()))
from urllib.parse import urlparse
uri = urlparse(config.get('database', 'uri'))
if uri.hostname != '127.0.0.1' or uri.port != 55432 or uri.username != 'chart_synthetic':
    raise RuntimeError('Refusing a database outside the local synthetic service')

from trytond.pool import Pool
from trytond.transaction import Transaction

database = 'chart_synthetic'
pool = Pool(database)
pool.init()
suffix = uuid4().hex[:12]
with Transaction().start(database, 0, context={'language': 'en'}) as transaction:
    Party = pool.get('party.party')
    Patient = pool.get('gnuhealth.patient')
    Template = pool.get('product.template')
    Product = pool.get('product.product')
    Uom = pool.get('product.uom')
    Medicament = pool.get('gnuhealth.medicament')
    Vaccination = pool.get('gnuhealth.vaccination')
    LabType = pool.get('gnuhealth.lab.test_type')
    Lab = pool.get('gnuhealth.lab')
    Analyte = pool.get('gnuhealth.lab.test.critearea')
    party, = Party.create([{'name': 'FICTIONAL CHART TEST ' + suffix, 'is_person': True, 'is_patient': True, 'gender': 'f', 'fed_country': 'XXX'}])
    patient, = Patient.create([{'party': party.id, 'crit_allergic': True}])
    unit, = Uom.search([('symbol', '=', 'u')], limit=1)
    template, = Template.create([{'name': 'SYNTHETIC Vaccine ' + suffix, 'type': 'goods', 'default_uom': unit.id}])
    product, = Product.create([{'template': template.id, 'is_medicament': True, 'is_vaccine': True}])
    vaccine, = Medicament.create([{'product': product.id, 'is_vaccine': True}])
    clinician_party, = Party.create([{'name': 'FICTIONAL TEST CLINICIAN ' + suffix, 'is_person': True, 'is_healthprof': True, 'gender': 'f', 'fed_country': 'XXX'}])
    clinician, = pool.get('gnuhealth.healthprofessional').create([{'party': clinician_party.id}])
    now = datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)
    Vaccination.create([{'patient': patient.id, 'vaccine': vaccine.id, 'dose': 2, 'date': now, 'state': 'done', 'healthprof': clinician.id, 'signed_by': clinician.id}])
    lab_template, = Template.create([{'name': 'SYNTHETIC Lab ' + suffix, 'type': 'service', 'default_uom': unit.id}])
    lab_product, = Product.create([{'template': lab_template.id}])
    lab_type, = LabType.create([{'name': 'SYNTHETIC Test ' + suffix, 'code': suffix, 'product_id': lab_product.id}])
    lab, = Lab.create([{'name': 'SYNTHETIC-' + suffix, 'test': lab_type.id, 'patient': patient.id, 'source_type': 'patient', 'date_requested': now, 'date_analysis': now, 'state': 'validated', 'pathologist': clinician.id, 'requestor': clinician.id, 'done_by': clinician.id, 'validated_by': clinician.id}])
    Analyte.create([{'name': 'SYNTHETIC HGB', 'gnuhealth_lab_id': lab.id, 'test_type_id': lab_type.id, 'result': 10.7, 'lower_limit': 10.0, 'upper_limit': 15.0}])
    patient_id = patient.id
    transaction.commit()

if os.environ.get('CHART_SEED_ONLY') == 'true':
    print('Synthetic GNU Health fixtures persisted: PASS')
    raise SystemExit(0)

# A new transaction reads persisted models, rather than cached fixture values.
with Transaction().start(database, 0, context={'active_id': patient_id, 'active_ids': [patient_id], 'active_model': 'gnuhealth.patient', 'language': 'en'}) as transaction:
    Wizard = pool.get('health_midnight_disclosure.request_disclosure', type='wizard')
    session_id, _, _ = Wizard.create()
    wizard = Wizard(session_id)
    # Capture the real HTTP response for verifier handoff; the production
    # wizard intentionally displays only the identifiers in its result view.
    original = Wizard._post_bridge
    captured = {}
    def capture(path, body):
        response = original(path, body)
        captured.update(response)
        return response
    wizard._post_bridge = capture
    assert wizard.transition_start() == 'result'
    assert wizard.result.record_id == captured['recordId']
    # Validate extraction against the expected scaled value, not a default.
    assert captured['bundle']['labResult']['resultValue'] == '107'
    assert captured['bundle']['criticalFlags']['critAllergic'] is True
    assert captured['bundle']['vaccination']['completed'] is True
    Path(os.environ['CHART_SYNTHETIC_OUTPUT']).write_text(json.dumps(captured))
    transaction.commit()
print('Persisted fictional GNU Health patient -> registered wizard -> authenticated bridge: PASS')
