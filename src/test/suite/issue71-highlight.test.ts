// Repro for the split-view highlight desync described in
// https://github.com/shardulm94/vscode-trailingspaces/issues/71
//
// When the SAME document is open in two split panes, editing one pane only
// re-highlights the *active* editor. The other pane showing the same document
// keeps stale decorations:
//   - add a space in the right pane     -> left pane does not show the highlight
//   - delete the space in the left pane -> right pane keeps a stale red sliver
//
// Decorations are not readable through the VSCode API, so we observe the ranges
// the extension applies to each editor via TrailingSpaces.highlightedRanges.

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { before, after, describe, it } from 'mocha';
import type { Settings } from '../../trailing-spaces/settings';
import type { TrailingSpacesTestApi } from '../../extension';

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 20));
    }
}

describe("Issue 71 - split-view highlight desync", () => {
    let settings: Settings;
    let testApi: TrailingSpacesTestApi;
    let file: string;

    before(async () => {
        const ext = vscode.extensions.getExtension<TrailingSpacesTestApi | undefined>('shardulm94.trailing-spaces');
        assert.ok(ext, "trailing-spaces extension not found in the test host");
        const api = await ext.activate();
        assert.ok(api, "test API should be available outside production");
        testApi = api;
        settings = api.settings;

        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-issue71-hl-'));
        file = path.join(dir, 'a.txt');
        fs.writeFileSync(file, 'hello\n');
    });

    it("keeps highlights in sync across split panes of the same document", async () => {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file));

        const left = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
        const right = await vscode.window.showTextDocument(doc, vscode.ViewColumn.Two);

        const leftRanges = () => testApi.getHighlightedRanges(left);
        const rightRanges = () => testApi.getHighlightedRanges(right);

        // Step 1+2: right pane is active; introduce a trailing space there.
        await right.edit(eb => eb.insert(new vscode.Position(0, 5), '   '));
        await waitFor(() => leftRanges().length > 0);

        assert.strictEqual(
            rightRanges().length, 1,
            "active (right) pane should highlight the new trailing space");
        assert.strictEqual(
            leftRanges().length, 1,
            "left pane should also highlight the trailing space added in the right pane");

        // Step 3+4: focus the left pane and remove the trailing space there.
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
        await left.edit(eb => eb.delete(new vscode.Range(0, 5, 0, 8)));
        await waitFor(() => rightRanges().length === 0);

        assert.strictEqual(doc.getText(), 'hello\n', "precondition: trailing space removed");
        assert.strictEqual(
            leftRanges().length, 0,
            "active (left) pane should clear its highlight");
        assert.strictEqual(
            rightRanges().length, 0,
            "right pane should also clear its highlight (no stale red sliver)");
    });

    after(async () => {
        await settings.resetToDefaults();
        await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    });
});
