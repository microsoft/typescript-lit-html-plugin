// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
//
// Original code forked from https://github.com/Quramy/ts-graphql-plugin

import { StyledTemplateLanguageService } from 'typescript-styled-plugin/lib/api';
import { Logger, TemplateContext, TemplateLanguageService } from 'typescript-template-language-service-decorator';
import * as ts from 'typescript/lib/tsserverlibrary';
import { FoldingRange, LanguageService as HtmlLanguageService } from 'vscode-html-languageservice';
import * as vscode from 'vscode-languageserver-types';
import { Configuration } from './configuration';
import { getDocumentRegions } from './embeddedSupport';
import { VirtualDocumentProvider } from './virtual-document-provider';

const emptyCompletionList: vscode.CompletionList = {
    isIncomplete: false,
    items: [],
};

interface HtmlCachedCompletionList {
    type: 'html';
    value: vscode.CompletionList;
}

interface StyledCachedCompletionList {
    type: 'styled';
    value: ts.CompletionInfo;
}

class CompletionsCache {
    private _cachedCompletionsFile?: string;
    private _cachedCompletionsPosition?: ts.LineAndCharacter;
    private _cachedCompletionsContent?: string;
    private _completions?: HtmlCachedCompletionList | StyledCachedCompletionList;

    public getCached(
        context: TemplateContext,
        position: ts.LineAndCharacter
    ): HtmlCachedCompletionList | StyledCachedCompletionList | undefined {
        if (this._completions
            && context.fileName === this._cachedCompletionsFile
            && this._cachedCompletionsPosition && arePositionsEqual(position, this._cachedCompletionsPosition)
            && context.text === this._cachedCompletionsContent
        ) {
            return this._completions;
        }

        return undefined;
    }

    public updateCached(
        context: TemplateContext,
        position: ts.LineAndCharacter,
        completions: HtmlCachedCompletionList | StyledCachedCompletionList
    ) {
        this._cachedCompletionsFile = context.fileName;
        this._cachedCompletionsPosition = position;
        this._cachedCompletionsContent = context.text;
        this._completions = completions;
    }
}

export default class HtmlTemplateLanguageService implements TemplateLanguageService {
    private _completionsCache = new CompletionsCache();

    constructor(
        private readonly typescript: typeof ts,
        private readonly configuration: Configuration,
        private readonly virtualDocumentProvider: VirtualDocumentProvider,
        private readonly htmlLanguageService: HtmlLanguageService,
        private readonly styledLanguageService: StyledTemplateLanguageService,
        _logger: Logger
    ) { }

    public getCompletionsAtPosition(
        context: TemplateContext,
        position: ts.LineAndCharacter
    ): ts.CompletionInfo {
        const entry = this.getCompletionItems(context, position);
        if (entry.type === 'styled') {
            return entry.value;
        }
        return translateCompletionItemsToCompletionInfo(this.typescript, context, entry.value);
    }

    public getCompletionEntryDetails?(
        context: TemplateContext,
        position: ts.LineAndCharacter,
        name: string
    ): ts.CompletionEntryDetails {
        const entry = this.getCompletionItems(context, position);
        if (entry.type === 'styled') {
            return this.styledLanguageService.getCompletionEntryDetails!(context, position, name);
        }

        const item = entry.value.items.find(x => x.label === name);
        if (!item) {
            return {
                name,
                kind: this.typescript.ScriptElementKind.unknown,
                kindModifiers: '',
                tags: [],
                displayParts: toDisplayParts(name),
                documentation: [],
            };
        }
        return translateCompletionItemsToCompletionEntryDetails(this.typescript, item);
    }

    public getQuickInfoAtPosition(
        context: TemplateContext,
        position: ts.LineAndCharacter
    ): ts.QuickInfo | undefined {
        const document = this.virtualDocumentProvider.createVirtualDocument(context);
        const documentRegions = getDocumentRegions(this.htmlLanguageService, document);
        const languageId = documentRegions.getLanguageAtPosition(position);

        switch (languageId) {
            case 'html':
                const htmlDoc = this.htmlLanguageService.parseHTMLDocument(document);
                const hover = this.htmlLanguageService.doHover(document, position, htmlDoc);
                return hover ? this.translateHover(hover, position, context) : undefined;

            case 'css':
                return this.styledLanguageService.getQuickInfoAtPosition(context, position);
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

        // Disable formatting for blocks that contain a style tag
        //
        // Formatting styled blocks gets complex since we want to preserve interpolations inside the output
        // but we can't format content with `{` property.
        // The best fix would be to add `style` to `contentUnformatted` but
        // https://github.com/Microsoft/vscode-html-languageservice/issues/29 is causing problems and I'm not sure how
        // to work around it well
        if (context.text.match(/<style/g)) {
            return [];
        }

        const document = this.virtualDocumentProvider.createVirtualDocument(context);
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

        if (end <= start) {
            return [];
        }

        const range = this.toVsRange(context, start, end);
        const edits = this.htmlLanguageService.format(document, range, {
            tabSize: settings.tabSize,
            insertSpaces: !!settings.convertTabsToSpaces,
            wrapLineLength: 120,
            unformatted: '',
            contentUnformatted: 'pre,code,textarea',
            indentInnerHtml: false,
            preserveNewLines: true,
            maxPreserveNewLines: undefined,
            indentHandlebars: false,
            endWithNewline: false,
            extraLiners: 'head, body, /html',
            wrapAttributes: 'auto',
        });

        return edits.map(vsedit => toTsTextChange(context, vsedit));
    }

    public getSignatureHelpItemsAtPosition(
        _context: TemplateContext,
        _position: ts.LineAndCharacter
    ): ts.SignatureHelpItems | undefined {
        // Html does not support sig help
        return undefined;
    }

    public getOutliningSpans(
        context: TemplateContext
    ): ts.OutliningSpan[] {
        const document = this.virtualDocumentProvider.createVirtualDocument(context);
        const ranges = this.htmlLanguageService.getFoldingRanges(document);
        return ranges.map(range => this.translateOutliningSpan(context, range));
    }

    public getSemanticDiagnostics(
        context: TemplateContext
    ): ts.Diagnostic[] {
        return this.styledLanguageService.getSemanticDiagnostics(context);
    }

    public getSupportedCodeFixes(): number[] {
        return this.styledLanguageService.getSupportedCodeFixes();
    }

    public getCodeFixesAtPosition(
        context: TemplateContext,
        start: number,
        end: number,
        errorCodes: number[],
        format: ts.FormatCodeSettings
    ): ts.CodeAction[] {
        return this.styledLanguageService.getCodeFixesAtPosition(context, start, end, errorCodes, format);
    }

    public getReferencesAtPosition(
        context: TemplateContext,
        position: ts.LineAndCharacter
    ): ts.ReferenceEntry[] | undefined {
        const document = this.virtualDocumentProvider.createVirtualDocument(context);
        const htmlDoc = this.htmlLanguageService.parseHTMLDocument(document);
        const highlights = this.htmlLanguageService.findDocumentHighlights(document, position, htmlDoc);
        return highlights.map(highlight => ({
            fileName: context.fileName,
            textSpan: toTsSpan(context, highlight.range),
        } as ts.ReferenceEntry));
    }

    public getJsxClosingTagAtPosition(
        context: TemplateContext,
        position: ts.LineAndCharacter
    ): ts.JsxClosingTagInfo | undefined {
        const document = this.virtualDocumentProvider.createVirtualDocument(context);
        const htmlDocument = this.htmlLanguageService.parseHTMLDocument(document);
        const tagComplete = this.htmlLanguageService.doTagComplete(document, position, htmlDocument);
        if (!tagComplete) {
            return undefined;
        }
        // Html returns completions with snippet placeholders. Strip these out.
        return {
            newText: tagComplete.replace(/\$\d/g, ''),
        };
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

    private getCompletionItems(
        context: TemplateContext,
        position: ts.LineAndCharacter
    ): HtmlCachedCompletionList | StyledCachedCompletionList {
        const cached = this._completionsCache.getCached(context, position);
        if (cached) {
            return cached;
        }

        const document = this.virtualDocumentProvider.createVirtualDocument(context);
        const documentRegions = getDocumentRegions(this.htmlLanguageService, document);
        const languageId = documentRegions.getLanguageAtPosition(position);

        switch (languageId) {
            case 'html':
                {
                    const htmlDoc = this.htmlLanguageService.parseHTMLDocument(document);
                    const htmlCompletions: HtmlCachedCompletionList = {
                        type: 'html',
                        value: this.htmlLanguageService.doComplete(document, position, htmlDoc) || emptyCompletionList,
                    };
                    this._completionsCache.updateCached(context, position, htmlCompletions);
                    return htmlCompletions;
                }
            case 'css':
                {
                    const styledCompletions: StyledCachedCompletionList = {
                        type: 'styled',
                        value: this.styledLanguageService.getCompletionsAtPosition(context, position),
                    };
                    this._completionsCache.updateCached(context, position, styledCompletions);
                    return styledCompletions;
                }
        }

        const completions: HtmlCachedCompletionList = {
            type: 'html',
            value: emptyCompletionList,
        };
        this._completionsCache.updateCached(context, position, completions);
        return completions;
    }

    private translateHover(
        hover: vscode.Hover,
        position: ts.LineAndCharacter,
        context: TemplateContext
    ): ts.QuickInfo {
        const header: ts.SymbolDisplayPart[] = [];
        const docs: ts.SymbolDisplayPart[] = [];
        const convertPart = (hoverContents: typeof hover.contents) => {
            if (typeof hoverContents === 'string') {
                docs.push({ kind: 'unknown', text: hoverContents });
            } else if (Array.isArray(hoverContents)) {
                hoverContents.forEach(convertPart);
            } else {
                header.push({ kind: 'unknown', text: hoverContents.value });
            }
        };
        convertPart(hover.contents);
        const start = context.toOffset(hover.range ? hover.range.start : position);
        return {
            kind: this.typescript.ScriptElementKind.string,
            kindModifiers: '',
            textSpan: {
                start,
                length: hover.range ? context.toOffset(hover.range.end) - start : 1,
            },
            displayParts: header,
            documentation: docs,
            tags: [],
        };
    }

    private translateOutliningSpan(
        context: TemplateContext,
        range: FoldingRange
    ): ts.OutliningSpan {
        const startOffset = context.toOffset({ line: range.startLine, character: range.startCharacter || 0 });
        const endOffset = context.toOffset({ line: range.endLine, character: range.endCharacter || 0 });
        const span = {
            start: startOffset,
            length: endOffset - startOffset,
        };

        return {
            autoCollapse: false,
            kind: this.typescript.OutliningSpanKind.Code,
            bannerText: '',
            textSpan: span,
            hintSpan: span,
        };
    }
}

function translateCompletionItemsToCompletionInfo(
    typescript: typeof ts,
    context: TemplateContext,
    items: vscode.CompletionList
): ts.CompletionInfo {
    return {
        isGlobalCompletion: false,
        isMemberCompletion: false,
        isNewIdentifierLocation: false,
        entries: items.items.map(x => translateCompetionEntry(typescript, context, x)),
    };
}

function translateCompletionItemsToCompletionEntryDetails(
    typescript: typeof ts,
    item: vscode.CompletionItem
): ts.CompletionEntryDetails {
    return {
        name: item.label,
        kindModifiers: 'declare',
        kind: item.kind ? translateionCompletionItemKind(typescript, item.kind) : typescript.ScriptElementKind.unknown,
        displayParts: toDisplayParts(item.detail),
        documentation: toDisplayParts(item.documentation),
        tags: [],
    };
}

function translateCompetionEntry(
    typescript: typeof ts,
    context: TemplateContext,
    vsItem: vscode.CompletionItem
): ts.CompletionEntry {
    const kind = vsItem.kind ? translateionCompletionItemKind(typescript, vsItem.kind) : typescript.ScriptElementKind.unknown;
    const entry: ts.CompletionEntry = {
        name: vsItem.label,
        kind,
        sortText: '0',
    };

    if (vsItem.textEdit) {
        entry.insertText = vsItem.textEdit.newText;
        entry.replacementSpan = toTsSpan(context, vsItem.textEdit.range);
    }

    return entry;
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

function toDisplayParts(
    text: string | vscode.MarkupContent | undefined
): ts.SymbolDisplayPart[] {
    if (!text) {
        return [];
    }
    return [{
        kind: 'text',
        text: typeof text === 'string' ? text : text.value,
    }];
}

function arePositionsEqual(
    left: ts.LineAndCharacter,
    right: ts.LineAndCharacter
): boolean {
    return left.line === right.line && left.character === right.character;
}

function toTsSpan(
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

function toTsTextChange(
    context: TemplateContext,
    vsedit: vscode.TextEdit
) {
    return {
        span: toTsSpan(context, vsedit.range),
        newText: vsedit.newText,
    };
}