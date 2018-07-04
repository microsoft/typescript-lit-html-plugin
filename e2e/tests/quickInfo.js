//@ts-check
const path = require('path');
const assert = require('chai').assert;
const createServer = require('../server-fixture');
const { openMockFile, getFirstResponseOfType } = require('./_helpers');

const mockFileName = path.join(__dirname, '..', 'project-fixture', 'main.ts');

describe('QuickInfo', () => {
    it('should return css quick info in styled blocks', async () => {
        const quickInfo = await getQuickInfoInMockFile([
            'const q = html`',
            '<style>',
            'a { color: red; }',
            '</style>',
            '`'
        ].join('\n'), { line: 3, offset: 6 });
        assert.strictEqual(quickInfo.documentation, "Color of an element's text")
        assert.strictEqual(quickInfo.start.line, 3);
        assert.strictEqual(quickInfo.start.offset, 5);
        assert.strictEqual(quickInfo.end.line, 3);
        assert.strictEqual(quickInfo.end.offset, 15);

    });
});

function getQuickInfoInMockFile(contents, position) {
    const server = createServer();
    openMockFile(server, mockFileName, contents);
    server.sendCommand('quickinfo', { file: mockFileName, ...position });
    return server.close().then(() => getFirstResponseOfType('quickinfo', server).body);
}