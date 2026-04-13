import { expect } from 'chai';

import { RegistryLoader } from '../../../src/registry/registry-loader';
import { minimalValidRegistryJson } from './fixtures';

describe('RegistryLoader', () => {
    it('loads inline JSON when source starts with {', async () => {
        const loader = new RegistryLoader();
        const reg = await loader.load(minimalValidRegistryJson);
        expect(loader.status).to.equal('loaded');
        expect(reg.services[0].id).to.equal('payments');
    });

    it('loads from readFile when configured', async () => {
        const loader = new RegistryLoader({
            readFile: async () => minimalValidRegistryJson
        });
        const reg = await loader.load('/any/path.api.json');
        expect(reg.version).to.equal('1.0');
    });

    it('reload uses last source', async () => {
        let calls = 0;
        const loader = new RegistryLoader({
            readFile: async () => {
                calls += 1;
                return minimalValidRegistryJson;
            }
        });
        await loader.load('/x.api.json');
        await loader.reload();
        expect(calls).to.equal(2);
    });

    it('sets error status when file path has no readFile', async () => {
        const loader = new RegistryLoader();
        try {
            await loader.load('/tmp/missing.api.json');
            expect.fail('should throw');
        } catch {
            expect(loader.status).to.equal('error');
            expect(loader.error).to.match(/readFile adapter/i);
        }
    });
});
