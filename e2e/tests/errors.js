//@ts-check
const path = require('path');
const assert = require('chai').assert;
const createServer = require('../server-fixture');
const { openMockFile, getFirstResponseOfType } = require('./_helpers');

const mockFileName = path.join(__dirname, '..', 'project-fixture', 'main.ts');

describe('Errors', () => {
    it('should not return errors for a basic css placeholder', async () => {
        const errors = await getErrorsInMockFile([
            'declare const html: any; const q = html`',
            '<style>',
            'a { color: ${"red"}; }',
            '</style>',
            '`'
        ].join('\n'));
        assert.strictEqual(errors.length, 0);

    });
});

function getErrorsInMockFile(contents) {
    const server = createServer();
    openMockFile(server, mockFileName, contents);
    server.sendCommand('semanticDiagnosticsSync', { file: mockFileName });
    return server.close().then(() => getFirstResponseOfType('semanticDiagnosticsSync', server).body);
}