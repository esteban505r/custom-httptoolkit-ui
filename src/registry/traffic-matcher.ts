import type {
    LoadedRegistryEndpoint,
    LoadedRegistryService,
    Registry,
    RegistryEndpointAnnotation
} from './types';

export interface MatchContext {
    registry: Registry | null;
    method: string;
    /** URL pathname (leading `/`, no query). */
    pathname: string;
}

/**
 * Match a single request to the best registry endpoint (TDD §5.2).
 */
export function matchRegistryTraffic(ctx: MatchContext): RegistryEndpointAnnotation {
    const empty: RegistryEndpointAnnotation = {
        serviceId: null,
        endpointId: null,
        serviceName: null,
        teamName: null
    };

    if (!ctx.registry || !ctx.pathname) {
        return empty;
    }

    const method = ctx.method.toUpperCase();
    const pathname = ctx.pathname.replace(/\/+$/, '') || '/';

    type Cand = {
        service: LoadedRegistryService;
        endpoint: LoadedRegistryEndpoint;
    };

    const candidates: Array<Cand & { order: number }> = [];
    let order = 0;

    for (const service of ctx.registry.services) {
        for (const endpoint of service.endpoints) {
            if (endpoint.method !== method) continue;
            if (!endpoint.pathRegex.test(pathname)) continue;
            candidates.push({ service, endpoint, order: order++ });
        }
    }

    if (candidates.length === 0) {
        return empty;
    }

    candidates.sort((a, b) => {
        const d = b.endpoint.specificity - a.endpoint.specificity;
        if (d !== 0) return d;
        return a.order - b.order;
    });
    const best = candidates[0];

    return {
        serviceId: best.service.id,
        endpointId: best.endpoint.id,
        serviceName: best.service.id,
        teamName: best.service.team
    };
}
