// @ts-check
const path = require('path');
const assert = require('chai').assert;
const createServer = require('../server-fixture');
const { openMockFile, getFirstResponseOfType } = require('./_helpers');

const mockFileName = path.join(__dirname, '..', 'project-fixture', 'main.ts');

describe('Format', () => {
    it('should insert spaces between attributes names', () => {
        return formatMockFile(
            'const q = html`<span a="x"b="y"/>`\n'
        ).then(response => {
            assert.isTrue(response.success);
            assert.strictEqual(response.body.length, 1);
            assert.strictEqual(response.body[0].newText, '<span a="x" b="y" />');
        });
    });

    it('should not remove leading whitespace', () => {
        return formatMockFile(
            'html`\n<span />`\n'
        ).then(response => {
            assert.isTrue(response.success);
            assert.strictEqual(response.body.length, 1);
            assert.strictEqual(response.body[0].newText, '<span />');
            assert.strictEqual(response.body[0].newText, '<span />');
        });
    });

    it('should not touch placeholders', () => {
        return formatMockFile(
            'const q = html`<span a="${123}">${123}</span>`\n'
        ).then(response => {
            assert.isTrue(response.success);
            assert.strictEqual(response.body.length, 1);
            assert.strictEqual(response.body[0].newText, '<span a="${123}">${123}</span>');
        });
    });

    it('should observe document indent rules', () => {
        return formatMockFile(
            [
                'html\`',
                '<div>',
                '<img/>',
                '</div>`',
            ].join('\n'),
            {
                tabSize: 2,
                indentSize: 2,
                convertTabsToSpaces: true,
                newLineCharacter: "\n",
            })
            .then(response => {
                assert.isTrue(response.success);
                assert.strictEqual(response.body.length, 1);
                assert.strictEqual(response.body[0].newText, '<div>\n  <img />\n</div>');
            });
    });

    it('should not remove trailing newline', () => {
        return formatMockFile(
            'html`<span />\n`\n'
        ).then(response => {
            assert.isTrue(response.success);
            assert.strictEqual(response.body.length, 1);
            assert.strictEqual(response.body[0].end.line, 1);
        });
    });

    it('should not remove newline if that is the only content', () => {
        return formatMockFile(
            'html`\n`\n'
        ).then(response => {
            assert.isTrue(response.success);
            assert.strictEqual(response.body.length, 0);
        });
    });

    it('should not format contents of style blocks', async () => {
        const response = await formatMockFile(
            [
                'html\`',
                '    <style>',
                'a { }',
                '</style>',
                '`'
            ].join('\n'))

        assert.isTrue(response.success);
        assert.strictEqual(response.body.length, 0);
        // assert.strictEqual(response.body.length, 1);
        // assert.strictEqual(response.body[0].newText, '     <style>\na { }\n</style>');
    });

    it('should preserve style block placeholders', async () => {
        const response = await formatMockFile(
            [
                'html\`',
                '<style>',
                '${"a"} { }',
                '</style>',
                '`'
            ].join('\n'))

        assert.isTrue(response.success);
        assert.strictEqual(response.body.length, 0);
        // assert.strictEqual(response.body.length, 1);
        // assert.strictEqual(response.body[0].newText, '<style>\n${"a"} { }\n</style>');
    });
})

function formatMockFile(contents, options) {
    const server = createServer();
    openMockFile(server, mockFileName, contents);
    if (options) {
        server.send({
            command: 'configure',
            arguments: {
                file: mockFileName,
                formatOptions: options
            }
        });
    }
    server.sendCommand('format', {
        file: mockFileName,
        line: 1,
        offset: 1,
        endLine: 99,
        endOffset: 1
    });

    return server.close().then(() => {
        return getFirstResponseOfType('format', server);
    });
}