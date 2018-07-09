// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
//
// Original code forked from https://github.com/Quramy/ts-graphql-plugin

import * as ts from 'typescript/lib/tsserverlibrary';
import HtmlTemplateLanguageService from './html-template-language-service';
import { decorateWithTemplateLanguageService, Logger } from 'typescript-template-language-service-decorator';
import { pluginName } from './config';
import { loadConfiguration } from './configuration';
import { getSubstitutions } from './substitutions';
import { getLanguageService } from 'vscode-html-languageservice';
import { VirtualDocumentProvider } from './virtual-document-provider';

class LanguageServiceLogger implements Logger {
    constructor(
        private readonly info: ts.server.PluginCreateInfo
    ) { }

    public log(msg: string) {
        this.info.project.projectService.logger.info(`[${pluginName}] ${msg}`);
    }
}

export = (mod: { typescript: typeof ts }) => {
    return {
        create(info: ts.server.PluginCreateInfo): ts.LanguageService {
            const logger = new LanguageServiceLogger(info);
            const config = loadConfiguration(info.config);

            logger.log('config: ' + JSON.stringify(config));

            const htmlLanguageService = getLanguageService();
            const provider = new VirtualDocumentProvider();

            return decorateWithTemplateLanguageService(mod.typescript, info.languageService, new HtmlTemplateLanguageService(mod.typescript, config, logger), {
                tags: config.tags,
                enableForStringWithSubstitutions: true,
                getSubstitutions(templateString, spans): string {
                    return getSubstitutions(mod.typescript, htmlLanguageService, provider, templateString, spans);
                },
            }, { logger });
        },
    };
};
