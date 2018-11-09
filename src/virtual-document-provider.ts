// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { TemplateContext } from 'typescript-template-language-service-decorator';
import * as vscode from 'vscode-languageserver-types';
import { VirtualDocumentProvider as StyledVirtualDocumentProvider } from '../node_modules/typescript-styled-plugin/lib/_virtual-document-provider';
import { LanguageService } from 'vscode-html-languageservice';
import { getDocumentRegions } from './embeddedSupport';

export class VirtualDocumentProvider implements StyledVirtualDocumentProvider {
    public createVirtualDocument(
        context: TemplateContext,
        useRawText: boolean = false
    ): vscode.TextDocument {
        const contents = useRawText ? context.rawText : context.text;
        return {
            uri: 'untitled://embedded.html',
            languageId: 'html',
            version: 1,
            getText: () => contents,
            positionAt: (offset: number) => {
                return context.toPosition(offset);
            },
            offsetAt: (p: vscode.Position) => {
                return context.toOffset(p);
            },
            lineCount: contents.split(/\n/g).length + 1,
        };
    }

    public toVirtualDocPosition(position: ts.LineAndCharacter): ts.LineAndCharacter {
        return position;
    }

    public fromVirtualDocPosition(position: ts.LineAndCharacter): ts.LineAndCharacter {
        return position;
    }

    public toVirtualDocOffset(offset: number): number {
        return offset;
    }

    public fromVirtualDocOffset(offset: number): number {
        return offset;
    }
}

export class CssDocumentProvider extends VirtualDocumentProvider {
    public constructor(
        private readonly htmlLanguageService: LanguageService
    ) {
        super();
    }

    public createVirtualDocument(
        context: TemplateContext
    ): vscode.TextDocument {
        const regions = getDocumentRegions(this.htmlLanguageService, new VirtualDocumentProvider().createVirtualDocument(context));
        return regions.getEmbeddedDocument('css');
    }
}
