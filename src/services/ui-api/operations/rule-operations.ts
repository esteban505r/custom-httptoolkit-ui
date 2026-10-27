import { completionCheckers, matchers } from 'mockttp';

import { Operation } from '../api-types';
import { RulesStore } from '../../../model/rules/rules-store';
import * as HttpRule from '../../../model/rules/definitions/http-rule-definitions';
import {
    HtkRule,
    Matcher,
    RulePriority,
    isHttpBasedRule,
    isWebSocketRule
} from '../../../model/rules/rules';
import {
    findItem,
    isRuleGroup,
    isRuleRoot,
    HtkRuleItem
} from '../../../model/rules/rules-structure';
import { summarizeMatcher, summarizeSteps } from '../../../model/rules/rule-descriptions';

export function registerRuleOperations(
    registry: { register(op: Operation): void },
    rulesStore: RulesStore
): void {
    registry.register(rulesListOperation(rulesStore));

    registry.register(ruleCreateOperation(rulesStore));

    registry.register(ruleActivationOperation(rulesStore, true,
        'Activate a rule, or every rule within a group, so that it applies to matching traffic ' +
        'again. This takes effect immediately, without requiring the rules to be saved in the UI.'
    ));

    registry.register(ruleActivationOperation(rulesStore, false,
        'Deactivate a rule, or every rule within a group, so that it no longer affects any ' +
        'traffic. Deactivated rules stay configured and can be reactivated later with ' +
        'rules.activate. This takes effect immediately, without requiring the rules to be ' +
        'saved in the UI.'
    ));
}

// WebRTC rules are matched by MockRTC, which has no equivalent priority concept:
function getEffectivePriority(rule: HtkRule): number | undefined {
    if (!isHttpBasedRule(rule) && !isWebSocketRule(rule)) return undefined;
    return rule.priority ?? RulePriority.DEFAULT;
}

function summarizeRuleItems(items: ReadonlyArray<HtkRuleItem>): unknown[] {
    return items.map((item) => isRuleGroup(item)
        ? {
            id: item.id,
            title: item.title,
            rules: summarizeRuleItems(item.items)
        }
        : {
            id: item.id,
            type: item.type,
            title: item.title,
            activated: item.activated,
            priority: getEffectivePriority(item),
            matches: summarizeMatcher(item),
            steps: summarizeSteps(item)
        }
    );
}

function rulesListOperation(rulesStore: RulesStore): Operation {
    return {
        definition: {
            name: 'rules.list',
            description: 'List the currently configured HTTP Toolkit rules, which define how ' +
                'matching traffic is mocked, rewritten, breakpointed or otherwise modified. ' +
                'Rules are returned in their configured order, within their groups, and each is ' +
                'summarized rather than returning its full configuration.\n' +
                '\n' +
                'Note that this is not the order rules are matched in. Each request is matched ' +
                'against the highest priority rules first, and only falls through to lower ' +
                'priorities if none of them match. Within a single priority, rules are matched ' +
                'in the order returned here, and the first match wins.',
            category: 'rules',
            tiers: ['pro'],
            annotations: { readOnlyHint: true },
            inputSchema: {
                type: 'object',
                properties: {}
            },
            outputSchema: {
                type: 'object',
                properties: {
                    rules: {
                        type: 'array',
                        description: 'Rules and groups of rules, in their configured order',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                title: {
                                    type: 'string',
                                    description: 'The user-defined title of the rule or group, if it has one'
                                },
                                rules: {
                                    type: 'array',
                                    description: 'Present only on groups: the rules and nested ' +
                                        'groups within this group, in the same format as this list'
                                },
                                type: {
                                    type: 'string',
                                    description: 'Rules only: the rule protocol, e.g. "http" or "websocket"'
                                },
                                activated: {
                                    type: 'boolean',
                                    description: 'Rules only: whether the rule is currently enabled'
                                },
                                priority: {
                                    type: 'number',
                                    description: 'Rules only: the priority this rule is matched at. ' +
                                        'Higher priorities are matched first. 2 means high priority ' +
                                        '(matched before everything else), 1 is the default, and 0 ' +
                                        'means fallback (matched only once nothing else has matched). ' +
                                        'Omitted for WebRTC rules, which are matched separately.'
                                },
                                matches: {
                                    type: 'string',
                                    description: 'Rules only: human-readable summary of the traffic this rule matches'
                                },
                                steps: {
                                    type: 'string',
                                    description: 'Rules only: human-readable summary of what this rule does when matched'
                                }
                            }
                        }
                    },
                    unsavedChanges: {
                        type: 'boolean',
                        description: 'Whether the rules shown include edits that are not yet ' +
                            'saved in the UI, and so are not yet affecting live traffic'
                    }
                }
            }
        },
        handler: async () => {
            return {
                success: true,
                data: {
                    rules: summarizeRuleItems(rulesStore.draftRules.items),
                    unsavedChanges: rulesStore.areSomeRulesUnsaved
                }
            };
        }
    };
}


const SUPPORTED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

type CreateRuleParams = {
    url?: unknown;
    method?: unknown;
    action?: unknown;
    status?: unknown;
    body?: unknown;
    headers?: unknown;
    title?: unknown;
    priority?: unknown;
};

function buildMatchers(params: CreateRuleParams): { matchers: Matcher[] } | { error: string } {
    const { url, method } = params;

    if (typeof url !== 'string' || !url.trim()) {
        return { error: 'Missing required parameter: url' };
    }

    const ruleMatchers: Matcher[] = [];

    if (method !== undefined) {
        if (typeof method !== 'string') return { error: 'method must be a string' };
        const upperMethod = method.toUpperCase();
        if (!(SUPPORTED_METHODS as ReadonlyArray<string>).includes(upperMethod)) {
            return { error: `Unsupported method: ${method}. Supported: ${SUPPORTED_METHODS.join(', ')}` };
        }
        const MethodMatcher = (HttpRule.MethodMatchers as any)[upperMethod];
        ruleMatchers.push(new MethodMatcher());
    }

    // FlexiblePathMatcher is what the UI itself uses: it accepts a bare hostname, a
    // hostname + path, or a full URL, and matches protocol/port sensibly in each case.
    ruleMatchers.push(new matchers.FlexiblePathMatcher(url.trim()));

    return { matchers: ruleMatchers };
}

function buildSteps(params: CreateRuleParams, rulesStore: RulesStore): { steps: any[] } | { error: string } {
    const action = params.action ?? 'respond';

    if (action === 'close') return { steps: [new HttpRule.CloseConnectionStep()] };
    if (action === 'reset') return { steps: [new HttpRule.ResetConnectionStep()] };
    if (action === 'timeout') return { steps: [new HttpRule.TimeoutStep()] };
    if (action === 'passthrough') return { steps: [new HttpRule.PassThroughStep(rulesStore)] };

    if (action !== 'respond') {
        return { error: `Unsupported action: ${action}. Supported: respond, close, reset, timeout, passthrough` };
    }

    const status = params.status ?? 200;
    if (typeof status !== 'number' || !Number.isInteger(status) || status < 100 || status > 599) {
        return { error: 'status must be an integer between 100 and 599' };
    }

    const { body, headers } = params;
    if (body !== undefined && typeof body !== 'string') {
        return { error: 'body must be a string' };
    }
    if (headers !== undefined && (typeof headers !== 'object' || headers === null || Array.isArray(headers))) {
        return { error: 'headers must be an object of header name to value' };
    }

    return {
        steps: [new HttpRule.StaticResponseStep(
            status,
            undefined,
            body as string | undefined,
            headers as Record<string, string> | undefined
        )]
    };
}

function ruleCreateOperation(rulesStore: RulesStore): Operation {
    return {
        definition: {
            name: 'rules.create',
            description: 'Create a new HTTP rule, to mock, block or otherwise intercept matching ' +
                'traffic. The rule is added at the top of the rule list and saved immediately, so ' +
                'it applies to live traffic straight away without any UI interaction.\n' +
                '\n' +
                'Rules are matched by URL, which may be a bare hostname ("example.com"), a ' +
                'hostname and path ("example.com/api/thing"), or a full URL. Optionally narrow ' +
                'the match to a single method. Note that a rule only applies to traffic that is ' +
                'already being intercepted.',
            category: 'rules',
            tiers: ['pro'],
            annotations: { readOnlyHint: false, idempotentHint: false },
            inputSchema: {
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        description: 'The traffic to match: a hostname, a hostname and path, or a full URL'
                    },
                    method: {
                        type: 'string',
                        description: `Optional HTTP method to match. One of: ${SUPPORTED_METHODS.join(', ')}. ` +
                            'Omit to match every method.'
                    },
                    action: {
                        type: 'string',
                        description: 'What the rule does when it matches: "respond" (default) returns ' +
                            'a fixed response, "close" closes the connection, "reset" resets it, ' +
                            '"timeout" hangs, and "passthrough" forwards to the real target.'
                    },
                    status: {
                        type: 'number',
                        description: 'Response status for the "respond" action (default 200)'
                    },
                    body: {
                        type: 'string',
                        description: 'Response body for the "respond" action'
                    },
                    headers: {
                        type: 'object',
                        description: 'Response headers for the "respond" action, as name/value pairs'
                    },
                    title: {
                        type: 'string',
                        description: 'Optional title shown for the rule in the UI'
                    },
                    priority: {
                        type: 'number',
                        description: 'Match priority: 2 is matched before everything else, 1 is the ' +
                            'default, 0 is a fallback matched only once nothing else has. Defaults ' +
                            'to 2, so a new rule takes effect even when a catch-all rule exists.'
                    }
                },
                required: ['url']
            },
            outputSchema: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'The id of the rule that was created' },
                    matches: { type: 'string', description: 'Human-readable summary of what it matches' },
                    steps: { type: 'string', description: 'Human-readable summary of what it does' }
                }
            }
        },
        handler: async (params: CreateRuleParams) => {
            const matcherResult = buildMatchers(params);
            if ('error' in matcherResult) {
                return { success: false, error: { code: 'INVALID_PARAMS', message: matcherResult.error } };
            }

            const stepResult = buildSteps(params, rulesStore);
            if ('error' in stepResult) {
                return { success: false, error: { code: 'INVALID_PARAMS', message: stepResult.error } };
            }

            const { priority, title } = params;
            if (priority !== undefined && ![0, 1, 2].includes(priority as number)) {
                return {
                    success: false,
                    error: { code: 'INVALID_PARAMS', message: 'priority must be 0, 1 or 2' }
                };
            }
            if (title !== undefined && typeof title !== 'string') {
                return { success: false, error: { code: 'INVALID_PARAMS', message: 'title must be a string' } };
            }

            const rule: HtkRule = {
                id: crypto.randomUUID(),
                type: 'http',
                activated: true,
                // Default to OVERRIDE: without it a new rule sits at the same priority as the
                // default catch-all, and whether it wins depends on list order, which is a
                // confusing default for a rule created programmatically.
                priority: (priority as number | undefined) ?? RulePriority.OVERRIDE,
                matchers: matcherResult.matchers,
                completionChecker: new completionCheckers.Always(),
                steps: stepResult.steps
            } as HtkRule;

            if (title) (rule as { title?: string }).title = title;

            rulesStore.addDraftItem(rule);
            rulesStore.saveRules();

            return {
                success: true,
                data: {
                    id: rule.id,
                    matches: summarizeMatcher(rule),
                    steps: summarizeSteps(rule)
                }
            };
        }
    };
}

function ruleActivationOperation(
    rulesStore: RulesStore,
    activated: boolean,
    description: string
): Operation {
    const verb = activated ? 'activate' : 'deactivate';

    return {
        definition: {
            name: `rules.${verb}`,
            description,
            category: 'rules',
            tiers: ['pro'],
            annotations: { readOnlyHint: false, idempotentHint: true },
            inputSchema: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        description: `The id of the rule or group to ${verb}, as returned by rules.list`
                    }
                },
                required: ['id']
            },
            outputSchema: {
                type: 'object',
                properties: {
                    rulesUpdated: {
                        type: 'number',
                        description: 'The number of rules this was applied to'
                    }
                }
            }
        },
        handler: async (params) => {
            const { id } = params;

            if (!id || typeof id !== 'string') {
                return {
                    success: false,
                    error: { code: 'INVALID_PARAMS', message: 'Missing required parameter: id' }
                };
            }

            // The rule may exist only in the drafts (if it's new) or only in the active rules
            // (if it's been deleted in the drafts, but that's not saved yet):
            const item = findItem(rulesStore.draftRules, { id })
                ?? findItem(rulesStore.rules, { id });

            // The root isn't exposed by rules.list, so we don't accept it here either. Guessing
            // it shouldn't be a way to accidentally deactivate every rule at once.
            if (!item || isRuleRoot(item)) {
                return {
                    success: false,
                    error: { code: 'NOT_FOUND', message: `No rule or group found with id: ${id}` }
                };
            }

            return {
                success: true,
                data: { rulesUpdated: rulesStore.setItemActivated(id, activated) }
            };
        }
    };
}
