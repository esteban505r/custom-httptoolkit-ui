import { expect } from 'chai';

import { parseRegistryDocument } from '../../../src/registry/parse-registry-document';
import { matchRegistryTraffic } from '../../../src/registry/traffic-matcher';
import { minimalValidRegistryJson, twoServicesSpecificityJson } from './fixtures';

describe('matchRegistryTraffic', () => {
    const { registry } = parseRegistryDocument(minimalValidRegistryJson);

    it('returns null ids when registry is null', () => {
        const m = matchRegistryTraffic({
            registry: null,
            method: 'GET',
            pathname: '/api/v1/payments'
        });
        expect(m.serviceId).to.equal(null);
        expect(m.endpointId).to.equal(null);
    });

    it('matches GET /api/v1/payments to list-payments', () => {
        const m = matchRegistryTraffic({
            registry,
            method: 'GET',
            pathname: '/api/v1/payments'
        });
        expect(m.serviceId).to.equal('payments');
        expect(m.endpointId).to.equal('list-payments');
        expect(m.teamName).to.equal('Billing');
    });

    it('matches parameterized path', () => {
        const m = matchRegistryTraffic({
            registry,
            method: 'GET',
            pathname: '/api/v1/payments/abc-123'
        });
        expect(m.endpointId).to.equal('get-payment');
    });

    it('prefers more specific path over parameter wildcard', () => {
        const { registry: reg2 } = parseRegistryDocument(twoServicesSpecificityJson);
        const m = matchRegistryTraffic({
            registry: reg2,
            method: 'GET',
            pathname: '/v1/users/me'
        });
        expect(m.endpointId).to.equal('literal');
    });

    it('matches wildcard when literal does not apply', () => {
        const { registry: reg2 } = parseRegistryDocument(twoServicesSpecificityJson);
        const m = matchRegistryTraffic({
            registry: reg2,
            method: 'GET',
            pathname: '/v1/users/999'
        });
        expect(m.endpointId).to.equal('wild');
    });
});
