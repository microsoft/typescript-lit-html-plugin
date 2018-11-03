/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Derived from https://github.com/Microsoft/vscode/blob/master/extensions/html-language-features/server/src/test/embedded.test.ts

const assert = require('chai').assert;
const test = require('mocha').test;
const embeddedSupport = require('../../lib/embeddedSupport')
const vscodeTypes = require('vscode-languageserver-types');
const vscodeHtmlService = require('vscode-html-languageservice');

describe('Embedded Language Identification', () => {
    test('<style>', function () {
        assertLanguageId('const q = html`|<html><style>foo { }</style></html>`', 'html');
        assertLanguageId('const q = html`<html|><style>foo { }</style></html>`', 'html');
        assertLanguageId('const q = html`<html><st|yle>foo { }</style></html>`', 'html');
        assertLanguageId('const q = html`<html><style>|foo { }</style></html>`', 'css');
        assertLanguageId('const q = html`<html><style>foo| { }</style></html>`', 'css');
        assertLanguageId('const q = html`<html><style>foo { }|</style></html>`', 'css');
        assertLanguageId('const q = html`<html><style>foo { }</sty|le></html>`', 'html');
    });

    test('<style> - Incomplete HTML', function () {
        assertLanguageId('const q = html`|<html><style>foo { }`', 'html');
        assertLanguageId('const q = html`<html><style>fo|o { }`', 'css');
        assertLanguageId('const q = html`<html><style>foo { }|`', 'css');
    });

    test('CSS in HTML attributes', function () {
        assertLanguageId('const q = html`<div id="xy" |style="color: red"/>`', 'html');
        assertLanguageId('const q = html`<div id="xy" styl|e="color: red"/>`', 'html');
        assertLanguageId('const q = html`<div id="xy" style=|"color: red"/>`', 'html');
        assertLanguageId('const q = html`<div id="xy" style="|color: red"/>`', 'css');
        assertLanguageId('const q = html`<div id="xy" style="color|: red"/>`', 'css');
        assertLanguageId('const q = html`<div id="xy" style="color: red|"/>`', 'css');
        assertLanguageId('const q = html`<div id="xy" style="color: red"|/>`', 'html');
        assertLanguageId('const q = html`<div id="xy" style=\'color: r|ed\'/>`', 'css');
        assertLanguageId('const q = html`<div id="xy" style|=color:red/>`', 'html');
        assertLanguageId('const q = html`<div id="xy" style=|color:red/>`', 'css');
        assertLanguageId('const q = html`<div id="xy" style=color:r|ed/>`', 'css');
        assertLanguageId('const q = html`<div id="xy" style=color:red|/>`', 'css');
        assertLanguageId('const q = html`<div id="xy" style=color:red/|>`', 'html');
    });
});

describe('Embedded Document Content', () => {
    test('Substituted placeholder-like values in CSS', () => {
        assertEmbeddedDocumentCssContent(
            'html`<style>xxxxxxxxxxxxxxxxxx</style>`',
            '                                       '
        );
        assertEmbeddedDocumentCssContent(
            'html`<style>   xxxxxxxxxxx  </style>`',
            '                                     '
        );
        assertEmbeddedDocumentCssContent(
            'html`<style>xxxxxxxxxxxx  xxxxx</style>`',
            '                                        '
        );
        assertEmbeddedDocumentCssContent(
            'html`<div style="xxxxxxxxxxxxxxxxxxx"></div>`',
            '                                             '
        );
        assertEmbeddedDocumentCssContent(
            'html`<div style="xxx xxxxxx xxxxxxxx"></div>`',
            '                                             '
        );
        assertEmbeddedDocumentCssContent(
            'html`<style>xxx</style><div style=" xxx "></div>`',
            '                                                 '
        );
    });

    test('Untouched CSS document content', () => {
        assertEmbeddedDocumentCssContent(
            'html`<style>xx</style><div style="xx xxxxxxxx"></div>`',
            '            xx                 __{xx xxxxxxxx}        '
        );
        assertEmbeddedDocumentCssContent(
            'html`<style>body {color: red;} xxxxxxxxx</style>`',
            '            body {color: red;} xxxxxxxxx         '
        );
        assertEmbeddedDocumentCssContent(
            'html`<style>xxxxxxxxx body {color: red;}</style>`',
            '            xxxxxxxxx body {color: red;}         '
        );
        assertEmbeddedDocumentCssContent(
            'html`<div style="xxxxxxxxxx color:red;"></div>`',
            '              __{xxxxxxxxxx color:red;}        '
        );
        assertEmbeddedDocumentCssContent(
            'html`<div style="color:red; xxxxxxxxxxx"></div>`',
            '              __{color:red; xxxxxxxxxxx}        '
        );
        assertEmbeddedDocumentCssContent(
            'html`<div style="color:red; xxxxxxxxxxx font-size: 16px;"></div>`',
            '              __{color:red; xxxxxxxxxxx font-size: 16px;}        '
        );
    });
});

const htmlLanguageService = vscodeHtmlService.getLanguageService();

function assertLanguageId(value, expectedLanguageId) {
    let offset = value.indexOf('|');
    value = value.substr(0, offset) + value.substr(offset + 1);

    let document = createDocument(value);

    let position = document.positionAt(offset);

    let docRegions = embeddedSupport.getDocumentRegions(htmlLanguageService, document);
    let languageId = docRegions.getLanguageAtPosition(position);

    assert.equal(languageId, expectedLanguageId);
}

function assertEmbeddedDocumentCssContent(value, expectedValue) {
    let document = createDocument(value);
    let docRegions = embeddedSupport.getDocumentRegions(htmlLanguageService, document);
    let cssDoc = docRegions.getEmbeddedDocument('css', false);

    assert.equal(cssDoc.getText(), expectedValue);
}

function createDocument(value) {
    return vscodeTypes.TextDocument.create('test://test/test.html', 'html', 0, value);
}