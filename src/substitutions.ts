import { getTemplateSettings } from 'typescript-styled-plugin/lib/api';
import { LanguageService } from 'vscode-html-languageservice';
import { getDocumentRegions } from './embeddedSupport';
import { VirtualDocumentProvider } from './virtual-document-provider';
import { TemplateContext } from '../node_modules/typescript-template-language-service-decorator';
import * as ts from 'typescript/lib/tsserverlibrary';

class NoopTemplateContext implements TemplateContext {

    public readonly fileName = 'x.css';
    public readonly rawText: string;

    constructor(
        public readonly typescript: typeof ts,
        public readonly text: string
    ) {
        this.rawText = text;
    }

    get node(): never {
        throw new Error('Not supported');
    }

    public toOffset(location: ts.LineAndCharacter): number {
        let line = 0;
        let character = 0;
        for (let offset = 0; ; ++offset) {
            if (line >= location.line && character >= location.character) {
                return offset;
            }
            if (this.text[offset] === '\n') {
                ++line;
                character = 0;
            } else {
                ++character;
            }
        }
    }

    public toPosition(offset: number): ts.LineAndCharacter {
        let line = 0;
        let character = 0;
        for (let i = 0; i < offset; ++i) {
            if (this.text[i] === '\n') {
                ++line;
                character = 0;
            } else {
                ++character;
            }
        }
        return { line, character };
    }
}

export function getSubstitutions(
    typescript: typeof ts,
    languageService: LanguageService,
    documentProvider: VirtualDocumentProvider,
    templateString: string,
    spans: ReadonlyArray<{ start: number, end: number }>
): string {
    const virtualDoc = documentProvider.createVirtualDocument(new NoopTemplateContext(typescript, templateString));

    const regions = getDocumentRegions(languageService, virtualDoc);
    const cssSpans = spans
        .map(span => ({ language: regions.getLanguageAtPosition(virtualDoc.positionAt(span.start)), span }))
        .filter(x => x.language === 'css')
        .map(x => x.span);

    const settings = getTemplateSettings({} as any);
    return settings.getSubstitutions!(templateString, cssSpans);
}