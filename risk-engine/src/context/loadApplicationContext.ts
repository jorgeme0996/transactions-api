import * as fs from 'fs';
import { parse } from 'yaml';
import { AssetContext, BusinessCriticality } from './AssetContext';

export class ApplicationContextError extends Error {}

const VALID_CRITICALITY: BusinessCriticality[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/**
 * Loads and validates readme.md section 7's application.yml. Never trusts the raw
 * YAML shape directly (readme.md section 25: "Validar YAML/JSON").
 */
export function loadApplicationContext(filePath: string): AssetContext {
  let raw: unknown;
  try {
    raw = parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new ApplicationContextError(`Failed to parse ${filePath}: ${(err as Error).message}`);
  }

  const app = (raw as Record<string, unknown>)?.application as Record<string, unknown> | undefined;
  if (!app || typeof app.name !== 'string') {
    throw new ApplicationContextError(`${filePath}: missing required "application.name"`);
  }

  const criticality = String(app.business_criticality ?? '').toUpperCase();
  if (!VALID_CRITICALITY.includes(criticality as BusinessCriticality)) {
    throw new ApplicationContextError(
      `${filePath}: application.business_criticality must be one of ${VALID_CRITICALITY.join(', ')}`,
    );
  }

  const environments = (app.environments ?? {}) as Record<string, Record<string, unknown>>;
  const envName = Object.keys(environments)[0] ?? 'unknown';
  const env = environments[envName] ?? {};

  const dataClassification = (app.data_classification ?? {}) as Record<string, unknown>;
  const compliance = (app.compliance ?? {}) as Record<string, unknown>;
  const authentication = (app.authentication ?? {}) as Record<string, unknown>;

  return {
    name: app.name,
    businessCriticality: criticality as BusinessCriticality,
    environment: {
      name: envName,
      production: Boolean(env.production ?? envName === 'production'),
      internetExposed: Boolean(env.internet_exposed),
    },
    authentication: {
      required: authentication.required !== false,
    },
    dataClassification: {
      pii: Boolean(dataClassification.pii),
      financial: Boolean(dataClassification.financial),
      credentials: Boolean(dataClassification.credentials),
    },
    compliance: {
      pciDss: Boolean(compliance.pci_dss),
      soc2: Boolean(compliance.soc2),
    },
    existingControls: Array.isArray(app.existing_controls)
      ? app.existing_controls.filter((c): c is string => typeof c === 'string')
      : [],
  };
}
