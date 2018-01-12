const assert = require('chai').assert;
const createServer = require('../server-fixture');
const { openMockFile, getFirstResponseOfType } = require('./_helpers');

const mockFileName = 'main.ts';

describe('Completions', () => {
    it('should return tag completions for html tag', () => {
        return makeSingleCompletionsRequest(
            'const q = html`<`',
            { offset: 17, line: 1 }
        ).then(completionsResponse => {
            assert.isTrue(completionsResponse.body.some(item => item.name === 'main'));
            assert.isTrue(completionsResponse.body.some(item => item.name === 'button'));
        });
    });

    it('should return tag completions for raw tag', () => {
        return makeSingleCompletionsRequest(
            'const q = raw`<`',
            { offset: 16, line: 1 }
        ).then(completionsResponse => {
            assert.isTrue(completionsResponse.body.some(item => item.name === 'main'));
        });
    });

    it('should return property completions', () => {
        return makeSingleCompletionsRequest(
            'const q = html`<button `',
            { line: 1, offset: 24 }
        ).then(completionsResponse => {
            assert.isTrue(completionsResponse.body.some(item => item.name === 'onclick'));
            assert.isTrue(completionsResponse.body.some(item => item.name === 'title'));
        });
    });
})

function makeSingleCompletionsRequest(body, position) {
    const server = createServer();
    openMockFile(server, mockFileName, body);
    server.send({ command: 'completions', arguments: { file: mockFileName, line: position.line, offset: position.offset } });

    return server.close().then(() => {
        const completionsResponse = getFirstResponseOfType('completions', server);
        assert.isTrue(completionsResponse.success);
        return completionsResponse;
    });
}

