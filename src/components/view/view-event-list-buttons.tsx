import * as React from 'react';
import { observer, inject } from 'mobx-react';
import * as dateFns from 'date-fns';
import * as dedent from 'dedent';
import * as Ajv from 'ajv';

import { ViewableEvent } from '../../types';
import { saveFile, uploadFile, Ctrl } from '../../util/ui';

import { AccountStore } from '../../model/account/account-store';
import { EventsStore } from '../../model/events/events-store';
import { RulesStore } from '../../model/rules/rules-store';
import { generateHar } from '../../model/http/har';
import { logError } from '../../errors';
import { formatAjvError } from '../../util/json-schema';

import { IconButton } from '../common/icon-button';
import { TextInput } from '../common/inputs';
import { styled } from '../../styles';

export const ClearAllButton = observer((props: {
    className?: string,
    disabled: boolean,
    onClear: () => void
}) => <IconButton
    icon={['far', 'trash-alt']}
    title={`Clear all (${Ctrl}+Shift+Delete)`}
    disabled={props.disabled}
    onClick={props.onClear}
/>);

export const ExportAsHarButton = inject('accountStore')(observer((props: {
    className?: string,
    accountStore?: AccountStore,
    events: ReadonlyArray<ViewableEvent>
}) => {
    const { isPaidUser } = props.accountStore!;

    return <IconButton
        icon={['fas', 'save']}
        title={
            isPaidUser
                ? 'Export these exchanges as a HAR file'
                : (
                    'With Pro: Export requests & responses as a HAR file, ' +
                    'to save for later or share with others'
                )
        }
        disabled={!isPaidUser || props.events.length === 0}
        onClick={async () => {
            const harContent = JSON.stringify(
                await generateHar(props.events)
            );
            const filename = `HTTPToolkit_${
                dateFns.format(Date.now(), 'YYYY-MM-DD_HH-mm')
            }.har`;

            saveFile(filename, 'application/har+json;charset=utf-8', harContent);
        }}
    />
}));

export const ImportHarButton = inject('eventsStore', 'accountStore')(
    observer((props: {
        accountStore?: AccountStore,
        eventsStore?: EventsStore
    }) => {
        const { isPaidUser } = props.accountStore!;

        return <IconButton
            icon={['fas', 'folder-open']}
            title={
                isPaidUser
                    ? 'Import exchanges from a HAR file'
                    : (
                        'With Pro: Import requests & responses from HAR files, ' +
                        'to examine past recordings or data from other tools'
                    )
            }
            disabled={!isPaidUser}
            onClick={async () => {
                const uploadedFile = await uploadFile('text', ['.har', 'application/har', 'application/har+json']);
                if (uploadedFile) {
                    let data: {};
                    try {
                        data = JSON.parse(uploadedFile);
                        await props.eventsStore!.loadFromHar(data);
                    } catch (error: any) {
                        logError(error);

                        if (error.name === 'HARError' && error.errors) {
                            alert(dedent`
                                HAR file is not valid.

                                ${
                                    error.errors
                                    .map((e: Ajv.ErrorObject) => formatAjvError(data, e))
                                    .join('\n')
                                }
                            `);
                        } else {
                            alert(dedent`
                                Could not parse HAR file.

                                ${error.message || error}
                            `);
                        }
                    }
                }
            }}
        />
    })
);

export const PlayPauseButton = inject('eventsStore')(
    observer((props: {
        eventsStore?: EventsStore
    }) => {
        const { isPaused, togglePause } = props.eventsStore!;

        return <IconButton
            icon={['fas', isPaused ? 'play' : 'pause']}
            title={`${isPaused ? 'Resume' : 'Pause'} collecting intercepted exchanges`}
            onClick={togglePause}
        />
    })
);

export const ScrollToEndButton = (props: { onScrollToEnd: () => void }) =>
    <IconButton
        icon={['fas', 'level-down-alt']}
        title="Scroll to the bottom of the list"
        onClick={props.onScrollToEnd}
    />;

const RecordingControlContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
`;

const RecordingNameInput = styled(TextInput)`
    width: 120px;
`;

const RecordingLabel = styled.span`
    font-size: ${p => p.theme.textSize};
    color: ${p => p.theme.mainColor};
    white-space: nowrap;
`;

const RecordingActionButton = styled.button.attrs({ type: 'button' })`
    padding: 5px 10px;
    font-size: ${p => p.theme.textSize};
    font-family: ${p => p.theme.fontFamily};
    border-radius: 4px;
    border: solid 1px ${p => p.theme.inputBorder};
    background-color: ${p => p.theme.inputBackground};
    color: ${p => p.theme.mainColor};
    cursor: pointer;

    &:disabled {
        opacity: 0.5;
        cursor: default;
    }

    &:not([disabled]):hover {
        background-color: ${p => p.theme.inputHoverBackground};
    }
`;

const RecordingStartButton = styled(RecordingActionButton)`
    border: none;
    background-color: ${p => p.theme.primaryInputBackground};
    color: ${p => p.theme.primaryInputColor};

    &:not([disabled]):hover {
        background-color: ${p => p.theme.primaryInputBackground};
        opacity: 0.9;
    }
`;

const RecordingStopButton = styled(RecordingActionButton)`
    border: 2px solid ${p => p.theme.popColor};
    background-color: transparent;
    color: ${p => p.theme.popColor};

    &:not([disabled]):hover {
        color: ${p => p.theme.popColor};
        background-color: transparent;
        opacity: 0.9;
    }
`;

const RecordingOptionLabel = styled.label`
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: ${p => p.theme.textSize};
    color: ${p => p.theme.mainColor};
    cursor: pointer;

    input[type="checkbox"] {
        cursor: pointer;
    }
`;

const RecordingSelect = styled.select`
    padding: 5px 10px;
    font-size: ${p => p.theme.textInputFontSize};
    font-family: ${p => p.theme.fontFamily};
    border-radius: 4px;
    border: solid 1px ${p => p.theme.inputBorder};
    background-color: ${p => p.theme.inputBackground};
    color: ${p => p.theme.mainColor};
    cursor: pointer;
    min-width: 140px;
`;

const RecordingOptionsBackdrop = styled.div`
    position: fixed;
    inset: 0;
    z-index: 99;
    background: rgba(0, 0, 0, 0.35);
`;

const RecordingOptionsDialog = styled.div`
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 100;
    margin: 0;
    padding: 20px 24px;
    min-width: 280px;
    border-radius: 16px;
    border: none;
    box-shadow: 0 0 0 1px ${p => p.theme.containerBorder} inset;
    background-color: ${p => p.theme.mainBackground};
    color: ${p => p.theme.mainColor};
`;

const RecordingOptionsTitle = styled.h3`
    margin: 0 0 16px 0;
    font-size: ${p => p.theme.subHeadingSize};
    font-weight: 600;
    color: ${p => p.theme.mainColor};
`;

const RecordingOptionsRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
`;

const RecordingOptionsWhitelistBlock = styled.div`
    margin-bottom: 12px;
`;

const RecordingOptionsWhitelistLabel = styled.div`
    font-size: ${p => p.theme.textSize};
    color: ${p => p.theme.mainColor};
    margin-bottom: 4px;
`;

const RecordingWhitelistTextarea = styled.textarea`
    width: 100%;
    min-height: 64px;
    padding: 5px 10px;
    font-size: ${p => p.theme.textInputFontSize};
    font-family: ${p => p.theme.monoFontFamily};
    border-radius: 4px;
    border: solid 1px ${p => p.theme.inputBorder};
    background-color: ${p => p.theme.inputBackground};
    color: ${p => p.theme.inputColor};
    resize: vertical;
    box-sizing: border-box;

    &::placeholder {
        color: ${p => p.theme.inputPlaceholderColor};
    }

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

const RecordingOptionsClose = styled(RecordingActionButton)`
    margin-top: 12px;
    width: 100%;
`;

export const RecordButton = inject('eventsStore', 'accountStore', 'rulesStore')(
    observer((props: {
        className?: string,
        eventsStore?: EventsStore,
        accountStore?: AccountStore,
        rulesStore?: RulesStore
    }) => {
        const { eventsStore, accountStore, rulesStore } = props;
        if (!eventsStore || !accountStore || !rulesStore) return null;

        const {
            isRecording,
            recordedCount,
            recordingName,
            recordingNameDraft,
            setRecordingNameDraft,
            recordingTargetGroupId,
            setRecordingTargetGroupId,
            recordingOnlyOkResponses,
            setRecordingOnlyOkResponses,
            recordingMatchBy,
            setRecordingMatchBy,
            recordingUrlWhitelist,
            setRecordingUrlWhitelist,
            recordingOptionsDialogOpen,
            setRecordingOptionsDialogOpen,
            startRecording,
            stopRecording
        } = eventsStore;
        const { isPaidUser } = accountStore;
        const draftRuleGroups = rulesStore.draftRuleGroups;

        if (isRecording) {
            return <RecordingControlContainer className={props.className}>
                <RecordingLabel>
                    Recording{recordingName ? ` "${recordingName}"` : ''} — {recordedCount} captured
                </RecordingLabel>
                <RecordingStopButton onClick={stopRecording} title="Stop recording and keep the mock rules you captured">
                    Stop recording
                </RecordingStopButton>
            </RecordingControlContainer>;
        }

        return <RecordingControlContainer className={props.className}>
            <RecordingOptionLabel as="span" style={{ cursor: 'default' }}>
                Add to group:
                <RecordingSelect
                    value={recordingTargetGroupId}
                    onChange={e => setRecordingTargetGroupId(e.target.value)}
                    disabled={!isPaidUser}
                    title="Choose an existing rule group to add recorded mocks to, or use Default to create a new group (use Name below)"
                >
                    <option value="">Default / new group</option>
                    {draftRuleGroups.map(g => (
                        <option key={g.id} value={g.id}>{g.title}</option>
                    ))}
                </RecordingSelect>
            </RecordingOptionLabel>
            <RecordingNameInput
                placeholder={recordingTargetGroupId ? 'Ignored when group selected' : 'Name (optional)'}
                value={recordingNameDraft}
                onChange={e => setRecordingNameDraft(e.target.value)}
                disabled={!isPaidUser}
                title={recordingTargetGroupId ? 'Ignored when adding to an existing group' : 'Name for a new group (saved rules will be grouped under this name)'}
            />
            <RecordingActionButton
                disabled={!isPaidUser}
                onClick={() => setRecordingOptionsDialogOpen(true)}
                title="Recording options: only 2xx, match by URL only or full"
            >
                Options
            </RecordingActionButton>
            {recordingOptionsDialogOpen && (
                <>
                    <RecordingOptionsBackdrop onClick={() => setRecordingOptionsDialogOpen(false)} />
                    <RecordingOptionsDialog onClick={e => e.stopPropagation()}>
                        <RecordingOptionsTitle>Recording options</RecordingOptionsTitle>
                        <RecordingOptionsRow>
                            <RecordingOptionLabel title="Only record responses with status 2xx">
                                <input
                                    type="checkbox"
                                    checked={recordingOnlyOkResponses}
                                    onChange={e => setRecordingOnlyOkResponses(e.target.checked)}
                                    disabled={!isPaidUser}
                                />
                                Only 2xx responses
                            </RecordingOptionLabel>
                        </RecordingOptionsRow>
                        <RecordingOptionsRow>
                            <span style={{ fontSize: 'inherit' }}>Match by:</span>
                            <RecordingSelect
                                value={recordingMatchBy}
                                onChange={e => setRecordingMatchBy(e.target.value as 'url-only' | 'full')}
                                disabled={!isPaidUser}
                                title="URL only = method + path (easiest). Full = method + path + query + body."
                            >
                                <option value="url-only">URL only (easiest)</option>
                                <option value="full">Full (URL + query + body)</option>
                            </RecordingSelect>
                        </RecordingOptionsRow>
                        <RecordingOptionsWhitelistBlock>
                            <RecordingOptionsWhitelistLabel>
                                Only record URLs matching (one per line):
                            </RecordingOptionsWhitelistLabel>
                            <RecordingWhitelistTextarea
                                placeholder="Leave empty to record all. e.g. api.example.com or /api/users"
                                value={recordingUrlWhitelist}
                                onChange={e => setRecordingUrlWhitelist(e.target.value)}
                                disabled={!isPaidUser}
                                title="Only requests whose URL contains one of these strings will be recorded. Case-insensitive."
                            />
                        </RecordingOptionsWhitelistBlock>
                        <RecordingOptionsClose onClick={() => setRecordingOptionsDialogOpen(false)}>
                            Close
                        </RecordingOptionsClose>
                    </RecordingOptionsDialog>
                </>
            )}
            <RecordingStartButton
                disabled={!isPaidUser}
                onClick={() => startRecording()}
                title={
                    isPaidUser
                        ? 'Start recording: each response will be saved as a mock rule'
                        : 'With Pro: Record responses and save as mock rules'
                }
            >
                Start recording
            </RecordingStartButton>
        </RecordingControlContainer>;
    })
);