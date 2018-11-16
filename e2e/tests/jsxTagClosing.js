//@ts-check
const path = require('path');
const assert = require('chai').assert;
const createServer = require('../server-fixture');
const { openMockFile, getFirstResponseOfType } = require('./_helpers');

const mockFileName = path.join(__dirname, '..', 'project-fixture', 'main.ts');

describe('JsxTagClosing', () => {
    it('should return closing tag for jsx', async () => {
        const closing = await getClosingTagInMockFile([
            'const q = html`',
            '<p>',
            '<b class="bold">',
            '</p>',
            '`'
        ].join('\n'), { line: 3, offset: 17 });
        assert.strictEqual(closing.newText, "</b>")
    });
});

const command = 'jsxClosingTag'

function getClosingTagInMockFile(contents, position) {
    const server = createServer();
    openMockFile(server, mockFileName, contents);
    server.sendCommand(command, { file: mockFileName, ...position });
    return server.close().then(() => getFirstResponseOfType(command, server).body);
}