"""Actual Tryton model/session checks with a stub HTTP boundary.

The separate devnet-e2e test uses a real HTTP bridge and real proofs.
"""
import os
from pathlib import Path
import unittest
from unittest.mock import patch
from uuid import uuid4

from trytond.config import config
config.update_etc(str(Path('.validation/trytond.conf').resolve()))
from urllib.parse import urlparse
uri = urlparse(config.get('database', 'uri'))
if (uri.hostname, uri.port, uri.username) != ('127.0.0.1', 55432, 'chart_synthetic'):
    raise RuntimeError('Only the dedicated synthetic database is allowed')

from trytond.pool import Pool
from trytond.transaction import Transaction
from trytond.exceptions import UserError

pool = Pool('chart_synthetic')
pool.init()


class WizardTests(unittest.TestCase):
    def setUp(self):
        self.tx = Transaction().start('chart_synthetic', 0, context={'language': 'en'})
        self.tx.__enter__()
        self.Wizard = pool.get('health_midnight_disclosure.request_disclosure', type='wizard')
        patients = pool.get('gnuhealth.patient').search([], limit=1)
        if not patients:
            self.fail('Seed the dedicated synthetic database first')
        self.context = {'active_id': patients[0].id, 'active_ids': [patients[0].id], 'active_model': 'gnuhealth.patient'}
        self.session, _, _ = self.Wizard.create()

    def tearDown(self):
        self.tx.rollback()
        self.tx.__exit__(None, None, None)

    def test_synthetic_acknowledgement_is_required(self):
        with self.tx.set_context(**self.context), patch.dict(os.environ, {'CHART_SYNTHETIC_ONLY': 'false'}), patch.object(self.Wizard, '_post_bridge') as post:
            with self.assertRaises(UserError):
                self.Wizard.execute(self.session, {}, 'start')
            post.assert_not_called()

    def test_patient_context_is_required(self):
        with patch.dict(os.environ, {'CHART_SYNTHETIC_ONLY': 'true'}), patch.object(self.Wizard, '_post_bridge') as post:
            with self.assertRaises(UserError):
                self.Wizard.execute(self.session, {}, 'start')
            post.assert_not_called()

    def test_result_view_and_session_execute_with_stub_http(self):
        response = {'recordId': 'ab' * 32, 'contractAddress': 'cd' * 32}
        with self.tx.set_context(**self.context), patch.dict(os.environ, {'CHART_SYNTHETIC_ONLY': 'true'}), patch.object(self.Wizard, '_post_bridge', return_value=response) as post:
            result = self.Wizard.execute(self.session, {}, 'start')
            self.assertEqual(result['view']['state'], 'result')
            self.assertEqual(result['view']['defaults']['record_id'], response['recordId'])
            self.assertEqual(post.call_args.args[0], '/record-bundle')
            self.assertEqual(post.call_args.args[1]['labResult']['resultValue'], 107)

    def test_user_without_health_groups_cannot_execute_patient_wizard(self):
        user, = pool.get('res.user').create([{'name': 'FICTIONAL unauthorized', 'login': 'synthetic-' + uuid4().hex}])
        with self.tx.set_user(user.id), self.tx.set_context(**self.context), patch.dict(os.environ, {'CHART_SYNTHETIC_ONLY': 'true'}), patch.object(self.Wizard, '_post_bridge') as post:
            session, _, _ = self.Wizard.create()
            with self.assertRaises(UserError):
                self.Wizard.execute(session, {}, 'start')
            post.assert_not_called()


if __name__ == '__main__':
    unittest.main(verbosity=2)
