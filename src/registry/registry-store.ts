import { action, computed, observable, runInAction } from 'mobx';

import type { HttpExchange } from '../model/http/http-exchange';
import { matchRegistryTraffic } from './traffic-matcher';
import { RegistryLoader, type ReadFileFn } from './registry-loader';
import type { CoverageEntry, Registry, RegistryEndpointAnnotation } from './types';

/**
 * MobX store for API registry — TDD §7.1.
 */
export class RegistryStore {
    /** Satisfies app bootstrap `Promise.all(stores.map(s => s.initialized))`. */
    readonly initialized: Promise<void> = Promise.resolve();

    @observable
    registry: Registry | null = null;

    /** Aligns with TDD naming (`idle` | `loading` | `loaded` | `error`). */
    @observable
    registryStatus: 'idle' | 'loading' | 'loaded' | 'error' = 'idle';

    @observable
    registryLoadError: string | null = null;

    /** Last source passed to `loadRegistry` (URL, path, or inline JSON). */
    @observable
    lastLoadedSource: string | null = null;

    private readonly loader: RegistryLoader;

    private hotReloadTimer: ReturnType<typeof setInterval> | null = null;

    constructor(options?: { readFile?: ReadFileFn }) {
        this.loader = new RegistryLoader(options);
    }

    @computed
    get hotReloadActive(): boolean {
        return this.hotReloadTimer != null;
    }

    @action.bound
    stopHotReload(): void {
        if (this.hotReloadTimer != null) {
            clearInterval(this.hotReloadTimer);
            this.hotReloadTimer = null;
        }
    }

    /**
     * Periodically re-fetch the registry (P1.4). Only effective for `http(s)` sources.
     */
    @action.bound
    startHotReload(intervalMs: number): void {
        this.stopHotReload();
        const src = (this.lastLoadedSource ?? '').trim();
        if (!/^https?:\/\//i.test(src)) return;

        const ms = Math.max(5000, intervalMs);
        this.hotReloadTimer = setInterval(() => {
            void this.reloadRegistry();
        }, ms);
    }

    @action.bound
    async loadRegistry(source: string): Promise<void> {
        this.stopHotReload();
        const trimmed = source.trim();
        runInAction(() => {
            this.lastLoadedSource = trimmed;
            this.registryStatus = 'loading';
            this.registryLoadError = null;
        });
        try {
            const reg = await this.loader.load(trimmed);
            runInAction(() => {
                this.registry = reg;
                this.registryStatus = 'loaded';
            });
        } catch (e) {
            runInAction(() => {
                this.registry = null;
                this.registryStatus = 'error';
                this.registryLoadError = (e as Error).message ?? String(e);
            });
        }
    }

    /** Re-fetch using the last `loadRegistry` source (delegates to loader.reload). */
    @action.bound
    async reloadRegistry(): Promise<void> {
        try {
            this.registryStatus = 'loading';
            const reg = await this.loader.reload();
            runInAction(() => {
                this.registry = reg;
                this.registryStatus = 'loaded';
                this.registryLoadError = null;
            });
        } catch (e) {
            runInAction(() => {
                this.registryStatus = 'error';
                this.registryLoadError = (e as Error).message ?? String(e);
            });
        }
    }

    /**
     * Annotate exchange from current registry (call when exchange gains a final URL/method).
     */
    @action.bound
    annotateExchange(exchange: HttpExchange): void {
        const parsed = exchange.request.parsedUrl;
        if (!parsed.parseable) {
            exchange.setRegistryMatch({
                serviceId: null,
                endpointId: null,
                serviceName: null,
                teamName: null
            });
            return;
        }
        const pathname = parsed.pathname || '/';
        const match = matchRegistryTraffic({
            registry: this.registry,
            method: exchange.request.method,
            pathname
        });
        exchange.setRegistryMatch(match);
    }

    endpointFor(exchange: HttpExchange): RegistryEndpointAnnotation | null {
        return exchange.registryMatch;
    }

    @computed
    get coverageMap(): Map<string, CoverageEntry> {
        const map = new Map<string, CoverageEntry>();
        if (!this.registry) return map;

        for (const svc of this.registry.services) {
            for (const ep of svc.endpoints) {
                const key = `${svc.id}\0${ep.id}`;
                const status: CoverageEntry['status'] =
                    svc.status === 'deprecated' ? 'deprecated' : 'uncovered';
                map.set(key, {
                    endpointId: ep.id,
                    serviceId: svc.id,
                    status,
                    scenarioCount: 0,
                    approvedCount: 0
                });
            }
        }
        return map;
    }

    /** Test / diagnostics: last warnings from lenient parse. */
    get loadWarnings(): readonly string[] {
        return this.loader.lastLoadWarnings;
    }
}
