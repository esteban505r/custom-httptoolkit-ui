import * as uuid from 'uuid/v4';
import { matchers, completionCheckers } from 'mockttp';

import { MethodName } from '../model/http/methods';
import * as HttpRuleDefinitions from '../model/rules/definitions/http-rule-definitions';
import type { HttpRule as HttpRuleDef } from '../model/rules/definitions/http-rule-definitions';
import { HtkRule } from '../model/rules/rules';
import { getStatusMessage } from '../model/http/http-docs';
import { byteLength } from './buffer';
import type { HttptoolkitEndpointsFile } from './endpoint-list-import';
import { joinBaseUrlAndPath } from './endpoint-list-import';

function normalizeBaseWithScheme(enteredBaseUrl: string): string {
    let root = enteredBaseUrl.trim();
    if (!root.startsWith('http://') && !root.startsWith('https://')) {
        root = 'https://' + root;
    }
    return root.replace(/\/+$/, '');
}

/**
 * Build HTTP mock rules (static fixed responses) for endpoints that define `response`
 * in an endpoint-list file. Uses the same base URL the user confirmed in API settings.
 */
export function buildMockRulesFromEndpointList(
    data: HttptoolkitEndpointsFile,
    enteredBaseUrl: string
): HtkRule[] {
    const root = normalizeBaseWithScheme(enteredBaseUrl);
    const rules: HtkRule[] = [];

    for (const ep of data.endpoints) {
        if (!ep.response || typeof ep.response !== 'object') continue;

        const path = ep.path.trim().startsWith('/') ? ep.path.trim() : `/${ep.path.trim()}`;
        const methodUpper = ep.method.trim().toUpperCase() as MethodName;
        const MethodClass = (HttpRuleDefinitions.MethodMatchers as Record<string, { new(): unknown }>)[
            methodUpper
        ];
        if (!MethodClass) {
            throw new Error(`Unsupported method "${ep.method}" for mock on ${path}`);
        }

        const {
            status = 200,
            statusMessage,
            headers = {},
            body,
            json
        } = ep.response;

        if (!Number.isInteger(status) || status < 100 || status > 999) {
            throw new Error(`Invalid response status ${status} for ${methodUpper} ${path}`);
        }

        const responseHeaders: Record<string, string> = { ...headers };
        let bodyContent = '';

        if (json !== undefined) {
            bodyContent = typeof json === 'string' ? json : JSON.stringify(json, null, 2);
            const hasCt = Object.keys(responseHeaders).some(
                (k) => k.toLowerCase() === 'content-type'
            );
            if (!hasCt) {
                responseHeaders['content-type'] = 'application/json; charset=utf-8';
            }
        } else if (body !== undefined) {
            bodyContent = body;
        }

        const contentLengthKey = Object.keys(responseHeaders).find(
            (k) => k.toLowerCase() === 'content-length'
        );
        if (contentLengthKey) {
            responseHeaders[contentLengthKey] = byteLength(bodyContent).toString();
        }

        delete responseHeaders['date'];
        delete responseHeaders['expires'];
        delete responseHeaders[':status'];
        delete responseHeaders['content-encoding'];

        const fullUrl = joinBaseUrlAndPath(root, path);

        rules.push({
            id: uuid(),
            type: 'http',
            activated: true,
            matchers: [
                new MethodClass(),
                new matchers.FlexiblePathMatcher(fullUrl)
            ] as HttpRuleDef['matchers'],
            steps: [
                new HttpRuleDefinitions.StaticResponseStep(
                    status,
                    statusMessage?.trim() || getStatusMessage(status),
                    bodyContent,
                    responseHeaders
                )
            ],
            completionChecker: new completionCheckers.Always()
        });
    }

    return rules;
}
