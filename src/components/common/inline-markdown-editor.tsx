import * as React from 'react';
import TurndownService from 'turndown';

import { fromMarkdown } from '../../model/ui/markdown';

/**
 * Inline markdown editor (Obsidian-style): you see rendered markdown in place.
 * The contenteditable shows HTML from markdown; edits are converted back to markdown.
 */
export const InlineMarkdownEditor = (p: {
    value: string;
    onChange: (markdown: string) => void;
    placeholder?: string;
    className?: string;
    'data-testid'?: string;
}) => {
    const divRef = React.useRef<HTMLDivElement>(null);
    const lastRenderedRef = React.useRef<string>(p.value);
    const turndownRef = React.useRef<TurndownService | null>(null);

    if (!turndownRef.current) {
        turndownRef.current = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
    }

    // Sync from prop when value changed from outside (e.g. selected another item)
    React.useEffect(() => {
        if (p.value === lastRenderedRef.current) return;
        lastRenderedRef.current = p.value;
        if (!divRef.current) return;
        const html = p.value.trim()
            ? fromMarkdown(p.value, { linkify: true }).__html
            : '';
        divRef.current.innerHTML = html || '';
    }, [p.value]);

    // Focus when mounted so user can type immediately (e.g. after clicking Edit)
    React.useEffect(() => {
        divRef.current?.focus();
    }, []);

    const handleInput = React.useCallback(() => {
        if (!divRef.current || !turndownRef.current) return;
        const html = divRef.current.innerHTML;
        if (!html.trim()) {
            p.onChange('');
            lastRenderedRef.current = '';
            return;
        }
        try {
            const md = turndownRef.current.turndown(html);
            lastRenderedRef.current = md;
            p.onChange(md);
        } catch {
            // If turndown fails, keep previous
        }
    }, [p.onChange]);

    const isEmpty = !p.value.trim();

    return (
        <div
            ref={divRef}
            contentEditable
            suppressContentEditableWarning
            className={p.className}
            data-placeholder={p.placeholder}
            onInput={handleInput}
            data-testid={p['data-testid']}
            style={isEmpty ? { minHeight: '1.5em' } : undefined}
        />
    );
};
