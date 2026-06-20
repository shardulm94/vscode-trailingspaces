// Repro for https://github.com/shardulm94/vscode-trailingspaces/issues/71
//
// When the SAME file is opened more than once in split view, trimOnSave stops
// working: the trailing space survives the save in both panes.

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { before, after, describe, it } from 'mocha';
import type { Settings } from '../../trailing-spaces/settings';
import type { TrailingSpacesTestApi } from '../../extension';

describe("Issue 71 - trimOnSave with same file in split view", () => {
    let settings: Settings;
    let fileA: string;

    before(async () => {
        const ext = vscode.extensions.getExtension<TrailingSpacesTestApi | undefined>('shardulm94.trailing-spaces');
        assert.ok(ext, "trailing-spaces extension not found in the test host");
        const api = await ext.activate();
        assert.ok(api, "test API should be available outside production");
        settings = api.settings;
        await vscode.workspace.getConfiguration('trailing-spaces').update('trimOnSave', true, true);

        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-issue71-'));
        fileA = path.join(dir, 'a.txt');
        fs.writeFileSync(fileA, 'hello\n');
    });

    it("trims trailing spaces when the same file is open in two split panes", async () => {
        const docA = await vscode.workspace.openTextDocument(vscode.Uri.file(fileA));

        // Open the same document in two columns (split view).
        const editorOne = await vscode.window.showTextDocument(docA, vscode.ViewColumn.One);
        await vscode.window.showTextDocument(docA, vscode.ViewColumn.Two);

        // Introduce a trailing space.
        await editorOne.edit(eb => eb.insert(new vscode.Position(0, 5), '   '));
        assert.ok(docA.getText().includes('hello   '), "precondition: doc has trailing spaces");

        await docA.save();

        assert.strictEqual(docA.getText(), 'hello\n', "trailing spaces should be trimmed on save");
    });

    after(async () => {
        await settings.resetToDefaults();
        await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    });
});
