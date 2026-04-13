/**
 * API registry (.api.json) — see project TDD §6.1.
 */

export type ServiceLifecycleStatus = 'stable' | 'deprecated' | 'experimental';

export type HttpMethod =
    | 'GET'
    | 'POST'
    | 'PUT'
    | 'PATCH'
    | 'DELETE'
    | 'HEAD'
    | 'OPTIONS';

/** One catalog endpoint after load (includes derived match fields). */
export interface LoadedRegistryEndpoint {
    id: string;
    method: HttpMethod;
    /** Path relative to service base_path (starts with `/`). */
    path: string;
    slaMs?: number;
    pathRegex: RegExp;
    /** Higher means more literal path segments (TDD §5.2.2). */
    specificity: number;
}

export interface LoadedRegistryService {
    id: string;
    team: string;
    base_path: string;
    openapi_url?: string;
    status: ServiceLifecycleStatus;
    endpoints: LoadedRegistryEndpoint[];
}

export interface Registry {
    version: '1.0';
    environments: Record<string, string>;
    services: LoadedRegistryService[];
}

/** Annotation attached to exchanges when matched against the registry (TDD §5.2). */
export interface RegistryEndpointAnnotation {
    serviceId: string | null;
    endpointId: string | null;
    serviceName: string | null;
    teamName: string | null;
}

export interface CoverageEntry {
    endpointId: string;
    serviceId: string;
    status: 'covered' | 'uncovered' | 'deprecated';
    scenarioCount: number;
    approvedCount: number;
}
