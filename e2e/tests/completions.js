const assert = require('chai').assert;
const createServer = require('../server-fixture');
const { openMockFile, getFirstResponseOfType } = require('./_helpers');

const mockFileName = 'main.ts';

describe('Completions', () => {
    it('should return tag completions', () => {
        const server = createServer();
        openMockFile(server, mockFileName, 'const q = html`<`');
        server.send({ command: 'completions', arguments: { file: mockFileName, offset: 17, line: 1, prefix: '' } });

        return server.close().then(() => {
            const completionsResponse = getFirstResponseOfType('completions', server);
            assert.isTrue(completionsResponse.success);
            assert.isTrue(completionsResponse.body.some(item => item.name === 'main'));
            assert.isTrue(completionsResponse.body.some(item => item.name === 'button'));
        });
    });

    it('should return property completions', () => {
        const server = createServer();
        openMockFile(server, mockFileName, 'const q = html`<button `');
        server.send({ command: 'completions', arguments: { file: mockFileName, offset: 24, line: 1, prefix: '' } });

        return server.close().then(() => {
            const completionsResponse = getFirstResponseOfType('completions', server);
            assert.isTrue(completionsResponse.success);
            assert.isTrue(completionsResponse.body.some(item => item.name === 'onclick'));
            assert.isTrue(completionsResponse.body.some(item => item.name === 'title'));
        });
    });
})
