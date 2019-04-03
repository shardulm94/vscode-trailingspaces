//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { Settings } from '../src/trailing-spaces/settings';
import * as path from 'path';
import * as fs from 'fs';

describe("Extension Tests", () => {
    let testFileUri: vscode.Uri = vscode.Uri.file(path.join(__dirname, "files/sample.js"));
    let testDocument: vscode.TextDocument;
    let testEditor: vscode.TextEditor;
    let settings: Settings = Settings.getInstance()

    before((done: MochaDone) => {
        vscode.workspace.openTextDocument(testFileUri).then((document: vscode.TextDocument) => {
            testDocument = document;
            vscode.window.showTextDocument(testDocument).then((editor: vscode.TextEditor) => {
                testEditor = editor;
                done();
            })
        });
    });

    describe("testForDeleteTrailingSpaces", () => {
        it("should delete all trailing spaces", (done: MochaDone) => {
            vscode.workspace.getConfiguration
            assertDeleteTrailingSpaces(testEditor, './files/delete_all_trailing_spaces.js', done);
        });

        it("should not delete trailing spaces in empty lines", (done: MochaDone) => {
            settings.includeEmptyLines = false;
            assertDeleteTrailingSpaces(testEditor, './files/delete_trailing_spaces_exclude_empty_line.js', done);
        });

        it("should delete but not highlight trailing spaces in the current line", (done: MochaDone) => {
            settings.highlightCurrentLine = false;
            testEditor.selections = [new vscode.Selection(new vscode.Position(1, 3), new vscode.Position(1, 3))];
            assertDeleteTrailingSpaces(testEditor, './files/delete_trailing_spaces_exclude_current_line_highlight.js', done);
        });

        it("should not delete trailing spaces in the current line if line is empty", (done: MochaDone) => {
            settings.includeEmptyLines = false;
            testEditor.selections = [new vscode.Selection(new vscode.Position(11, 3), new vscode.Position(11, 3))];
            assertDeleteTrailingSpaces(testEditor, './files/delete_trailing_spaces_exclude_empty_line_when_exclude_current_line_highlight.js', done);
        });

        it("should not delete trailing spaces when language is set in syntaxIgnore", (done: MochaDone) => {
            settings.languagesToIgnore[testEditor.document.languageId] = true;
            assertDeleteTrailingSpaces(testEditor, './files/should_not_delete_spaces.js', done);
        });

        it("should not delete trailing spaces when file scheme is set in schemeIgnore", (done: MochaDone) => {
            settings.schemesToIgnore[testEditor.document.uri.scheme] = true;
            assertDeleteTrailingSpaces(testEditor, './files/should_not_delete_spaces.js', done);
        });

        it("should delete all trailing spaces including blank lines when regex is [\\s]+", (done: MochaDone) => {
            settings.regexp = "[\\s]+";
            assertDeleteTrailingSpaces(testEditor, './files/delete_all_trailing_spaces_including_blank_lines.js', done);
        });

        it("should only delete trailing spaces in modified lines only", (done: MochaDone) => {
            settings.deleteModifiedLinesOnly = true;
            testEditor.edit((editBuilder: vscode.TextEditorEdit) => {
                editBuilder.insert(new vscode.Position(11, 2), "test");
                editBuilder.delete(new vscode.Range(1, 0, 1, 3));
            }).then((flag: boolean) => {
                assertDeleteTrailingSpaces(testEditor, './files/delete_trailing_spaces_in_modified_lines.js', done);
            });
        });
    });

    afterEach((done: MochaDone) => {
        console.log("Reverting changes");
        settings.resetToDefaults()
        vscode.commands.executeCommand("workbench.action.files.revert").then(() => done());
    });

});

let assertDeleteTrailingSpaces = (editor: vscode.TextEditor, expectedOutputFile: string, done: MochaDone): void => {
    let outputFile: string = fs.readFileSync(path.join(__dirname, expectedOutputFile), "utf-8");
    vscode.commands.executeCommand("trailing-spaces.deleteTrailingSpaces").then(() => {
        assert.equal(editor.document.getText(), outputFile);
        done();
    });
};
