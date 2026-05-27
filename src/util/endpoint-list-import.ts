import type { OpenAPIObject } from 'openapi-directory';

/** Version string for files produced by the list-project-endpoints Cursor skill. */
export const HTTPTOOLKIT_ENDPOINTS_VERSION = '1';

/** Optional static response used to create mock rules on save (see buildMockRulesFromEndpointList). */
export interface HttptoolkitEndpointResponse {
    status?: number;
    statusMessage?: string;
    headers?: Record<string, string>;
    /** Raw body (UTF-8). Ignored if `json` is set. */
    body?: string;
    /** If set, body is JSON (string values are sent as-is). Default Content-Type is application/json. */
    json?: unknown;
}

export interface HttptoolkitEndpointEntry {
    method: string;
    path: string;
    summary?: string;
    response?: HttptoolkitEndpointResponse;
}

export interface HttptoolkitEndpointsFile {
    httptoolkitEndpoints: typeof HTTPTOOLKIT_ENDPOINTS_VERSION | number;
    title?: string;
    version?: string;
    baseUrl: string;
    endpoints: HttptoolkitEndpointEntry[];
}

const OPENAPI_METHODS = new Set([
    'get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'
]);

function isNonEmptyString(v: unknown): v is string {
    return typeof v === 'string' && v.trim().length > 0;
}

export function isHttptoolkitEndpointsFile(content: unknown): content is HttptoolkitEndpointsFile {
    if (!content || typeof content !== 'object') return false;
    const o = content as Record<string, unknown>;
    const ver = o.httptoolkitEndpoints;
    if (ver !== '1' && ver !== 1) return false;
    if (!isNonEmptyString(o.baseUrl)) return false;
    if (!Array.isArray(o.endpoints) || o.endpoints.length === 0) return false;
    return true;
}

export function joinBaseUrlAndPath(baseUrl: string, path: string): string {
    const base = baseUrl.trim().replace(/\/+$/, '');
    const p = path.trim().startsWith('/') ? path.trim() : `/${path.trim()}`;
    return base + p;
}

export function endpointListHasMockResponses(data: HttptoolkitEndpointsFile): boolean {
    return data.endpoints.some((e) => e.response != null && typeof e.response === 'object');
}

/**
 * Turn a Cursor skill / hand-authored endpoint list into a minimal OpenAPI 3.0 spec
 * so it can use the same pipeline as uploaded OpenAPI files.
 */
export function endpointListFileToOpenApi(data: HttptoolkitEndpointsFile): OpenAPIObject {
    if (!data.endpoints.length) {
        throw new Error('Endpoint list file must contain at least one endpoint');
    }

    const paths: OpenAPIObject['paths'] = {};

    for (const raw of data.endpoints) {
        if (!raw || typeof raw !== 'object') {
            throw new Error('Each endpoint must be an object with method and path');
        }
        if (!isNonEmptyString(raw.path)) {
            throw new Error('Each endpoint needs a non-empty path');
        }
        const path = raw.path.startsWith('/') ? raw.path : `/${raw.path}`;
        if (!isNonEmptyString(raw.method)) {
            throw new Error(`Missing HTTP method for path ${path}`);
        }
        const method = raw.method.trim().toLowerCase();
        if (!OPENAPI_METHODS.has(method)) {
            throw new Error(`Unsupported method "${raw.method}" for ${path}`);
        }

        if (!paths[path]) paths[path] = {};
        const pathItem = paths[path] as Record<string, object>;

        const res = raw.response;
        let responses: Record<string, { description: string; content?: Record<string, { schema: { type: string } }> }>;
        if (res && typeof res === 'object') {
            const st = res.status;
            const statusCode = typeof st === 'number' && Number.isInteger(st) && st >= 100 && st <= 999
                ? st
                : 200;
            const desc = (typeof res.statusMessage === 'string' && res.statusMessage.trim())
                ? res.statusMessage.trim()
                : 'Mocked response';
            responses = {
                [String(statusCode)]: {
                    description: desc,
                    ...(res.json !== undefined
                        ? { content: { 'application/json': { schema: { type: 'object' } } } }
                        : {})
                }
            };
        } else {
            responses = {
                default: { description: 'Undocumented response' }
            };
        }

        pathItem[method] = {
            summary: raw.summary?.trim() || `${method.toUpperCase()} ${path}`,
            responses
        };
    }

    let serverUrl = data.baseUrl.trim();
    if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
        serverUrl = `https://${serverUrl}`;
    }

    return {
        openapi: '3.0.3',
        info: {
            title: data.title?.trim() || 'Imported endpoints',
            version: data.version?.trim() || '1.0.0'
        },
        servers: [{ url: serverUrl }],
        paths
    } as OpenAPIObject;
}
