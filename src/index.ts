// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
//
// Original code forked from https://github.com/Quramy/ts-graphql-plugin

import { StyledTemplateLanguageService } from 'typescript-styled-plugin/lib/api';
import { decorateWithTemplateLanguageService, Logger, TemplateSettings } from 'typescript-template-language-service-decorator';
import * as ts from 'typescript/lib/tsserverlibrary';
import { getLanguageService, LanguageService as HtmlLanguageService } from 'vscode-html-languageservice';
import { pluginName } from './config';
import { loadConfiguration, TsHtmlPluginConfiguration } from './configuration';
import HtmlTemplateLanguageService from './html-template-language-service';
import { getSubstitutions } from './substitutions';
import { CssDocumentProvider, VirtualDocumentProvider } from './virtual-document-provider';

class LanguageServiceLogger implements Logger {
    constructor(
        private readonly info: ts.server.PluginCreateInfo
    ) { }

    public log(msg: string) {
        this.info.project.projectService.logger.info(`[${pluginName}] ${msg}`);
    }
}

class HtmlPlugin {
    private readonly _virtualDocumentProvider = new VirtualDocumentProvider();

    private _htmlLanguageService?: HtmlLanguageService;

    public constructor(
        private readonly _typescript: typeof ts
    ) { }

    public create(info: ts.server.PluginCreateInfo): ts.LanguageService {
        const logger = new LanguageServiceLogger(info);
        const config = loadConfiguration(info.config);

        logger.log('config: ' + JSON.stringify(config));

        const styledLanguageService = new StyledTemplateLanguageService(this._typescript, {} as any, new CssDocumentProvider(this.htmlLanguageService), logger);

        return decorateWithTemplateLanguageService(
            this._typescript,
            info.languageService,
            new HtmlTemplateLanguageService(this._typescript, config, this._virtualDocumentProvider, this.htmlLanguageService, styledLanguageService, logger),
            this.getTemplateSettings(config, this._virtualDocumentProvider),
            { logger });
    }

    private get htmlLanguageService(): HtmlLanguageService {
        if (!this._htmlLanguageService) {
            this._htmlLanguageService = getLanguageService();
        }
        return this._htmlLanguageService;
    }

    private getTemplateSettings(
        config: TsHtmlPluginConfiguration,
        provider: VirtualDocumentProvider
    ): TemplateSettings {
        return {
            tags: config.tags,
            enableForStringWithSubstitutions: true,
            getSubstitutions: (templateString, spans): string => {
                return getSubstitutions(this._typescript, this.htmlLanguageService, provider, templateString, spans);
            },
        };
    }
}

export = (mod: { typescript: typeof ts }) =>
    new HtmlPlugin(mod.typescript);
