import * as React from 'react';
import { observer, inject } from 'mobx-react';
import { action, observable } from 'mobx';

import { styled } from '../../styles';
import { RegistryStore } from '../../registry/registry-store';
import {
    CollapsibleCard,
    CollapsibleCardHeading,
    CollapsibleCardProps
} from '../common/card';
import { SettingsButton, SettingsExplanation } from './settings-components';
import { TextInput } from '../common/inputs';

const Grid = styled.div`
    display: grid;
    grid-template-columns: 1fr auto auto;
    grid-gap: 10px;
    align-items: center;
    margin: 10px 0;
`;

const WideInput = styled(TextInput)`
    grid-column: 1 / -1;
`;

const PollRow = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
`;

const PollIntervalInput = styled(TextInput)`
    width: 5em;
`;

@inject('registryStore')
@observer
export class RegistrySettingsCard extends React.Component<
    CollapsibleCardProps & {
        registryStore?: RegistryStore;
    }
> {
    @observable
    private sourceInput = '';

    @observable
    private pollMs = 30;

    constructor(props: CollapsibleCardProps & { registryStore?: RegistryStore }) {
        super(props);
        this.sourceInput = props.registryStore?.lastLoadedSource ?? '';
    }

    @action.bound
    private setSourceInput(v: string) {
        this.sourceInput = v;
    }

    @action.bound
    private setPollMs(v: number) {
        this.pollMs = v;
    }

    private load = () => {
        void this.props.registryStore!.loadRegistry(this.sourceInput);
    };

    private reload = () => {
        void this.props.registryStore!.reloadRegistry();
    };

    render() {
        const { registryStore, ...cardProps } = this.props;
        if (!registryStore) return null;

        const { registryStatus, registryLoadError, lastLoadedSource, hotReloadActive } = registryStore;
        const canHotReload = /^https?:\/\//i.test((lastLoadedSource ?? '').trim());

        return (
            <CollapsibleCard {...cardProps}>
                <header>
                    <CollapsibleCardHeading onCollapseToggled={cardProps.onCollapseToggled}>
                        API registry (.api.json)
                    </CollapsibleCardHeading>
                </header>

                <SettingsExplanation>
                    Load a catalog to annotate traffic on the View page. Use an HTTPS URL (for example
                    raw Git), paste JSON, or rely on a future desktop file bridge for local paths.
                </SettingsExplanation>

                <Grid>
                    <WideInput
                        value={this.sourceInput}
                        onChange={(e) => this.setSourceInput(e.target.value)}
                        placeholder="https://…/api.json or paste { … }"
                        spellCheck={false}
                    />
                    <SettingsButton type="button" onClick={this.load} disabled={!this.sourceInput.trim()}>
                        Load
                    </SettingsButton>
                    <SettingsButton
                        type="button"
                        onClick={this.reload}
                        disabled={registryStatus === 'idle' || registryStatus === 'loading'}
                    >
                        Reload
                    </SettingsButton>
                </Grid>

                <SettingsExplanation>
                    <strong>Status:</strong>{' '}
                    {registryStatus === 'idle' && 'No registry loaded.'}
                    {registryStatus === 'loading' && 'Loading…'}
                    {registryStatus === 'loaded' &&
                        registryStore.registry &&
                        `Loaded ${registryStore.registry.services.length} service(s), ${registryStore.registry.services.reduce(
                            (n, s) => n + s.endpoints.length,
                            0
                        )} endpoint(s).`}
                    {registryStatus === 'error' && (
                        <span title={registryLoadError ?? ''}>Error: {registryLoadError}</span>
                    )}
                </SettingsExplanation>

                {registryStore.loadWarnings.length > 0 && (
                    <SettingsExplanation>
                        Warnings: {registryStore.loadWarnings.join(' ')}
                    </SettingsExplanation>
                )}

                <PollRow>
                    <label>
                        <input
                            type="checkbox"
                            checked={hotReloadActive}
                            disabled={!canHotReload || registryStatus === 'loading'}
                            onChange={(e) => {
                                if (e.target.checked) {
                                    registryStore.startHotReload(this.pollMs * 1000);
                                } else {
                                    registryStore.stopHotReload();
                                }
                            }}
                        />{' '}
                        Poll URL for changes (dev)
                    </label>
                    <span>every</span>
                    <PollIntervalInput
                        type="number"
                        min={5}
                        step={5}
                        value={String(this.pollMs)}
                        onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!Number.isNaN(v) && v >= 5) {
                                this.setPollMs(v);
                                if (hotReloadActive) {
                                    registryStore.stopHotReload();
                                    registryStore.startHotReload(v * 1000);
                                }
                            }
                        }}
                        disabled={!canHotReload}
                    />
                    <span>s</span>
                </PollRow>
            </CollapsibleCard>
        );
    }
}
