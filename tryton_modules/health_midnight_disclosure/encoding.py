# SPDX-License-Identifier: GPL-3.0-or-later

import hashlib
from datetime import date, datetime, time, timezone
from decimal import Decimal, ROUND_HALF_UP

def bytes32_hex(label):
    """32-byte hex identifier from an arbitrary real-data string (e.g. a
    vaccine or lab-analyte name) — SHA-256 already produces exactly 32
    bytes, so no truncation/padding tricks are needed (unlike the bridge's
    own bytes32() helper, which left-pads short literal labels)."""
    return hashlib.sha256(label.encode('utf-8')).hexdigest()


def unix_seconds(dt):
    if dt is None:
        return 0
    if isinstance(dt, date) and not isinstance(dt, datetime):
        dt = datetime.combine(dt, time.min, timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp())


def scaled_uint32(value):
    number = Decimal(str(value)) * 10
    if not number.is_finite() or number < 0 or number > 4294967295:
        raise ValueError('Expected a non-negative finite value representable at x10 scale')
    return int(number.quantize(Decimal('1'), rounding=ROUND_HALF_UP))
