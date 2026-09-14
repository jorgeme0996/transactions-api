import * as fs from 'fs';
import { parse } from 'yaml';
import { RiskException, validateException } from '../domain/policy/Exception';

export function loadExceptions(filePath: string): RiskException[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown> | null;
  const list = raw?.exceptions;
  if (!Array.isArray(list)) return [];
  return list.map(validateException);
}
