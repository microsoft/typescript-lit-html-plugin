//@ts-check
const path = require('path');
const assert = require('chai').assert;
const createServer = require('../server-fixture');
const { openMockFile, getFirstResponseOfType } = require('./_helpers');

const mockFileName = path.join(__dirname, '..', 'project-fixture', 'main.ts');

describe('HTML Completions', () => {
    it('should return html tag completions for html tag', async () => {
        const completionsResponse = await makeSingleCompletionsRequest('const q = html`<`', { offset: 17, line: 1 });
        assert.isTrue(completionsResponse.body.some(item => item.name === 'main'));
        assert.isTrue(completionsResponse.body.some(item => item.name === 'button'));
    });

    it('should return html tag completions for raw tag', async () => {
        const completionsResponse = await makeSingleCompletionsRequest('const q = raw`<`', { offset: 16, line: 1 });
        assert.isTrue(completionsResponse.body.some(item => item.name === 'main'));
    });

    it('should return html property completions', async () => {
        const completionsResponse = await makeSingleCompletionsRequest('const q = html`<button `', { line: 1, offset: 24 });
        assert.isTrue(completionsResponse.body.some(item => item.name === 'onclick'));
        assert.isTrue(completionsResponse.body.some(item => item.name === 'title'));
    });

    it('should not return html completions for html tag inside of <style>', async () => {
        const completionsResponse = await makeSingleCompletionsRequest('const q = html`<style> .test {  }</style>`', { offset: 32, line: 1 });
        assert.isFalse(completionsResponse.body.some(item => item.name === 'div'));
        assert.isFalse(completionsResponse.body.some(item => item.name === 'main'));
    });

    it('should not return html completions for raw tag inside of <style>', async () => {
        const completionsResponse = await makeSingleCompletionsRequest('const q = raw`<style> .test {  }</style>`', { offset: 31, line: 1 });
        assert.isFalse(completionsResponse.body.some(item => item.name === 'div'));
        assert.isFalse(completionsResponse.body.some(item => item.name === 'main'));
    });

    it('should return edit that closes > #25', async () => {
        const completionsResponse = await makeSingleCompletionsRequest('const q = html`<a></`', { offset: 20, line: 1 });
        const entry = completionsResponse.body.find(item => item.name === '/a');
        assert.isOk(entry);
        assert.strictEqual(entry.insertText, '/a>');
    });
});

describe('CSS Completions', () => {
    it('should return css completions for html tag within <style>', async () => {
        const completionsResponse = await makeSingleCompletionsRequest('const q = html`<style> .test {  }</style>`', { offset: 32, line: 1 });
        assert.isTrue(completionsResponse.body.some(item => item.name === 'display'));
        assert.isTrue(completionsResponse.body.some(item => item.name === 'position'));
        assert.isTrue(completionsResponse.body.some(item => item.name === 'color'));
    });

    it('should return css completions for raw tag within <style>', async () => {
        const completionsResponse = await makeSingleCompletionsRequest('const q = raw`<style> .test {  }</style>`', { offset: 31, line: 1 });
        assert.isTrue(completionsResponse.body.some(item => item.name === 'display'));
        assert.isTrue(completionsResponse.body.some(item => item.name === 'position'));
        assert.isTrue(completionsResponse.body.some(item => item.name === 'color'));
    });

    it('should return css property completions for html tag within <style>', async () => {
        const completionsResponse = await makeSingleCompletionsRequest('const q = html`<style> .test { display:  }</style>`', { offset: 40, line: 1 });
        assert.isTrue(completionsResponse.body.some(item => item.name === 'block'));
        assert.isTrue(completionsResponse.body.some(item => item.name === 'flex'));
        assert.isTrue(completionsResponse.body.some(item => item.name === 'grid'));
    });

    it('should return css property completions for raw tag within <style>', async () => {
        const completionsResponse = await makeSingleCompletionsRequest('const q = raw`<style> .test { display:  }</style>`', { offset: 39, line: 1 });
        assert.isTrue(completionsResponse.body.some(item => item.name === 'block'));
        assert.isTrue(completionsResponse.body.some(item => item.name === 'flex'));
        assert.isTrue(completionsResponse.body.some(item => item.name === 'grid'));
    });

    it('should not return css completions for html tag outside of <style>', async () => {
        const completionsResponse = await makeSingleCompletionsRequest('const q = html` `', { offset: 16, line: 1 });
        assert.isFalse(completionsResponse.body.some(item => item.name === 'display'));
        assert.isFalse(completionsResponse.body.some(item => item.name === 'position'));
        assert.isFalse(completionsResponse.body.some(item => item.name === 'color'));
    });

    it('should not return css completions for raw tag outside of <style>', async () => {
        const completionsResponse = await makeSingleCompletionsRequest('const q = raw` `', { offset: 15, line: 1 });
        assert.isFalse(completionsResponse.body.some(item => item.name === 'display'));
        assert.isFalse(completionsResponse.body.some(item => item.name === 'position'));
        assert.isFalse(completionsResponse.body.some(item => item.name === 'color'));
    });
});

async function makeSingleCompletionsRequest(body, position) {
    const server = createServer();
    openMockFile(server, mockFileName, body);
    server.sendCommand('completions', { file: mockFileName, line: position.line, offset: position.offset });

    await server.close();
    const completionsResponse = getFirstResponseOfType('completions', server);
    assert.isTrue(completionsResponse.success);
    return completionsResponse;
}

