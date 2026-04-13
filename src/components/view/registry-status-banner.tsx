import * as React from 'react';
import { observer, inject } from 'mobx-react';

import { styled } from '../../styles';
import { Icon } from '../../icons';
import { RegistryStore } from '../../registry/registry-store';

const Banner = styled.div<{ $variant: 'loading' | 'ok' | 'err' | 'hidden' }>`
    display: ${(p) => (p.$variant === 'hidden' ? 'none' : 'flex')};
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    padding: 6px 12px;
    font-size: ${(p) => p.theme.textSize};
    border-bottom: 1px solid ${(p) => p.theme.containerBorder};
    background: ${(p) =>
        p.$variant === 'err'
            ? p.theme.mainLowlightBackground
            : p.theme.containerBackground};
    color: ${(p) => p.theme.mainColor};
`;

const Spinner = styled(Icon).attrs(() => ({
    icon: ['fas', 'spinner'],
    spin: true
}))`
    font-size: 90%;
`;

@inject('registryStore')
@observer
export class RegistryStatusBanner extends React.Component<{
    registryStore?: RegistryStore;
}> {
    render() {
        const store = this.props.registryStore;
        if (!store) return null;

        const { registryStatus, registryLoadError, registry, lastLoadedSource, hotReloadActive } = store;

        if (registryStatus === 'idle') {
            return <Banner $variant="hidden" role="status" />;
        }

        if (registryStatus === 'loading') {
            return (
                <Banner $variant="loading" role="status">
                    <Spinner />
                    Loading API registry…
                </Banner>
            );
        }

        if (registryStatus === 'error') {
            return (
                <Banner $variant="err" role="alert">
                    Registry error: {registryLoadError}
                </Banner>
            );
        }

        const epCount =
            registry?.services.reduce((n, s) => n + s.endpoints.length, 0) ?? 0;
        const srcPreview =
            (lastLoadedSource ?? '').length > 80
                ? `${(lastLoadedSource ?? '').slice(0, 80)}…`
                : lastLoadedSource ?? '';

        return (
            <Banner $variant="ok" role="status">
                API registry: {registry?.services.length ?? 0} service(s), {epCount} endpoint(s).
                {hotReloadActive && ' Polling for updates.'}
                {srcPreview && (
                    <span style={{ opacity: 0.85, fontFamily: 'monospace', marginLeft: 6 }} title={lastLoadedSource ?? ''}>
                        ({srcPreview})
                    </span>
                )}
            </Banner>
        );
    }
}
