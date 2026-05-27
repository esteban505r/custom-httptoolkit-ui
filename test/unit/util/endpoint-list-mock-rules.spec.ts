import { expect } from 'chai';

import { buildMockRulesFromEndpointList } from '../../../src/util/endpoint-list-mock-rules';
import * as HttpRuleDefinitions from '../../../src/model/rules/definitions/http-rule-definitions';

describe('endpoint list mock rules', () => {
    it('builds static-response rules for endpoints with response', () => {
        const rules = buildMockRulesFromEndpointList({
            httptoolkitEndpoints: '1',
            baseUrl: 'https://api.example.com',
            endpoints: [
                { method: 'GET', path: '/ping', summary: 'Ping' },
                {
                    method: 'POST',
                    path: '/v1/items',
                    response: {
                        status: 201,
                        json: { id: 'a' }
                    }
                }
            ]
        }, 'https://api.example.com');

        expect(rules).to.have.length(1);
        expect(rules[0].steps[0]).to.be.instanceOf(HttpRuleDefinitions.StaticResponseStep);
        const step = rules[0].steps[0] as HttpRuleDefinitions.StaticResponseStep;
        expect(step.status).to.equal(201);
        expect(step.data).to.include('"id"');
    });

    it('uses entered base URL for path matching', () => {
        const rules = buildMockRulesFromEndpointList({
            httptoolkitEndpoints: '1',
            baseUrl: 'https://ignored.example.com',
            endpoints: [
                {
                    method: 'GET',
                    path: '/x',
                    response: { body: 'hi' }
                }
            ]
        }, 'http://localhost:4000/api');

        expect(rules).to.have.length(1);
        const pathMatcher = rules[0].matchers[1] as { explain?: () => string };
        expect(pathMatcher.explain!()).to.include('localhost:4000');
    });
});
