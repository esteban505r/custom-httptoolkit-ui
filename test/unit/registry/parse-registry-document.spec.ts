import { expect } from 'chai';

import { parseRegistryDocument } from '../../../src/registry/parse-registry-document';
import {
    badEndpointSkippedJson,
    duplicateEndpointIdsJson,
    minimalValidRegistryJson
} from './fixtures';

describe('parseRegistryDocument', () => {
    it('parses a minimal valid .api.json', () => {
        const { registry, warnings } = parseRegistryDocument(minimalValidRegistryJson);
        expect(registry.version).to.equal('1.0');
        expect(registry.environments.dev).to.equal('http://localhost:3000');
        expect(registry.services).to.have.length(1);
        expect(registry.services[0].endpoints).to.have.length(2);
        expect(warnings).to.have.length(0);
    });

    it('throws on invalid JSON', () => {
        expect(() => parseRegistryDocument('{ nope')).to.throw(/invalid JSON/);
    });

    it('throws on wrong version', () => {
        expect(() =>
            parseRegistryDocument('{"version":"2.0","environments":{"a":"b"},"services":[]}')
        ).to.throw(/version must be "1.0"/);
    });

    it('warns on duplicate endpoint ids and keeps last', () => {
        const { registry, warnings } = parseRegistryDocument(duplicateEndpointIdsJson);
        expect(warnings.some((w) => w.includes('Duplicate endpoint ID'))).to.equal(true);
        const ep = registry.services[0].endpoints.find((e) => e.id === 'dup');
        expect(ep!.path).to.equal('/two');
    });

    it('skips invalid endpoints and keeps valid ones', () => {
        const { registry, warnings } = parseRegistryDocument(badEndpointSkippedJson);
        expect(registry.services[0].endpoints.map((e) => e.id)).to.deep.equal(['ok']);
        expect(warnings.length).to.be.greaterThan(0);
    });

    it('throws when no valid services remain', () => {
        const bad = `{
            "version": "1.0",
            "environments": { "d": "http://x" },
            "services": [
                { "id": "bad", "team": "", "base_path": "/a", "status": "stable", "endpoints": [] }
            ]
        }`;
        expect(() => parseRegistryDocument(bad)).to.throw(/no valid services/);
    });
});
