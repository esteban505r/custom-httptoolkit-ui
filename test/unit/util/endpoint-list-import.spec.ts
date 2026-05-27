import { expect } from 'chai';

import {
    endpointListFileToOpenApi,
    endpointListHasMockResponses,
    isHttptoolkitEndpointsFile,
    joinBaseUrlAndPath
} from '../../../src/util/endpoint-list-import';

describe('endpoint list import', () => {
    it('detects httptoolkit endpoint files', () => {
        expect(isHttptoolkitEndpointsFile(null)).to.equal(false);
        expect(isHttptoolkitEndpointsFile({})).to.equal(false);
        expect(isHttptoolkitEndpointsFile({
            httptoolkitEndpoints: '1',
            baseUrl: 'https://api.example.com',
            endpoints: []
        })).to.equal(false);
        expect(isHttptoolkitEndpointsFile({
            httptoolkitEndpoints: '1',
            baseUrl: 'https://api.example.com',
            endpoints: [{ method: 'GET', path: '/' }]
        })).to.equal(true);
        expect(isHttptoolkitEndpointsFile({
            httptoolkitEndpoints: 1,
            baseUrl: 'https://api.example.com',
            endpoints: [{ method: 'GET', path: '/' }]
        })).to.equal(true);
    });

    it('builds OpenAPI with normalized paths and methods', () => {
        const spec = endpointListFileToOpenApi({
            httptoolkitEndpoints: '1',
            title: 'Test API',
            version: '2.0.0',
            baseUrl: 'https://api.example.com/v1',
            endpoints: [
                { method: 'GET', path: '/users', summary: 'List' },
                { method: 'post', path: 'items', summary: 'Create' }
            ]
        });

        expect(spec.openapi).to.equal('3.0.3');
        expect(spec.info.title).to.equal('Test API');
        expect(spec.info.version).to.equal('2.0.0');
        expect(spec.servers![0].url).to.equal('https://api.example.com/v1');
        expect(spec.paths!['/users']!.get!.summary).to.equal('List');
        expect(spec.paths!['/items']!.post!.summary).to.equal('Create');
    });

    it('prefixes https when base URL has no scheme', () => {
        const spec = endpointListFileToOpenApi({
            httptoolkitEndpoints: '1',
            baseUrl: 'localhost:3000',
            endpoints: [{ method: 'GET', path: '/' }]
        });
        expect(spec.servers![0].url).to.equal('https://localhost:3000');
    });

    it('rejects empty endpoint list', () => {
        expect(() => endpointListFileToOpenApi({
            httptoolkitEndpoints: '1',
            baseUrl: 'https://x',
            endpoints: []
        })).to.throw();
    });

    it('joinBaseUrlAndPath avoids double slashes', () => {
        expect(joinBaseUrlAndPath('https://a.com/v1/', '/x')).to.equal('https://a.com/v1/x');
        expect(joinBaseUrlAndPath('https://a.com', 'y')).to.equal('https://a.com/y');
    });

    it('endpointListHasMockResponses detects response blocks', () => {
        expect(endpointListHasMockResponses({
            httptoolkitEndpoints: '1',
            baseUrl: 'https://x',
            endpoints: [{ method: 'GET', path: '/' }]
        })).to.equal(false);
        expect(endpointListHasMockResponses({
            httptoolkitEndpoints: '1',
            baseUrl: 'https://x',
            endpoints: [{ method: 'GET', path: '/', response: { status: 200 } }]
        })).to.equal(true);
    });

    it('documents response status in OpenAPI when response is set', () => {
        const spec = endpointListFileToOpenApi({
            httptoolkitEndpoints: '1',
            baseUrl: 'https://api.example.com',
            endpoints: [
                {
                    method: 'GET',
                    path: '/ok',
                    response: { status: 201, statusMessage: 'Created', json: { id: 1 } }
                }
            ]
        });
        const op = spec.paths!['/ok']!.get!;
        expect(op.responses!['201']!.description).to.equal('Created');
        expect(op.responses!['201']!.content).to.have.property('application/json');
    });
});
