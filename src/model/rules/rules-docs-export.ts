import { HtkRule, getRulePartKey } from './rules';
import {
    HtkRuleItem,
    HtkRuleGroup,
    HtkRuleRoot,
    isRuleGroup,
    isRuleRoot
} from './rules-structure';
import { summarizeMatcher, summarizeSteps } from './rule-descriptions';
import { serializeRules } from './rule-serialization';

const HTKRULES_FENCE = '```htkrules';
const HTKRULES_FENCE_END = '```';

function escapeMarkdownBlock(text: string): string {
    return text.replace(/\n/g, ' ');
}

function isMockRule(rule: HtkRule): boolean {
    if (rule.type !== 'http' || rule.steps.length !== 1) return false;
    return getRulePartKey(rule.steps[0]) === 'simple';
}

function appendGroupAndRulesMd(
    item: HtkRuleItem,
    lines: string[],
    isRoot: boolean
): void {
    if (isRuleGroup(item)) {
        if (isRuleRoot(item)) {
            item.items.forEach((child) => appendGroupAndRulesMd(child, lines, false));
            return;
        }
        const group = item as HtkRuleGroup;
        lines.push('');
        lines.push(`## ${escapeMarkdownBlock(group.title)}`);
        if (group.description) {
            lines.push('');
            lines.push(group.description);
            lines.push('');
        }
        group.items.forEach((child) => appendGroupAndRulesMd(child, lines, false));
        return;
    }

    const rule = item as HtkRule;
    const title = rule.title || summarizeMatcher(rule);
    const stepsSummary = summarizeSteps(rule);
    const mockLabel = isMockRule(rule) ? ' *(Mock)*' : '';

    lines.push('');
    lines.push(`### ${escapeMarkdownBlock(title)}${mockLabel}`);
    if (rule.title) {
        lines.push(`*Match:* ${escapeMarkdownBlock(summarizeMatcher(rule))} → ${escapeMarkdownBlock(stepsSummary)}`);
    } else if (stepsSummary !== title) {
        lines.push(`*${escapeMarkdownBlock(stepsSummary)}*`);
    }
    if (rule.description) {
        lines.push('');
        lines.push(rule.description);
    }
}

/**
 * Export rules tree to a single Markdown string: human-readable doc at the top,
 * then a fenced code block containing the full serialized rules JSON for import.
 */
export function exportRulesToMarkdown(rules: HtkRuleRoot): string {
    const lines: string[] = [
        '# HTTP Toolkit rules & docs',
        '',
        `*Exported: ${new Date().toISOString()}*`,
        ''
    ];
    appendGroupAndRulesMd(rules, lines, true);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('*Full rules data (for import):*');
    lines.push('');
    lines.push(HTKRULES_FENCE);
    lines.push(JSON.stringify(serializeRules(rules), null, 2));
    lines.push(HTKRULES_FENCE_END);
    return lines.join('\n');
}

const FENCE_REGEX = /^```(?:htkrules|json)\s*\n([\s\S]*?)```/m;

/**
 * Extract rules payload from file content: either raw JSON (e.g. .htkrules)
 * or Markdown that contains a fenced block with language htkrules or json.
 * Returns the parsed object for loadSavedRules, or null if parsing fails.
 */
export function extractRulesFromMarkdownOrJson(fileContent: string): object | null {
    const trimmed = fileContent.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('{')) {
        try {
            return JSON.parse(trimmed) as object;
        } catch {
            return null;
        }
    }

    const match = trimmed.match(FENCE_REGEX);
    if (!match) return null;
    try {
        return JSON.parse(match[1].trim()) as object;
    } catch {
        return null;
    }
}
