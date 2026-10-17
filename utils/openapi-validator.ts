import fs from 'node:fs';
import path from 'node:path';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

type Json = any;

const spec: Json = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../aut/openapi.json'), 'utf8'));
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const cache = new Map<string, ValidateFunction>();

const resolveRef = (ref: string): Json =>
  ref
    .replace(/^#\//, '')
    .split('/')
    .reduce((node, key) => node[key.replace(/~1/g, '/').replace(/~0/g, '~')], spec);

/**
 * Validates a response body against the OpenAPI spec of the AUT (aut/openapi.json).
 * `pathTemplate` is the spec path, e.g. "/api/products/{id}".
 * Returns a list of readable violations; empty means the response matches the contract.
 */
export function openApiViolations(method: string, pathTemplate: string, status: number, body: unknown): string[] {
  const op = spec.paths?.[pathTemplate]?.[method.toLowerCase()];
  if (!op) return [`${method.toUpperCase()} ${pathTemplate} is not in the OpenAPI spec`];

  let response = op.responses?.[String(status)];
  if (!response) return [`Status ${status} is not documented for ${method.toUpperCase()} ${pathTemplate}`];
  if (response.$ref) response = resolveRef(response.$ref);

  const schema = response.content?.['application/json']?.schema;
  if (!schema)
    return body === undefined || body === '' || body === null
      ? []
      : ['Response documents no body, but one was returned'];

  const key = `${method}:${pathTemplate}:${status}`;
  let validateFn = cache.get(key);
  if (!validateFn) {
    // `components` rides along so "#/components/..." references inside the schema resolve.
    validateFn = ajv.compile({ allOf: [schema], components: spec.components });
    cache.set(key, validateFn);
  }
  if (validateFn(body)) return [];
  return (validateFn.errors ?? []).map((e) => `${e.instancePath || '(root)'} ${e.message}`);
}
