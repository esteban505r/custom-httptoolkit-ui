import * as _ from 'lodash';
import * as React from 'react';
import { action, flow, observable } from 'mobx';
import { observer, inject } from "mobx-react";
import type { OpenAPIObject } from 'openapi-directory';
import * as semver from 'semver';
import * as yaml from 'yaml';
import * as swagger2OpenApi from 'swagger2openapi';

import { styled } from '../../styles';
import { Icon } from '../../icons';
import { uploadFile } from '../../util/ui';
import { attempt } from '../../util/promise';
import { asError } from '../../util/error';
import { trackEvent } from '../../metrics';

import { buildApiMetadataAsync } from '../../services/ui-worker-api';

import {
    CollapsibleCard,
    CollapsibleCardHeading,
    CollapsibleCardProps
} from "../common/card";
import { SettingsButton, SettingsExplanation } from './settings-components';
import { TextInput } from '../common/inputs';
import { ApiStore } from '../../model/api/api-store';
import { RulesStore } from '../../model/rules/rules-store';
import { ContentLabel } from '../common/text-content';
import { ApiMetadata } from '../../model/api/api-interfaces';
import {
    endpointListFileToOpenApi,
    endpointListHasMockResponses,
    isHttptoolkitEndpointsFile,
    type HttptoolkitEndpointsFile
} from '../../util/endpoint-list-import';
import { buildMockRulesFromEndpointList } from '../../util/endpoint-list-mock-rules';

const UploadSpecButton = styled(SettingsButton).attrs(() => ({
    type: 'submit'
}))`
    grid-column: 1 / span 3;
`;

const ImportEndpointListButton = styled(SettingsButton).attrs(() => ({
    type: 'submit'
}))`
    grid-column: 1 / span 3;
`;

const BaseUrlInput = styled(TextInput)`
    align-self: stretch;
`;

const SavedBaseUrl = styled.div`
    font-family: ${p => p.theme.monoFontFamily};
`;

const Spec = styled.div`
    grid-column: 2;
    font-style: italic;

    display: flex;
    align-items: baseline;
`;

const UndoButton = styled(SettingsButton)`
    margin-left: auto;
`;

const AddButton = styled(SettingsButton)``;

const DeleteButton = styled(SettingsButton)``;

const ApiRows = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr min-content;
    grid-gap: 10px;
    margin: 10px 0;
    align-items: baseline;
`;

function updateValidationMessage(element: HTMLInputElement | HTMLButtonElement, message?: string) {
    element.setCustomValidity(message || '');
    element.reportValidity();
}

@inject('apiStore', 'rulesStore')
@observer
export class ApiSettingsCard extends React.Component<
    CollapsibleCardProps & {
        apiStore?: ApiStore
        rulesStore?: RulesStore
    }
> {

    @observable.ref
    private selectedSpec: OpenAPIObject | undefined;

    /** When set, saving the API also adds mock rules from this endpoint-list file. */
    @observable.ref
    private pendingEndpointListForMocks: HttptoolkitEndpointsFile | undefined;
    private uploadSpecButtonRef = React.createRef<HTMLButtonElement>();
    private importEndpointListButtonRef = React.createRef<HTMLButtonElement>();

    @observable
    private specProcessingInProgress = false;

    @observable
    private enteredBaseUrl = "";
    private baseUrlInputRef = React.createRef<HTMLInputElement>();

    @observable
    private baseUrlError: Error | undefined;

    render() {
        const { apiStore, ...cardProps } = this.props;

        return <CollapsibleCard {...cardProps}>
            <header>
                <CollapsibleCardHeading onCollapseToggled={
                    cardProps.onCollapseToggled
                }>
                    API Settings
                </CollapsibleCardHeading>
            </header>

            <ContentLabel>
                OpenAPI specifications
            </ContentLabel>

            <ApiRows>
                {
                    _.map(apiStore!.customOpenApiInfo, (spec, baseUrl) =>
                        <React.Fragment key={baseUrl}>
                            <SavedBaseUrl>
                                { baseUrl }
                            </SavedBaseUrl>
                            <Spec>
                                { spec.info.title }
                            </Spec>
                            <DeleteButton onClick={() => this.deleteApi(baseUrl)}>
                                <Icon icon={['far', 'trash-alt']} />
                            </DeleteButton>
                        </React.Fragment>
                    )
                }

                { !this.selectedSpec
                    ? <>
                        <UploadSpecButton
                            type='submit' // Ensures we can show validation messages here
                            onClick={this.specProcessingInProgress ? undefined : this.uploadSpec}
                            ref={this.uploadSpecButtonRef}
                        >
                            { this.specProcessingInProgress
                                ? <Icon icon={['fas', 'spinner']} spin />
                                : "Load an OpenAPI or Swagger spec"
                            }
                        </UploadSpecButton>
                        <ImportEndpointListButton
                            type='submit'
                            onClick={this.specProcessingInProgress ? undefined : this.importEndpointList}
                            ref={this.importEndpointListButtonRef}
                        >
                            { this.specProcessingInProgress
                                ? <Icon icon={['fas', 'spinner']} spin />
                                : "Import endpoint list file"
                            }
                        </ImportEndpointListButton>
                    </>
                    : <>
                        <BaseUrlInput
                            placeholder="Base URL for requests to match against this spec"
                            value={this.enteredBaseUrl}
                            onChange={(e) => this.onBaseUrl(e.target.value)}
                            ref={this.baseUrlInputRef}
                        />
                        <Spec>
                            { this.selectedSpec.info.title }
                            <UndoButton onClick={this.resetApiInputs}>
                                <Icon icon={['fas', 'undo']} />
                            </UndoButton>
                        </Spec>
                        <AddButton
                            disabled={!this.selectedSpec || !this.enteredBaseUrl || !!this.baseUrlError}
                            onClick={this.saveApi}
                        >
                            <Icon icon={['fas', 'save']} />
                        </AddButton>
                    </>
                }
            </ApiRows>

            <SettingsExplanation>
                APIs here will provide documentation & validation for all matching
                requests within their base URL. Use “Import endpoint list file” for JSON
                from the list-project-endpoints Cursor skill. If entries include a
                “response” object, saving the API also adds matching mock rules (fixed
                responses) for simulation.
            </SettingsExplanation>
            <SettingsExplanation>
                HTTP Toolkit also includes built-in specifications for 2600+ popular public APIs.
            </SettingsExplanation>
        </CollapsibleCard>
    }

    uploadSpec = flow(function * (this: ApiSettingsCard) {
        updateValidationMessage(this.uploadSpecButtonRef.current!);

        try {
            const file: string = yield uploadFile('text', ['.json', '.yaml']);
            if (!file) return;

            this.specProcessingInProgress = true;
            let content: any = yield attempt(() =>
                JSON.parse(file)
            ).catch(() =>
                yaml.parse(file)
            ).catch((e) => {
                console.warn('OpenAPI spec parsing error:', e);
                throw new Error('File could not be parsed as either YAML or JSON')
            });

            this.pendingEndpointListForMocks = undefined;

            let openApiSpec: OpenAPIObject;

            if (content.swagger === "2.0") {
                openApiSpec = yield new Promise((resolve, reject) => {
                    swagger2OpenApi.convertObj(content, {
                        patch: true,
                        resolve: false
                    }, (error, result) => {
                        if (error) return reject(error);

                        if (result.warnings && result.warnings.length) {
                            console.warn("Some issues found whilst parsing spec:");
                            result.warnings.forEach(w => console.warn(w));
                        }

                        resolve(result.openapi);
                    });
                });
            } else if (content.openapi && semver.satisfies(content.openapi, '^3')) {
                openApiSpec = content;
            } else if (isHttptoolkitEndpointsFile(content)) {
                throw new Error(
                    'This file is an endpoint list for HTTP Toolkit. ' +
                    'Use “Import endpoint list file” below instead.'
                );
            } else {
                throw new Error("This file doesn't contain an OpenAPI v3 or Swagger v2 specification");
            }

            // Build the API just to test that we *can* (we'll rebuild with the base URL later)
            yield buildApiMetadataAsync(openApiSpec, [
                'api.build.example' // Need a default base here in case the spec has no servers
            ]);

            this.selectedSpec = openApiSpec;

            const { servers } = openApiSpec;
            if (servers && servers.length >= 1) {
                let { url, variables } = servers[0];

                if (variables) {
                    Object.entries(variables).forEach(([variableName, variable]) => {
                        url = url.replace(`{${variableName}}`, variable.default.toString());
                    });
                }

                // Delay because we need the input to appear so that the ref() is set
                requestAnimationFrame(() => this.onBaseUrl(url));
            }
        } catch (e) {
            console.log(e);
            updateValidationMessage(this.uploadSpecButtonRef.current!, asError(e).message);
        } finally {
            this.specProcessingInProgress = false;
        }
    }).bind(this);

    importEndpointList = flow(function * (this: ApiSettingsCard) {
        updateValidationMessage(this.importEndpointListButtonRef.current!);

        try {
            const file: string = yield uploadFile('text', ['.json']);
            if (!file) return;

            this.specProcessingInProgress = true;
            const content: any = yield attempt(() =>
                JSON.parse(file)
            ).catch(() =>
                yaml.parse(file)
            ).catch((e) => {
                console.warn('Endpoint list parse error:', e);
                throw new Error('File could not be parsed as either YAML or JSON');
            });

            if (!isHttptoolkitEndpointsFile(content)) {
                throw new Error(
                    'Not a valid endpoint list file. It must include ' +
                    '"httptoolkitEndpoints": "1", "baseUrl", and "endpoints". ' +
                    'Use the list-project-endpoints Cursor skill to generate one.'
                );
            }

            this.pendingEndpointListForMocks = endpointListHasMockResponses(content)
                ? content
                : undefined;

            const openApiSpec = endpointListFileToOpenApi(content);

            yield buildApiMetadataAsync(openApiSpec, [
                'api.build.example'
            ]);

            this.selectedSpec = openApiSpec;

            const { servers } = openApiSpec;
            if (servers && servers.length >= 1) {
                let { url, variables } = servers[0];

                if (variables) {
                    Object.entries(variables).forEach(([variableName, variable]) => {
                        url = url.replace(`{${variableName}}`, variable.default.toString());
                    });
                }

                requestAnimationFrame(() => this.onBaseUrl(url));
            }
        } catch (e) {
            console.log(e);
            updateValidationMessage(
                this.importEndpointListButtonRef.current!,
                asError(e).message
            );
        } finally {
            this.specProcessingInProgress = false;
        }
    }).bind(this);

    validateBaseUrl(baseUrl: string) {
        if (baseUrl.startsWith('/')) throw new Error("Base URLs must specify a host");

        if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
            // We allow users to include a protocol (though we'll ignore it and drop it later)
            baseUrl = 'https://' + baseUrl;
        }

        const url = new URL(baseUrl);

        // If you do include a protocol though, it better be HTTP(S)
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Base URLs must be HTTP or HTTPS");

        if (url.search) throw new Error("Base URLs can't contain query parameters");
        if (url.hash) throw new Error("Base URLs can't contain hash fragments");

        // Verify we don't have the same URL already, or the same URL without a protocol:
        const existingBaseUrls = Object.keys(this.props.apiStore!.customOpenApiInfo);
        const protocollessUrl = baseUrl.replace(/^https?:\/\//, '');
        if (existingBaseUrls.includes(protocollessUrl)) {
            throw new Error("This URL is already mapped to an API");
        }
    }

    @action.bound
    onBaseUrl(baseUrl: string) {
        this.enteredBaseUrl = baseUrl;

        const input = this.baseUrlInputRef.current!;
        try {
            this.validateBaseUrl(baseUrl);
            this.baseUrlError = undefined;
            updateValidationMessage(input);
        } catch (e) {
            this.baseUrlError = asError(e);
            updateValidationMessage(input,
                e instanceof TypeError
                    ? "Not a valid URL"
                    : asError(e).message
            );
        }
    }

    saveApi = flow(function * (this: ApiSettingsCard) {
        const baseUrl = this.enteredBaseUrl.replace(/https?:\/\//, '');
        const baseUrlForMocks = this.enteredBaseUrl;

        const api: ApiMetadata = yield buildApiMetadataAsync(
            this.selectedSpec!,
            ['http://' + baseUrl, 'https://' + baseUrl]
        );
        this.props.apiStore!.addCustomApi(baseUrl, api);
        trackEvent({ category: "Config", action: "Add API spec" });

        const pendingMocks = this.pendingEndpointListForMocks;
        this.pendingEndpointListForMocks = undefined;

        if (pendingMocks) {
            try {
                const mockRules = buildMockRulesFromEndpointList(pendingMocks, baseUrlForMocks);
                if (mockRules.length) {
                    const groupTitle = `${pendingMocks.title?.trim() || 'Imported API'} mocks`;
                    this.props.rulesStore!.addImportedMockRulesGroup(groupTitle, mockRules);
                    trackEvent({ category: "Config", action: "Add endpoint list mock rules" });
                }
            } catch (e) {
                console.error(e);
                window.alert(
                    `API spec was saved, but mock rules could not be created: ${asError(e).message}`
                );
            }
        }

        this.enteredBaseUrl = "";
        this.selectedSpec = undefined;
    }).bind(this);

    @action.bound
    resetApiInputs() {
        this.enteredBaseUrl = "";
        this.baseUrlError = undefined;
        this.selectedSpec = undefined;
        this.pendingEndpointListForMocks = undefined;
    }

    @action.bound
    deleteApi(baseUrl: string) {
        this.props.apiStore!.deleteCustomApi(baseUrl);
    }
}