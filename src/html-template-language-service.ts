// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
//
// Original code forked from https://github.com/Quramy/ts-graphql-plugin

import * as ts from 'typescript/lib/tsserverlibrary';
import { getLanguageService, LanguageService } from 'vscode-html-languageservice';
import * as vscode from 'vscode-languageserver-types';
import * as config from './config';
import { TsHtmlPluginConfiguration } from './configuration';
import { TemplateLanguageService, TemplateContext, Logger } from 'typescript-template-language-service-decorator';

export default class HtmlTemplateLanguageService implements TemplateLanguageService {

    private _htmlLanguageService?: LanguageService;

    constructor(
        private readonly typescript: typeof ts,
        private readonly configuration: TsHtmlPluginConfiguration,
        private readonly logger: Logger
    ) { }

    private get htmlLanguageService(): LanguageService {
        if (!this._htmlLanguageService) {
            this._htmlLanguageService = getLanguageService();
        }
        return this._htmlLanguageService;
    }

    public getCompletionsAtPosition(
        context: TemplateContext,
        position: ts.LineAndCharacter
    ): ts.CompletionInfo {
        const doc = this.createVirtualDocument(context);
        const htmlDoc = this.htmlLanguageService.parseHTMLDocument(doc);
        const items = this.htmlLanguageService.doComplete(doc, position, htmlDoc);
        return translateCompletionItems(this.typescript, items);
    }

    public getQuickInfoAtPosition(
        context: TemplateContext,
        position: ts.LineAndCharacter
    ): ts.QuickInfo | undefined {
        const doc = this.createVirtualDocument(context);
        const htmlDoc = this.htmlLanguageService.parseHTMLDocument(doc);
        const hover = this.htmlLanguageService.doHover(doc, position, htmlDoc);
        if (hover) {
            return this.translateHover(hover, position, context);
        }
        return undefined;
    }

    public getFormattingEditsForRange(
        context: TemplateContext,
        start: number,
        end: number,
        settings: ts.EditorSettings
    ): ts.TextChange[] {
        if (!this.configuration.format.enabled) {
            return [];
        }

        const doc = this.createVirtualDocument(context);
        const htmlDoc = this.htmlLanguageService.parseHTMLDocument(doc);

        // Make sure we don't get rid of leading newline
        const leading = context.text.match(/^\s*\n/);
        if (leading) {
            start += leading[0].length;
        }

        // or any trailing newlines
        const trailing = context.text.match(/\n\s*$/);
        if (trailing) {
            end -= trailing[0].length;
        }

        const range = this.toVsRange(context, start, end);
        const edits = this.htmlLanguageService.format(doc, range, {
            tabSize: settings.tabSize,
            insertSpaces: !!settings.convertTabsToSpaces,
            wrapLineLength: 120,
            unformatted: '',
            contentUnformatted: 'pre,code,textarea',
            indentInnerHtml: false,
            preserveNewLines: true,
            maxPreserveNewLines: null,
            indentHandlebars: false,
            endWithNewline: false,
            extraLiners: 'head, body, /html',
            wrapAttributes: 'auto',
        });

        return edits.map(vsedit => {
            return {
                span: this.toTsSpan(context, vsedit.range),
                newText: vsedit.newText,
            };
        });
    }

    private toVsRange(
        context: TemplateContext,
        start: number,
        end: number
    ): vscode.Range {
        return {
            start: context.toPosition(start),
            end: context.toPosition(end),
        };
    }

    private toTsSpan(
        context: TemplateContext,
        range: vscode.Range
    ): ts.TextSpan {
        const editStart = context.toOffset(range.start);
        const editEnd = context.toOffset(range.end);
        return {
            start: editStart,
            length: editEnd - editStart,
        };
    }

    private createVirtualDocument(
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

    private translateHover(
        hover: vscode.Hover,
        position: ts.LineAndCharacter,
        context: TemplateContext
    ): ts.QuickInfo {
        const contents: ts.SymbolDisplayPart[] = [];
        const convertPart = (hoverContents: typeof hover.contents) => {
            if (typeof hoverContents === 'string') {
                contents.push({ kind: 'unknown', text: hoverContents });
            } else if (Array.isArray(hoverContents)) {
                hoverContents.forEach(convertPart);
            } else {
                contents.push({ kind: 'unknown', text: hoverContents.value });
            }
        };
        convertPart(hover.contents);
        const start = context.toOffset(hover.range ? hover.range.start : position);
        return {
            kind: this.typescript.ScriptElementKind.unknown,
            kindModifiers: '',
            textSpan: {
                start,
                length: hover.range ? context.toOffset(hover.range.end) - start : 1,
            },
            displayParts: [],
            documentation: contents,
            tags: [],
        };
    }
}

function translateCompletionItems(
    typescript: typeof ts,
    items: vscode.CompletionList
): ts.CompletionInfo {
    return {
        isGlobalCompletion: false,
        isMemberCompletion: false,
        isNewIdentifierLocation: false,
        entries: items.items.map(x => translateCompetionEntry(typescript, x)),
    };
}

function translateCompetionEntry(
    typescript: typeof ts,
    item: vscode.CompletionItem
): ts.CompletionEntry {
    return {
        name: item.label,
        kindModifiers: '',
        kind: item.kind ? translateionCompletionItemKind(typescript, item.kind) : typescript.ScriptElementKind.unknown,
        sortText: '0',
    };
}

function translateionCompletionItemKind(
    typescript: typeof ts,
    kind: vscode.CompletionItemKind
): ts.ScriptElementKind {
    switch (kind) {
        case vscode.CompletionItemKind.Method:
            return typescript.ScriptElementKind.memberFunctionElement;
        case vscode.CompletionItemKind.Function:
            return typescript.ScriptElementKind.functionElement;
        case vscode.CompletionItemKind.Constructor:
            return typescript.ScriptElementKind.constructorImplementationElement;
        case vscode.CompletionItemKind.Field:
        case vscode.CompletionItemKind.Variable:
            return typescript.ScriptElementKind.variableElement;
        case vscode.CompletionItemKind.Class:
            return typescript.ScriptElementKind.classElement;
        case vscode.CompletionItemKind.Interface:
            return typescript.ScriptElementKind.interfaceElement;
        case vscode.CompletionItemKind.Module:
            return typescript.ScriptElementKind.moduleElement;
        case vscode.CompletionItemKind.Property:
            return typescript.ScriptElementKind.memberVariableElement;
        case vscode.CompletionItemKind.Unit:
        case vscode.CompletionItemKind.Value:
            return typescript.ScriptElementKind.constElement;
        case vscode.CompletionItemKind.Enum:
            return typescript.ScriptElementKind.enumElement;
        case vscode.CompletionItemKind.Keyword:
            return typescript.ScriptElementKind.keyword;
        case vscode.CompletionItemKind.Color:
            return typescript.ScriptElementKind.constElement;
        case vscode.CompletionItemKind.Reference:
            return typescript.ScriptElementKind.alias;
        case vscode.CompletionItemKind.File:
            return typescript.ScriptElementKind.moduleElement;
        case vscode.CompletionItemKind.Snippet:
        case vscode.CompletionItemKind.Text:
        default:
            return typescript.ScriptElementKind.unknown;
    }
}
