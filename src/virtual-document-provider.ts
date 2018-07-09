// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { TemplateContext } from 'typescript-template-language-service-decorator';
import * as vscode from 'vscode-languageserver-types';

export class VirtualDocumentProvider {
    public createVirtualDocument(
        context: TemplateContext
    ): vscode.TextDocument {
        const contents = context.text;
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
            lineCount: contents.split(/n/g).length + 1,
        };
    }
}