//@ts-check
const path = require('path');
const assert = require('chai').assert;
const createServer = require('../server-fixture');
const { openMockFile, getFirstResponseOfType } = require('./_helpers');

const mockFileName = path.join(__dirname, '..', 'project-fixture', 'main.ts');

describe('CompletionEntryDetails', () => {
    it('should return html details for tag completion', () => {
        const server = createServer();
        openMockFile(server, mockFileName, 'const q = html`<`');
        server.sendCommand('completionEntryDetails', { file: mockFileName, offset: 17, line: 1, entryNames: ['a'] });

        return server.close().then(() => {
            const completionsResponse = getFirstResponseOfType('completionEntryDetails', server);
            assert.isTrue(completionsResponse.success);
            assert.strictEqual(completionsResponse.body.length, 1);

            const firstDetails = completionsResponse.body[0]
            assert.strictEqual(firstDetails.name, 'a');
            assert.isTrue(firstDetails.documentation[0].text.indexOf('href') >= 0, 'documentation has href');
        });
    });

    it('should return css details for tag completion', () => {
        const server = createServer();
        openMockFile(server, mockFileName, 'const q = html`<style> .test {  }</style>`');
        server.send({ command: 'completionEntryDetails', arguments: { file: mockFileName, offset: 32, line: 1, entryNames: ['color'] } });

        return server.close().then(() => {
            const completionsResponse = getFirstResponseOfType('completionEntryDetails', server);
            assert.isTrue(completionsResponse.success);
            assert.strictEqual(completionsResponse.body.length, 1);

            const firstDetails = completionsResponse.body[0]
            assert.strictEqual(firstDetails.name, 'color');
            assert.isTrue(firstDetails.documentation[0].text.indexOf('color') >= 0, 'documentation has color');
        });
    });
});
