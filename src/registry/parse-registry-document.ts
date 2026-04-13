import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import type { ValidateFunction } from 'ajv';

import type {
    HttpMethod,
    LoadedRegistryEndpoint,
    LoadedRegistryService,
    Registry
} from './types';
import {
    compilePathTemplateToRegex,
    joinBasePathAndPath,
    pathSpecificity
} from './path-regex';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const rootSchema = require('../../schemas/api-registry-1.0.json') as Record<string, unknown>;

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(rootSchema, rootSchema.$id as string);

const validateEndpoint = ajv.getSchema(
    `${rootSchema.$id as string}#/$defs/endpoint`
) as ValidateFunction | undefined;

const HTTP_METHODS = new Set<string>([
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'HEAD',
    'OPTIONS'
]);

const SERVICE_STATUS = new Set(['stable', 'deprecated', 'experimental']);

export interface ParseRegistryResult {
    registry: Registry;
    warnings: string[];
}

function warn(warnings: string[], message: string) {
    warnings.push(message);
    console.warn(`[RegistryLoader] ${message}`);
}

function isNonEmptyString(v: unknown): v is string {
    return typeof v === 'string' && v.length > 0;
}

function isValidServiceId(v: unknown): boolean {
    return isNonEmptyString(v) && !/\s/.test(v);
}

function validateServiceShell(raw: unknown, warnings: string[], index: number): raw is {
    id: string;
    team: string;
    base_path: string;
    status: LoadedRegistryService['status'];
    endpoints: unknown[];
} {
    if (!raw || typeof raw !== 'object') {
        warn(warnings, `Service index ${index} skipped: not an object`);
        return false;
    }
    const s = raw as Record<string, unknown>;
    if (!isValidServiceId(s.id)) {
        warn(warnings, `Service index ${index} skipped: invalid id`);
        return false;
    }
    if (!isNonEmptyString(s.team)) {
        warn(warnings, `Service ${s.id}: skipped — invalid team`);
        return false;
    }
    if (!isNonEmptyString(s.base_path) || !s.base_path.startsWith('/')) {
        warn(warnings, `Service ${s.id}: skipped — invalid base_path`);
        return false;
    }
    if (!isNonEmptyString(s.status) || !SERVICE_STATUS.has(s.status as string)) {
        warn(warnings, `Service ${s.id}: skipped — invalid status`);
        return false;
    }
    if (!Array.isArray(s.endpoints)) {
        warn(warnings, `Service ${s.id}: skipped — endpoints must be an array`);
        return false;
    }
    return true;
}

/**
 * Parse and validate `.api.json` text. Invalid services/endpoints are skipped (TDD §5.1.2).
 */
export function parseRegistryDocument(json: string, context = 'registry'): ParseRegistryResult {
    const warnings: string[] = [];
    let data: unknown;
    try {
        data = JSON.parse(json);
    } catch (e) {
        throw new Error(`${context}: invalid JSON (${(e as Error).message})`);
    }

    if (!data || typeof data !== 'object') {
        throw new Error(`${context}: root must be a JSON object`);
    }

    const doc = data as Record<string, unknown>;

    if (doc.version !== '1.0') {
        throw new Error(`${context}: version must be "1.0"`);
    }

    if (!doc.environments || typeof doc.environments !== 'object' || Array.isArray(doc.environments)) {
        throw new Error(`${context}: environments must be an object`);
    }

    const environments = doc.environments as Record<string, unknown>;
    const envKeys = Object.keys(environments);
    if (envKeys.length === 0) {
        throw new Error(`${context}: environments must have at least one key`);
    }
    const cleanEnvironments: Record<string, string> = {};
    for (const k of envKeys) {
        const v = environments[k];
        if (!isNonEmptyString(v)) {
            throw new Error(`${context}: environment "${k}" must be a non-empty string`);
        }
        cleanEnvironments[k] = v;
    }

    if (!Array.isArray(doc.services)) {
        throw new Error(`${context}: services must be an array`);
    }
    if (doc.services.length === 0) {
        throw new Error(`${context}: services must contain at least one service`);
    }

    const services: LoadedRegistryService[] = [];

    doc.services.forEach((rawService, si) => {
        if (!validateServiceShell(rawService, warnings, si)) return;

        const svc = rawService as {
            id: string;
            team: string;
            base_path: string;
            status: LoadedRegistryService['status'];
            endpoints: unknown[];
        };

        let openapi_url: string | undefined;
        const ou = (rawService as Record<string, unknown>).openapi_url;
        if (typeof ou === 'string' && ou.length > 0) {
            try {
                // eslint-disable-next-line no-new
                new URL(ou);
                openapi_url = ou;
            } catch {
                warn(warnings, `Service ${svc.id}: ignoring invalid openapi_url`);
            }
        }

        const endpointById = new Map<string, LoadedRegistryEndpoint>();
        const dupWarnings = new Set<string>();

        svc.endpoints.forEach((rawEp, ei) => {
            if (!validateEndpoint?.(rawEp)) {
                warn(
                    warnings,
                    `Service ${svc.id} endpoint index ${ei} skipped: ${validateEndpoint?.errors
                        ?.map((e) => `${e.instancePath} ${e.message}`)
                        .join('; ') ?? 'invalid'}`
                );
                return;
            }

            const ep = rawEp as {
                id: string;
                method: string;
                path: string;
                sla_ms?: number;
            };

            if (!HTTP_METHODS.has(ep.method)) {
                warn(warnings, `Service ${svc.id} endpoint ${ep.id}: unknown method ${ep.method}, skipped`);
                return;
            }

            const method = ep.method as HttpMethod;
            const fullTemplate = joinBasePathAndPath(svc.base_path, ep.path);

            let pathRegex: RegExp;
            try {
                pathRegex = compilePathTemplateToRegex(fullTemplate);
            } catch (e) {
                warn(
                    warnings,
                    `Service ${svc.id} endpoint ${ep.id}: could not compile path (${(e as Error).message}), skipped`
                );
                return;
            }

            const specificity = pathSpecificity(fullTemplate);
            const loaded: LoadedRegistryEndpoint = {
                id: ep.id,
                method,
                path: ep.path,
                pathRegex,
                specificity,
                ...(ep.sla_ms !== undefined ? { slaMs: ep.sla_ms } : {})
            };

            if (endpointById.has(ep.id) && !dupWarnings.has(ep.id)) {
                dupWarnings.add(ep.id);
                warn(warnings, `Duplicate endpoint ID "${ep.id}" in service "${svc.id}" — using last definition`);
            }
            endpointById.set(ep.id, loaded);
        });

        services.push({
            id: svc.id,
            team: svc.team,
            base_path: svc.base_path,
            status: svc.status,
            endpoints: Array.from(endpointById.values()),
            ...(openapi_url ? { openapi_url } : {})
        });
    });

    if (services.length === 0) {
        throw new Error(`${context}: no valid services could be loaded`);
    }

    return {
        registry: {
            version: '1.0',
            environments: cleanEnvironments,
            services
        },
        warnings
    };
}
