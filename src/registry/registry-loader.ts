import { parseRegistryDocument } from './parse-registry-document';
import type { Registry } from './types';

export type RegistryLoaderStatus = 'idle' | 'loading' | 'loaded' | 'error';

export type ReadFileFn = (path: string) => Promise<string>;

/**
 * Loads `.api.json` from a URL or via an injected readFile (desktop / tests). TDD §5.1.
 */
export class RegistryLoader {
    status: RegistryLoaderStatus = 'idle';

    error: string | null = null;

    private lastSource: string | null = null;

    private lastWarnings: string[] = [];

    constructor(private readonly options?: { readFile?: ReadFileFn }) {}

    get lastLoadWarnings(): readonly string[] {
        return this.lastWarnings;
    }

    /**
     * @param source `http://` / `https://` URL, local path (requires `readFile` in options), or raw JSON object text if it starts with `{` (for tests / inline paste).
     */
    async load(source: string): Promise<Registry> {
        this.status = 'loading';
        this.error = null;
        this.lastSource = source;

        try {
            let text: string;
            if (/^https?:\/\//i.test(source.trim())) {
                const res = await fetch(source);
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status} fetching registry`);
                }
                text = await res.text();
            } else if (source.trim().startsWith('{')) {
                text = source;
            } else if (this.options?.readFile) {
                text = await this.options.readFile(source);
            } else {
                throw new Error(
                    'Local file paths require a readFile adapter (e.g. desktop bridge). Use an https URL or inline JSON.'
                );
            }

            const { registry, warnings } = parseRegistryDocument(text, source);
            this.lastWarnings = warnings;
            this.status = 'loaded';
            return registry;
        } catch (e) {
            const message = (e as Error).message ?? String(e);
            this.error = message;
            this.status = 'error';
            throw e;
        }
    }

    async reload(): Promise<Registry> {
        if (!this.lastSource) {
            throw new Error('reload() called before load()');
        }
        return this.load(this.lastSource);
    }
}
