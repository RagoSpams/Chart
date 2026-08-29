# SPDX-License-Identifier: GPL-3.0-or-later
#
# health_midnight_disclosure — Prompt 4: a minimal, narrow-scope Tryton
# module proving the real Tryton -> bridge -> Midnight path. Adds a single
# "Request Disclosure" button to the patient view, which pulls that
# patient's REAL vaccination / lab / critical-flags data from GNU Health's
# own database and POSTs it to the bridge service's /record-bundle
# endpoint (real deployed contract, real on-chain commitment) — no
# synthetic data. See PLAN.md "Prompt 4" for the full design and findings.

from trytond.pool import Pool
from . import patient


def register():
    Pool.register(
        patient.RequestDisclosureResult,
        module='health_midnight_disclosure', type_='model')
    Pool.register(
        patient.RequestDisclosure,
        module='health_midnight_disclosure', type_='wizard')
