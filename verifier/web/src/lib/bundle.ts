import type { CriticalFlagsBundle, LabResultBundle, VaccinationBundle } from './api.js';

export interface ParsedBundle {
  vaccination?: VaccinationBundle;
  vaccinationSalt?: string;
  labResult?: LabResultBundle;
  labResultSalt?: string;
  criticalFlags?: CriticalFlagsBundle;
  criticalFlagsSalt?: string;
}

// Validate before rendering any nested field, not just when sending a request.
export function parseBundleJson(text: string): ParsedBundle {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a bundle object');
  const bundle = value as Record<string, unknown>;
  for (const name of ['vaccination', 'labResult', 'criticalFlags']) {
    if (bundle[name] === undefined) continue;
    const data = bundle[name];
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`Invalid ${name} bundle`);
    const fields = data as Record<string, unknown>;
    const identifier = name === 'vaccination' ? 'vaccineId' : name === 'labResult' ? 'testTypeId' : null;
    if (identifier && (typeof fields[identifier] !== 'string' || !/^(0x)?[a-f0-9]{64}$/i.test(fields[identifier]))) throw new Error(`Invalid ${identifier}`);
    const salt = bundle[name + 'Salt'];
    if (typeof salt !== 'string' || !/^(0x)?[a-f0-9]{64}$/i.test(salt)) throw new Error(`Invalid ${name} salt`);
  }
  return bundle as ParsedBundle;
}
