"""Dependency-free boundary tests; live GNU Health is tested separately."""
import importlib.util
from pathlib import Path
import unittest
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal

spec = importlib.util.spec_from_file_location('encoding', Path(__file__).parents[1] / 'health_midnight_disclosure' / 'encoding.py')
encoding = importlib.util.module_from_spec(spec)
spec.loader.exec_module(encoding)


class EncodingTests(unittest.TestCase):
    def test_date_datetime_and_missing_date(self):
        self.assertEqual(encoding.unix_seconds(None), 0)
        expected = 1704067200
        self.assertEqual(encoding.unix_seconds(date(2024, 1, 1)), expected)
        self.assertEqual(encoding.unix_seconds(datetime(2024, 1, 1)), expected)
        self.assertEqual(encoding.unix_seconds(datetime(2024, 1, 1, 1, tzinfo=timezone(timedelta(hours=1)))), expected)

    def test_hash_is_exact_bytes32_and_unicode_is_deterministic(self):
        self.assertEqual(len(encoding.bytes32_hex('Synthetic vaccine')), 64)
        self.assertEqual(encoding.bytes32_hex('µ-test'), encoding.bytes32_hex('µ-test'))
        self.assertNotEqual(encoding.bytes32_hex('test-A'), encoding.bytes32_hex('test-B'))

    def test_decimal_lab_scaling_and_rounding(self):
        self.assertEqual(encoding.scaled_uint32(Decimal('10.7')), 107)
        self.assertEqual(encoding.scaled_uint32('1.25'), 13)
        self.assertEqual(encoding.scaled_uint32(0), 0)
        self.assertEqual(encoding.scaled_uint32('429496729.5'), 4294967295)

    def test_lab_scaling_rejects_negative_infinite_nan_and_overflow(self):
        for value in ['-0.1', 'NaN', 'Infinity', '-Infinity', '429496729.6']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                encoding.scaled_uint32(value)


if __name__ == '__main__':
    unittest.main()
