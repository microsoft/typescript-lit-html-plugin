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
        return translateCompletionItems(items);
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
        end: number
    ): ts.TextChange[] {
        const doc = this.createVirtualDocument(context);
        const htmlDoc = this.htmlLanguageService.parseHTMLDocument(doc);

        // Make sure we don't get rid of leading newline
        const leading = context.text.match(/^\s*\n/);
        if (leading) {
            start += leading.length;
        }

        const range = this.toVsRange(context, start, end);
        const edits = this.htmlLanguageService.format(doc, range, {
            tabSize: 4,
            insertSpaces: true,
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
            kind: ts.ScriptElementKind.unknown,
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

function translateCompletionItems(items: vscode.CompletionList): ts.CompletionInfo {
    return {
        isGlobalCompletion: false,
        isMemberCompletion: false,
        isNewIdentifierLocation: false,
        entries: items.items.map(translateCompetionEntry),
    };
}

function translateCompetionEntry(item: vscode.CompletionItem): ts.CompletionEntry {
    return {
        name: item.label,
        kindModifiers: '',
        kind: item.kind ? translateionCompletionItemKind(item.kind) : ts.ScriptElementKind.unknown,
        sortText: '0',
    };
}

function translateionCompletionItemKind(kind: vscode.CompletionItemKind): ts.ScriptElementKind {
    switch (kind) {
        case vscode.CompletionItemKind.Method:
            return ts.ScriptElementKind.memberFunctionElement;
        case vscode.CompletionItemKind.Function:
            return ts.ScriptElementKind.functionElement;
        case vscode.CompletionItemKind.Constructor:
            return ts.ScriptElementKind.constructorImplementationElement;
        case vscode.CompletionItemKind.Field:
        case vscode.CompletionItemKind.Variable:
            return ts.ScriptElementKind.variableElement;
        case vscode.CompletionItemKind.Class:
            return ts.ScriptElementKind.classElement;
        case vscode.CompletionItemKind.Interface:
            return ts.ScriptElementKind.interfaceElement;
        case vscode.CompletionItemKind.Module:
            return ts.ScriptElementKind.moduleElement;
        case vscode.CompletionItemKind.Property:
            return ts.ScriptElementKind.memberVariableElement;
        case vscode.CompletionItemKind.Unit:
        case vscode.CompletionItemKind.Value:
            return ts.ScriptElementKind.constElement;
        case vscode.CompletionItemKind.Enum:
            return ts.ScriptElementKind.enumElement;
        case vscode.CompletionItemKind.Keyword:
            return ts.ScriptElementKind.keyword;
        case vscode.CompletionItemKind.Color:
            return ts.ScriptElementKind.constElement;
        case vscode.CompletionItemKind.Reference:
            return ts.ScriptElementKind.alias;
        case vscode.CompletionItemKind.File:
            return ts.ScriptElementKind.moduleElement;
        case vscode.CompletionItemKind.Snippet:
        case vscode.CompletionItemKind.Text:
        default:
            return ts.ScriptElementKind.unknown;
    }
}

function translateSeverity(severity: vscode.DiagnosticSeverity | undefined): ts.DiagnosticCategory {
    switch (severity) {
        case vscode.DiagnosticSeverity.Information:
        case vscode.DiagnosticSeverity.Hint:
            return ts.DiagnosticCategory.Message;

        case vscode.DiagnosticSeverity.Warning:
            return ts.DiagnosticCategory.Warning;

        case vscode.DiagnosticSeverity.Error:
        default:
            return ts.DiagnosticCategory.Error;
    }
}