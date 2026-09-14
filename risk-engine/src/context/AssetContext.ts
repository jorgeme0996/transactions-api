export type BusinessCriticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AssetContext {
  name: string;
  businessCriticality: BusinessCriticality;
  environment: {
    name: string;
    production: boolean;
    internetExposed: boolean;
  };
  authentication: {
    required: boolean;
  };
  dataClassification: {
    pii: boolean;
    financial: boolean;
    credentials: boolean;
  };
  compliance: {
    pciDss: boolean;
    soc2: boolean;
  };
  existingControls: string[];
}

export function hasSensitiveData(context: AssetContext): boolean {
  return context.dataClassification.pii || context.dataClassification.financial || context.dataClassification.credentials;
}
