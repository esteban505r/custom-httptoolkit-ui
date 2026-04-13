/**
 * Turn a path template (with `:param` segments) into a anchored RegExp (TDD §5.1.3).
 * Matching is against full pathname including service base_path prefix.
 */
export function escapeRegexLiteral(s: string): string {
    return s.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
}

/**
 * Count literal (non-parameter) path segments for specificity (TDD §5.2.2).
 */
export function pathSpecificity(templatePath: string): number {
    const trimmed = templatePath.replace(/\/+/g, '/');
    const parts = trimmed.split('/').filter(Boolean);
    return parts.filter((p) => !/^:[^/]+$/.test(p)).length;
}

/**
 * Build regex for a full path template like `/api/v1/users/:id`.
 */
export function compilePathTemplateToRegex(fullPathTemplate: string): RegExp {
    const normalized = fullPathTemplate.replace(/\/+/g, '/');
    const segments = normalized.split('/').filter(Boolean);
    if (segments.length === 0) {
        return /^\/$/;
    }
    const body = segments
        .map((segment) => {
            if (/^:[^/]+$/.test(segment)) {
                return '[^/]+';
            }
            return escapeRegexLiteral(segment);
        })
        .join('\\/');
    return new RegExp(`^\\/${body}$`);
}

export function joinBasePathAndPath(basePath: string, relativePath: string): string {
    const base = basePath.replace(/\/+$/, '') || '';
    const rel = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    if (!base || base === '') return rel.replace(/\/+/g, '/');
    return `${base}${rel}`.replace(/\/+/g, '/');
}
