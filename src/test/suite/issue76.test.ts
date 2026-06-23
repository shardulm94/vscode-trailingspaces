// Repro for https://github.com/shardulm94/vscode-trailingspaces/issues/76
//
// trimOnSave fails when files.autoSave=onFocusChange and focus moves to
// another tab in the SAME window. The save fires for a document whose editor
// is no longer in window.visibleTextEditors, so loader's onWillSave handler
// (which only edits editors found in visibleTextEditors) applies no edits.

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { before, after, describe, it } from 'mocha';
import type { Settings } from '../../trailing-spaces/settings';
import type { TrailingSpacesTestApi } from '../../extension';

describe("Issue 76 - trimOnSave with hidden editor", () => {
    let settings: Settings;
    let fileA: string;
    let fileB: string;

    before(async () => {
        const ext = vscode.extensions.getExtension<TrailingSpacesTestApi | undefined>('shardulm94.trailing-spaces');
        assert.ok(ext, "trailing-spaces extension not found in the test host");
        const api = await ext.activate();
        assert.ok(api, "test API should be available outside production");
        settings = api.settings;
        // Enable trimOnSave; the config change reinitializes the listeners.
        await vscode.workspace.getConfiguration('trailing-spaces').update('trimOnSave', true, true);

        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-issue76-'));
        fileA = path.join(dir, 'a.txt');
        fileB = path.join(dir, 'b.txt');
        fs.writeFileSync(fileA, 'hello\n');
        fs.writeFileSync(fileB, 'world\n');
    });

    it("trims trailing spaces even when the document's editor is hidden", async () => {
        const docA = await vscode.workspace.openTextDocument(vscode.Uri.file(fileA));
        const editorA = await vscode.window.showTextDocument(docA, vscode.ViewColumn.One);

        // Add trailing spaces to A.
        await editorA.edit(eb => eb.insert(new vscode.Position(0, 5), '   '));
        assert.ok(docA.getText().includes('hello   '), "precondition: A has trailing spaces");

        // Switch to B in the SAME column -> A's editor leaves visibleTextEditors.
        const docB = await vscode.workspace.openTextDocument(vscode.Uri.file(fileB));
        await vscode.window.showTextDocument(docB, vscode.ViewColumn.One);
        assert.ok(
            !vscode.window.visibleTextEditors.some(e => e.document.uri.toString() === docA.uri.toString()),
            "precondition: A's editor is hidden"
        );

        // Save A (what autoSave=onFocusChange does behind the scenes).
        await docA.save();

        assert.strictEqual(docA.getText(), 'hello\n', "trailing spaces should be trimmed on save");
    });

    after(async () => {
        await settings.resetToDefaults();
        await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    });
});
