import * as React from 'react';
import { observer, inject } from 'mobx-react';
import { action, runInAction } from 'mobx';

import { styled, css } from '../../styles';
import { WithInjected } from '../../types';
import { Icon } from '../../icons';

import { RulesStore } from '../../model/rules/rules-store';
import { HtkRule, getRulePartKey } from '../../model/rules/rules';
import {
    HtkRuleItem,
    HtkRuleGroup,
    isRuleGroup,
    isRuleRoot
} from '../../model/rules/rules-structure';
import { summarizeMatcher, summarizeSteps } from '../../model/rules/rule-descriptions';

import { Markdown } from '../common/text-content';
import { TextInput } from '../common/inputs';
import { InlineMarkdownEditor } from '../common/inline-markdown-editor';

interface DocsPageProps {
    className?: string;
    rulesStore: RulesStore;
}

const DocsPageContainer = styled.section`
    box-sizing: border-box;
    height: 100%;
    width: 100%;
    display: flex;
    flex-flow: column;
    align-items: stretch;
`;

const DocsBody = styled.div`
    display: flex;
    flex: 1;
    min-height: 0;
`;

const DocsScrollContainer = styled.div`
    overflow-y: auto;
    flex: 1;
    min-width: 0;
    padding: 24px 40px 40px;
`;

const DocsPageHeader = styled.header`
    box-sizing: border-box;
    width: 100%;
    padding: 20px 40px;
    background-color: ${p => p.theme.containerBackground};
    border-bottom: 1px solid rgba(0,0,0,0.12);

    display: flex;
    flex-direction: row;
    align-items: center;
`;

const DocsHeading = styled.h1`
    font-size: ${p => p.theme.loudHeadingSize};
    font-weight: bold;
    flex-grow: 1;
`;

const DocSection = styled.section<{ selected?: boolean }>`
    margin-bottom: 32px;
    cursor: pointer;
    padding: 8px 12px;
    margin-left: -12px;
    margin-right: -12px;
    padding-left: 12px;
    border-radius: 6px;
    ${p => p.selected && css`
        background-color: ${p.theme.containerBackground};
        box-shadow: 0 0 0 1px ${p.theme.containerBorder};
    `}
    &:hover {
        background-color: ${p => p.theme.containerBackground};
    }
`;

const DocSectionTitle = styled.h2`
    font-size: ${p => p.theme.headingSize};
    font-weight: 600;
    margin: 0 0 12px 0;
    padding-bottom: 6px;
    border-bottom: 1px solid ${p => p.theme.containerBorder};
`;

const DocSectionDescription = styled.div`
    font-size: ${p => p.theme.textSize};
    opacity: ${p => p.theme.lowlightTextOpacity};
    line-height: 1.5;
    margin-bottom: 16px;
`;

const DocRuleBlock = styled.div<{ selected?: boolean }>`
    margin-bottom: 24px;
    padding: 8px 12px 24px 16px;
    margin-left: -12px;
    border-left: 3px solid ${p => p.theme.containerBorder};
    border-radius: 4px;
    cursor: pointer;
    ${p => p.selected && css`
        background-color: ${p.theme.containerBackground};
        box-shadow: 0 0 0 1px ${p.theme.containerBorder};
    `}
    &:hover {
        background-color: ${p => p.theme.containerBackground};
    }
`;

const DocRuleTitle = styled.h3`
    font-size: ${p => p.theme.textSize};
    font-weight: 600;
    margin: 0 0 8px 0;
`;

const DocRuleSummary = styled.div`
    font-size: ${p => p.theme.textSize};
    opacity: ${p => p.theme.lowlightTextOpacity};
    margin-bottom: 6px;
`;

const DocRuleDescription = styled.div`
    font-size: ${p => p.theme.textSize};
    line-height: 1.5;
`;

const MockBadge = styled.span`
    font-size: 0.75em;
    font-weight: 600;
    text-transform: uppercase;
    opacity: 0.8;
    margin-left: 8px;
`;

/* Side panel */
const SidePanel = styled.aside`
    width: 560px;
    flex-shrink: 0;
    border-left: 1px solid ${p => p.theme.containerBorder};
    background-color: ${p => p.theme.containerBackground};
    display: flex;
    flex-direction: column;
    overflow: hidden;
`;

const SidePanelPlaceholder = styled.div`
    padding: 24px;
    font-size: ${p => p.theme.textSize};
    opacity: ${p => p.theme.lowlightTextOpacity};
    text-align: center;
`;

const SidePanelHeader = styled.div`
    padding: 16px 20px;
    border-bottom: 1px solid ${p => p.theme.containerBorder};
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const SidePanelTitle = styled.h3`
    font-size: ${p => p.theme.headingSize};
    margin: 0;
    font-weight: 600;
`;

const SidePanelCloseButton = styled.button`
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    opacity: 0.7;
    color: ${p => p.theme.mainColor};
    &:hover { opacity: 1; }
`;

const SidePanelContent = styled.div`
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 20px;
`;

const FieldLabel = styled.label`
    display: block;
    font-size: ${p => p.theme.textSize};
    font-weight: 600;
    margin-bottom: 6px;
    opacity: ${p => p.theme.lowlightTextOpacity};
`;

const SidePanelInput = styled(TextInput)`
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 16px;
`;

/* Description: view + editor with live preview when editing */
const DescriptionFieldWrap = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 400px;
    margin-bottom: 16px;
`;

const DescriptionLabelRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
`;

const DescriptionEditorLabel = styled.span`
    font-size: 0.85em;
    opacity: ${p => p.theme.lowlightTextOpacity};
    margin-left: 4px;
`;

const DescriptionToggleButton = styled.button`
    font-size: 0.85em;
    padding: 4px 10px;
    border-radius: 4px;
    border: 1px solid ${p => p.theme.containerBorder};
    background: ${p => p.theme.mainBackground};
    color: ${p => p.theme.mainColor};
    cursor: pointer;
    opacity: 0.9;
    &:hover { opacity: 1; }
`;

const DescriptionSingleBox = styled.div`
    flex: 1;
    min-height: 320px;
    border-radius: 8px;
    border: 1px solid ${p => p.theme.containerBorder};
    background: ${p => p.theme.mainBackground};
    overflow: hidden;
    display: flex;
    flex-direction: column;
`;

/* Inline editor: same typography as view so rendered content looks right */
const InlineEditorWrap = styled(InlineMarkdownEditor)`
    flex: 1;
    overflow-y: auto;
    padding: 14px 16px;
    font-size: ${p => p.theme.textSize};
    line-height: 1.6;
    min-height: 200px;
    outline: none;

    &[contenteditable]:empty::before {
        content: attr(data-placeholder);
        opacity: 0.5;
        font-style: italic;
    }

    p, li, ul, ol, table, h1, h2, h3, h4, h5, h6, pre {
        margin-bottom: 10px;
    }
    p:last-child, li:last-child, ul, ol, pre { margin-bottom: 0; }
    ul, ol { padding-left: 22px; }
    ul { list-style: circle; }
    ol { list-style: decimal; }
    pre, code {
        font-family: ${p => p.theme.monoFontFamily};
        font-size: 0.95em;
    }
    pre { padding: 10px; border-radius: 4px; overflow-x: auto; }
    code { padding: 2px 5px; border-radius: 2px; }
    pre code { padding: 0; }
`;

const DescriptionViewContent = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 14px 16px;
    font-size: ${p => p.theme.textSize};
    line-height: 1.6;
    cursor: text;

    p, li, ul, ol, table, h1, h2, h3, h4, h5, h6, pre {
        margin-bottom: 10px;
    }
    p:last-child, li:last-child, ul, ol, pre { margin-bottom: 0; }
    ul, ol { padding-left: 22px; }
    ul { list-style: circle; }
    ol { list-style: decimal; }
    pre, code {
        font-family: ${p => p.theme.monoFontFamily};
        font-size: 0.95em;
    }
    pre {
        padding: 10px;
        border-radius: 4px;
        overflow-x: auto;
    }
    code { padding: 2px 5px; border-radius: 2px; }
    pre code { padding: 0; }
`;

/* Fullscreen doc view */
const FullscreenOverlay = styled.div`
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: ${p => p.theme.mainBackground};
    display: flex;
    flex-direction: column;
    overflow: hidden;
`;

const FullscreenHeader = styled.div`
    padding: 16px 24px;
    border-bottom: 1px solid ${p => p.theme.containerBorder};
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
`;

const FullscreenTitle = styled.h2`
    margin: 0;
    font-size: ${p => p.theme.loudHeadingSize};
    font-weight: 600;
`;

const FullscreenCloseBtn = styled.button`
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid ${p => p.theme.containerBorder};
    background: ${p => p.theme.mainBackground};
    color: ${p => p.theme.mainColor};
    cursor: pointer;
    font-size: ${p => p.theme.textSize};
    &:hover { opacity: 0.9; }
`;

const FullscreenContent = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 32px 48px 48px;
    max-width: 720px;
    margin: 0 auto;
    font-size: ${p => p.theme.textSize};
    line-height: 1.7;

    p, li, ul, ol, table, h1, h2, h3, h4, h5, h6, pre {
        margin-bottom: 14px;
    }
    p:last-child, li:last-child, ul, ol, pre { margin-bottom: 0; }
    ul, ol { padding-left: 24px; }
    ul { list-style: circle; }
    ol { list-style: decimal; }
    pre, code {
        font-family: ${p => p.theme.monoFontFamily};
        font-size: 0.95em;
    }
    pre { padding: 12px; border-radius: 6px; overflow-x: auto; }
    code { padding: 2px 6px; border-radius: 3px; }
    pre code { padding: 0; }
    h1 { font-size: 1.6em; margin-top: 24px; }
    h2 { font-size: 1.3em; margin-top: 20px; }
    h3 { font-size: 1.1em; margin-top: 16px; }
`;

const ReadOnlySummary = styled.div`
    font-size: ${p => p.theme.textSize};
    opacity: ${p => p.theme.lowlightTextOpacity};
    line-height: 1.4;
    margin-top: 8px;
    padding: 8px;
    background: ${p => p.theme.mainBackground};
    border-radius: 4px;
`;

function isMockRule(rule: HtkRule): boolean {
    if (rule.type !== 'http' || rule.steps.length !== 1) return false;
    return getRulePartKey(rule.steps[0]) === 'simple';
}

function renderItem(
    item: HtkRuleItem,
    depth: number,
    selectedId: string | null,
    onSelect: (item: HtkRuleItem) => void
): React.ReactNode {
    if (isRuleGroup(item)) {
        if (isRuleRoot(item)) {
            return (
                <React.Fragment key={item.id}>
                    {item.items.map((child) => renderItem(child, depth, selectedId, onSelect))}
                </React.Fragment>
            );
        }
        const group = item as HtkRuleGroup;
        return (
            <DocSection
                key={item.id}
                selected={selectedId === item.id}
                onClick={() => onSelect(item)}
            >
                <DocSectionTitle>{group.title}</DocSectionTitle>
                {group.description && (
                    <DocSectionDescription>
                        <Markdown content={group.description} />
                    </DocSectionDescription>
                )}
                {group.items.map((child) => renderItem(child, depth + 1, selectedId, onSelect))}
            </DocSection>
        );
    }

    const rule = item as HtkRule;
    const title = rule.title || summarizeMatcher(rule);
    const stepsSummary = summarizeSteps(rule);

    return (
        <DocRuleBlock
            key={rule.id}
            selected={selectedId === rule.id}
            onClick={() => onSelect(item)}
        >
            <DocRuleTitle>
                {title}
                {isMockRule(rule) && <MockBadge>Mock</MockBadge>}
            </DocRuleTitle>
            {!rule.title && stepsSummary !== title && (
                <DocRuleSummary>{stepsSummary}</DocRuleSummary>
            )}
            {rule.title && <DocRuleSummary>Match: {summarizeMatcher(rule)} → {stepsSummary}</DocRuleSummary>}
            {rule.description && (
                <DocRuleDescription>
                    <Markdown content={rule.description} />
                </DocRuleDescription>
            )}
        </DocRuleBlock>
    );
}

@inject('rulesStore')
@observer
class DocsPage extends React.Component<DocsPageProps> {
    state: {
        selectedItem: HtkRuleItem | null;
        isEditingDescription: boolean;
        fullscreenItem: HtkRuleItem | null;
    } = { selectedItem: null, isEditingDescription: false, fullscreenItem: null };

    private handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && this.state.fullscreenItem) {
            this.setFullscreenItem(null);
        }
    };

    componentDidMount() {
        window.addEventListener('keydown', this.handleEscape);
    }

    componentWillUnmount() {
        window.removeEventListener('keydown', this.handleEscape);
    }

    @action.bound
    setSelectedItem(item: HtkRuleItem | null) {
        this.setState({ selectedItem: item, isEditingDescription: false });
    }

    @action.bound
    setEditingDescription(editing: boolean) {
        this.setState({ isEditingDescription: editing });
    }

    @action.bound
    setFullscreenItem(item: HtkRuleItem | null) {
        this.setState({ fullscreenItem: item });
    }

    render() {
        const { rulesStore } = this.props;
        const draftRules = rulesStore.draftRules;
        const hasItems = draftRules.items.length > 0;
        const selectedItem = this.state.selectedItem;
        const selectedId = selectedItem?.id ?? null;
        const isEditingDescription = this.state.isEditingDescription;

        return (
            <DocsPageContainer>
                <DocsPageHeader>
                    <DocsHeading>Rules & mocks docs</DocsHeading>
                </DocsPageHeader>
                <DocsBody>
                    <DocsScrollContainer>
                        {hasItems ? (
                            renderItem(draftRules, 0, selectedId, this.setSelectedItem)
                        ) : (
                            <p style={{ opacity: 0.7 }}>No rules yet. Add rules in the Modify view, then they will appear here with their titles and descriptions.</p>
                        )}
                    </DocsScrollContainer>
                    <SidePanel>
                        {!selectedItem ? (
                            <SidePanelPlaceholder>
                                Click a rule or group in the list to view and edit its title and description here.
                            </SidePanelPlaceholder>
                        ) : isRuleGroup(selectedItem) ? (
                            <>
                                <SidePanelHeader>
                                    <SidePanelTitle>Group</SidePanelTitle>
                                    <span>
                                        <DescriptionToggleButton
                                            type="button"
                                            onClick={() => this.setFullscreenItem(selectedItem)}
                                            title="View fullscreen"
                                            style={{ marginRight: 8 }}
                                        >
                                            <Icon icon={['fas', 'expand-alt']} /> Fullscreen
                                        </DescriptionToggleButton>
                                        <SidePanelCloseButton
                                            type="button"
                                            title="Close"
                                            onClick={() => this.setSelectedItem(null)}
                                        >
                                            <Icon icon={['fas', 'times']} />
                                        </SidePanelCloseButton>
                                    </span>
                                </SidePanelHeader>
                                <SidePanelContent>
                                    <FieldLabel>Title</FieldLabel>
                                    <SidePanelInput
                                        value={(selectedItem as HtkRuleGroup).title}
                                        onChange={(e) => runInAction(() => { (selectedItem as HtkRuleGroup).title = e.target.value; })}
                                        placeholder="Group name"
                                    />
                                    <FieldLabel>
                                        Description <DescriptionEditorLabel>(Markdown)</DescriptionEditorLabel>
                                    </FieldLabel>
                                    <DescriptionLabelRow>
                                        <span />
                                        <DescriptionToggleButton
                                            type="button"
                                            onClick={() => this.setEditingDescription(!isEditingDescription)}
                                        >
                                            {isEditingDescription ? 'Done' : 'Edit'}
                                        </DescriptionToggleButton>
                                    </DescriptionLabelRow>
                                    <DescriptionFieldWrap>
                                        <DescriptionSingleBox>
                                            {isEditingDescription ? (
                                                <InlineEditorWrap
                                                    value={(selectedItem as HtkRuleGroup).description || ''}
                                                    onChange={(md) => runInAction(() => { (selectedItem as HtkRuleGroup).description = md || undefined; })}
                                                    placeholder="Markdown here… **bold**, *italic*, lists, `code`"
                                                />
                                            ) : (
                                                <DescriptionViewContent onClick={() => this.setEditingDescription(true)}>
                                                    {(selectedItem as HtkRuleGroup).description
                                                        ? <Markdown content={(selectedItem as HtkRuleGroup).description!} />
                                                        : <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Click Edit or here to add a description.</span>
                                                    }
                                                </DescriptionViewContent>
                                            )}
                                        </DescriptionSingleBox>
                                    </DescriptionFieldWrap>
                                </SidePanelContent>
                            </>
                        ) : (
                            <>
                                <SidePanelHeader>
                                    <SidePanelTitle>
                                        Rule{isMockRule(selectedItem as HtkRule) ? ' (Mock)' : ''}
                                    </SidePanelTitle>
                                    <span>
                                        <DescriptionToggleButton
                                            type="button"
                                            onClick={() => this.setFullscreenItem(selectedItem)}
                                            title="View fullscreen"
                                            style={{ marginRight: 8 }}
                                        >
                                            <Icon icon={['fas', 'expand-alt']} /> Fullscreen
                                        </DescriptionToggleButton>
                                        <SidePanelCloseButton
                                            type="button"
                                            title="Close"
                                            onClick={() => this.setSelectedItem(null)}
                                        >
                                            <Icon icon={['fas', 'times']} />
                                        </SidePanelCloseButton>
                                    </span>
                                </SidePanelHeader>
                                <SidePanelContent>
                                    <FieldLabel>Title</FieldLabel>
                                    <SidePanelInput
                                        value={(selectedItem as HtkRule).title || ''}
                                        onChange={(e) => runInAction(() => { (selectedItem as HtkRule).title = e.target.value || undefined; })}
                                        placeholder="A custom name for this rule"
                                    />
                                    <FieldLabel>
                                        Description <DescriptionEditorLabel>(Markdown)</DescriptionEditorLabel>
                                    </FieldLabel>
                                    <DescriptionLabelRow>
                                        <span />
                                        <DescriptionToggleButton
                                            type="button"
                                            onClick={() => this.setEditingDescription(!isEditingDescription)}
                                        >
                                            {isEditingDescription ? 'Done' : 'Edit'}
                                        </DescriptionToggleButton>
                                    </DescriptionLabelRow>
                                    <DescriptionFieldWrap>
                                        <DescriptionSingleBox>
                                            {isEditingDescription ? (
                                                <InlineEditorWrap
                                                    value={(selectedItem as HtkRule).description || ''}
                                                    onChange={(md) => runInAction(() => { (selectedItem as HtkRule).description = md || undefined; })}
                                                    placeholder="Markdown here… **bold**, *italic*, lists, `code`"
                                                />
                                            ) : (
                                                <DescriptionViewContent onClick={() => this.setEditingDescription(true)}>
                                                    {(selectedItem as HtkRule).description
                                                        ? <Markdown content={(selectedItem as HtkRule).description!} />
                                                        : <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Click Edit or here to add a description.</span>
                                                    }
                                                </DescriptionViewContent>
                                            )}
                                        </DescriptionSingleBox>
                                    </DescriptionFieldWrap>
                                    <FieldLabel>Summary (read-only)</FieldLabel>
                                    <ReadOnlySummary>
                                        Match: {summarizeMatcher(selectedItem as HtkRule)} → {summarizeSteps(selectedItem as HtkRule)}
                                    </ReadOnlySummary>
                                </SidePanelContent>
                            </>
                        )}
                    </SidePanel>
                </DocsBody>

                {this.state.fullscreenItem && (
                    <FullscreenOverlay>
                        <FullscreenHeader>
                            <FullscreenTitle>
                                {isRuleGroup(this.state.fullscreenItem)
                                    ? (this.state.fullscreenItem as HtkRuleGroup).title
                                    : (this.state.fullscreenItem as HtkRule).title || summarizeMatcher(this.state.fullscreenItem as HtkRule)}
                                {!isRuleGroup(this.state.fullscreenItem) && isMockRule(this.state.fullscreenItem as HtkRule) && ' (Mock)'}
                            </FullscreenTitle>
                            <FullscreenCloseBtn type="button" onClick={() => this.setFullscreenItem(null)}>
                                Close (Esc)
                            </FullscreenCloseBtn>
                        </FullscreenHeader>
                        <FullscreenContent>
                            {isRuleGroup(this.state.fullscreenItem) ? (
                                (this.state.fullscreenItem as HtkRuleGroup).description
                                    ? <Markdown content={(this.state.fullscreenItem as HtkRuleGroup).description!} />
                                    : <p style={{ opacity: 0.6, fontStyle: 'italic' }}>No description.</p>
                            ) : (
                                <>
                                    {(this.state.fullscreenItem as HtkRule).description
                                        ? <Markdown content={(this.state.fullscreenItem as HtkRule).description!} />
                                        : <p style={{ opacity: 0.6, fontStyle: 'italic' }}>No description.</p>
                                    }
                                    <p style={{ marginTop: 24, opacity: 0.8, fontSize: '0.95em' }}>
                                        <strong>Match:</strong> {summarizeMatcher(this.state.fullscreenItem as HtkRule)} → {summarizeSteps(this.state.fullscreenItem as HtkRule)}
                                    </p>
                                </>
                            )}
                        </FullscreenContent>
                    </FullscreenOverlay>
                )}
            </DocsPageContainer>
        );
    }
}

const InjectedDocsPage = DocsPage as unknown as React.ComponentType<
    Omit<DocsPageProps, 'rulesStore'>
>;

export { InjectedDocsPage as DocsPage };
