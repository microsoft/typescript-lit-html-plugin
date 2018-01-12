const assert = require('chai').assert;
const createServer = require('../server-fixture');
const { openMockFile, getFirstResponseOfType } = require('./_helpers');

const mockFileName = 'main.ts';

describe('CompletionEntryDetails', () => {
    it('should return details for tag completion', () => {
        const server = createServer();
        openMockFile(server, mockFileName, 'const q = html`<`');
        server.send({ command: 'completionEntryDetails', arguments: { file: mockFileName, offset: 17, line: 1, entryNames: ['a'] } });

        return server.close().then(() => {
            const completionsResponse = getFirstResponseOfType('completionEntryDetails', server);
            assert.isTrue(completionsResponse.success);
            assert.strictEqual(completionsResponse.body.length, 1);

            const firstDetails = completionsResponse.body[0]
            assert.strictEqual(firstDetails.name, 'a');
            assert.isTrue(firstDetails.documentation[0].text.indexOf('href') >= 0, 'documentation has href');
        });
    });
});
