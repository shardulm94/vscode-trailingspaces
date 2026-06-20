//
// Regression test for issue #80:
// https://github.com/shardulm94/vscode-trailingspaces/issues/80
//
// `trimOnSave` snapshots the document inside `onWillSaveTextDocument` and hands
// the resulting ranges to VSCode through `waitUntil`. If the document changes
// after that snapshot but before the edits are applied (the issue's "save, then
// quickly press Delete", or another save participant such as the RedHat XML
// formatter editing the same document), the now-stale ranges land on the wrong
// characters and corrupt real content instead of trimming whitespace.
//
// The fix guards getEditsForDeletingTralingSpaces with the version the edits
// were computed against: if the document has moved on, no edits are emitted and
// trimming is skipped for that save. These tests pin both halves of that
// contract - it still trims when nothing changed, and it bails out (rather than
// corrupting) when the document changed underneath.
//

import * as assert from 'assert';
import * as vscode from 'vscode';
import { before, describe, it } from 'mocha';
import { TrailingSpaces } from '../../trailing-spaces/trailing-spaces';
import type { TrailingSpacesApi } from '../../extension';

describe("Issue #80 - trim-on-save race guard", () => {
    before(async () => {
        const ext = vscode.extensions.getExtension<TrailingSpacesApi>('shardulm94.trailing-spaces');
        assert.ok(ext, "trailing-spaces extension not found in the test host");
        await ext.activate();
    });

    // The document as it exists the instant Ctrl+S is pressed: the user has just
    // inserted two blank lines above the <Rectangle> line (issue repro step:
    // "insert multiple newlines above the line").
    const snapshot = [
        '<Lockscreen>',
        '',                       // L1: inserted blank line
        '',                       // L2: inserted blank line
        'a   ',                   // L3: a line with trailing spaces -> a delete edit
        '    <Rectangle x="0" alpha="1" fillColor="#FF000000" visibility="x" />',
        '</Lockscreen>',
    ].join('\n');

    it("does not corrupt content when a concurrent edit shifts lines mid-save", async () => {
        const trailingSpaces = new TrailingSpaces();

        const doc = await vscode.workspace.openTextDocument({ language: 'xml', content: snapshot });
        const editor = await vscode.window.showTextDocument(doc);

        // onWillSaveTextDocument records the version it is about to compute against.
        const versionAtSnapshot = doc.version;

        // The user "quickly presses Delete", removing the two inserted blank
        // lines before VSCode flushes the queued save edits. Every line below
        // shifts up by two and the document version advances.
        await editor.edit(eb => {
            eb.delete(new vscode.Range(1, 0, 3, 0));
        });
        assert.notStrictEqual(doc.version, versionAtSnapshot, "expected the concurrent edit to bump the document version");

        // The guarded save path now produces edits. Because the document moved
        // on, it must emit nothing rather than stale ranges.
        const edits = trailingSpaces.getEditsForDeletingTralingSpaces(doc, versionAtSnapshot);
        assert.strictEqual(edits.length, 0, "stale edits must be discarded when the document changed");

        const we = new vscode.WorkspaceEdit();
        we.set(doc.uri, edits);
        await vscode.workspace.applyEdit(we);

        // Content is intact: the </Lockscreen> tag and the <Rectangle> line are untouched.
        const after = doc.getText();
        assert.ok(after.includes('</Lockscreen>'), `content corrupted: ${JSON.stringify(after)}`);
        assert.ok(after.includes('alpha="1"'), `content corrupted: ${JSON.stringify(after)}`);

        await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    });

    it("still trims trailing spaces when the document is unchanged at save time", async () => {
        const trailingSpaces = new TrailingSpaces();

        const doc = await vscode.workspace.openTextDocument({ language: 'xml', content: snapshot });
        await vscode.window.showTextDocument(doc);

        // No concurrent edit: the version matches, so the happy path is unaffected.
        const edits = trailingSpaces.getEditsForDeletingTralingSpaces(doc, doc.version);
        assert.ok(edits.length > 0, "expected trailing-space deletions on the unchanged document");

        const we = new vscode.WorkspaceEdit();
        we.set(doc.uri, edits);
        await vscode.workspace.applyEdit(we);

        const after = doc.getText().split('\n');
        assert.strictEqual(after[3], 'a', "trailing spaces after 'a' should be trimmed");
        assert.ok(after[5].includes('</Lockscreen>'), "content must remain intact");

        await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    });
});
