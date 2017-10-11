const assert = require('chai').assert;
const createServer = require('../server-fixture');
const { openMockFile, getFirstResponseOfType } = require('./_helpers');

const mockFileName = 'main.ts';

describe('Format', () => {
    it('should insert spaces between attributes names', () => {
        const server = createServer();
        openMockFile(server, mockFileName, 'const q = html`<span a="x"b="y"/>`\n');
        server.send({
            command: 'format',
            arguments: {
                file: mockFileName,
                line: 1,
                offset: 1,
                endLine: 2,
                endOffset: 1
            }
        });

        return server.close().then(() => {
            const response = getFirstResponseOfType('format', server);
            assert.isTrue(response.success);
            assert.strictEqual(response.body.length, 1);
            assert.strictEqual(response.body[0].newText, '<span a="x" b="y" />');
        });
    });

    it('should not remove leading whitespace', () => {
        const server = createServer();
        openMockFile(server, mockFileName, 'html`\n<span />\n`\n');
        server.send({
            command: 'format',
            arguments: {
                file: mockFileName,
                line: 1,
                offset: 1,
                endLine: 3,
                endOffset: 1
            }
        });

        return server.close().then(() => {
            const response = getFirstResponseOfType('format', server);
            assert.isTrue(response.success);
            console.log(response.body)
            assert.strictEqual(response.body.length, 0);
        });
    });
})
