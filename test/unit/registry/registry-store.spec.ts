import { expect } from 'chai';

import { RegistryStore } from '../../../src/registry/registry-store';
import { minimalValidRegistryJson } from './fixtures';

describe('RegistryStore', () => {
    it('loadRegistry sets registry and status', async () => {
        const store = new RegistryStore();
        await store.loadRegistry(minimalValidRegistryJson);
        expect(store.registryStatus).to.equal('loaded');
        expect(store.registry).not.to.equal(null);
        expect(store.registry!.services[0].id).to.equal('payments');
    });

    it('coverageMap lists endpoints as uncovered', async () => {
        const store = new RegistryStore();
        await store.loadRegistry(minimalValidRegistryJson);
        const map = store.coverageMap;
        expect(map.size).to.equal(2);
        const keys = Array.from(map.keys());
        expect(keys.some((k) => k.includes('list-payments'))).to.equal(true);
    });

    it('startHotReload only runs for http(s) sources', async () => {
        const store = new RegistryStore();
        await store.loadRegistry(minimalValidRegistryJson);
        store.startHotReload(5000);
        expect(store.hotReloadActive).to.equal(false);
        store.stopHotReload();
    });

    it('startHotReload sets interval for https URL', async () => {
        const store = new RegistryStore();
        await store.loadRegistry('https://example.com/registry.json');
        store.startHotReload(99999);
        expect(store.hotReloadActive).to.equal(true);
        store.stopHotReload();
        expect(store.hotReloadActive).to.equal(false);
    });
});
