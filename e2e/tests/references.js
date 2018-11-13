//@ts-check
const path = require('path');
const assert = require('chai').assert;
const createServer = require('../server-fixture');
const { openMockFile, getFirstResponseOfType } = require('./_helpers');

const mockFileName = path.join(__dirname, '..', 'project-fixture', 'main.ts');

describe('References', () => {
    it('should return tag matches as references', async () => {
        const { refs } = await getReferencesForMockFile([
            'const q = html`',
            '<div>',
            '<div>abc</div>',
            '</div>',
            '`'
        ].join('\n'), { line: 2, offset: 2 });

        assert.strictEqual(refs.length, 2);

        const [ref1, ref2] = refs;
        assertPosition(ref1.start, 2, 2);
        assertPosition(ref1.end, 2, 5);

        assertPosition(ref2.start, 4, 3);
        assertPosition(ref2.end, 4, 6);
    });
});

function getReferencesForMockFile(contents, position) {
    const server = createServer();
    openMockFile(server, mockFileName, contents);
    server.sendCommand('references', { file: mockFileName, ...position });
    return server.close().then(() => getFirstResponseOfType('references', server).body);
}

function assertPosition(pos, line, offset) {
    assert.strictEqual(pos.line, line);
    assert.strictEqual(pos.offset, offset);
}
