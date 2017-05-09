//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { TralingSpacesSettings } from '../src/trailing-spaces/trailing-spaces';
import * as path from 'path';
import * as fs from 'fs';

describe("Extension Tests", () => {
    let testFileUri: vscode.Uri = vscode.Uri.file(path.join(__dirname, "files/sample.js"));
    let testFile: vscode.TextDocument;
    let testFileEditor: vscode.TextEditor;
    let defaultSettings: TralingSpacesSettings = {
        includeEmptyLines: true,
        highlightCurrentLine: true,
        regexp: "[ \t]+",
        liveMatching: true,
        deleteModifiedLinesOnly: false,
        syntaxIgnore: [],
        trimOnSave: false,
        saveAfterTrim: false
    }

    before((done: MochaDone) => {
        vscode.workspace.openTextDocument(testFileUri).then((document: vscode.TextDocument) => {
            testFile = document;
            vscode.window.showTextDocument(testFile).then((editor: vscode.TextEditor) => {
                testFileEditor = editor;
                done();
            })
        });
    });

    describe("testForDeleteTrailingSpaces", () => {
        it("should delete all trailing spaces", (done: MochaDone) => {
            let settings: TralingSpacesSettings = Object.assign({}, defaultSettings);
            assertDeleteTrailingSpaces(testFileEditor, settings, './files/delete_all_trailing_spaces.js', done);
        });

        it("should not delete trailing spaces in empty lines", (done: MochaDone) => {
            let settings: TralingSpacesSettings = Object.assign({}, defaultSettings);
            settings.includeEmptyLines = false;
            assertDeleteTrailingSpaces(testFileEditor, settings, './files/delete_trailing_spaces_exclude_empty_line.js', done);
        });

        it("should delete but not highlight trailing spaces in the current line", (done: MochaDone) => {
            let settings: TralingSpacesSettings = Object.assign({}, defaultSettings);
            settings.highlightCurrentLine = false;
            testFileEditor.selections = [new vscode.Selection(new vscode.Position(1, 3), new vscode.Position(1, 3))];
            assertDeleteTrailingSpaces(testFileEditor, settings, './files/delete_trailing_spaces_exclude_current_line_highlight.js', done);
        });

        it("should not delete trailing spaces in the current line if line is empty", (done: MochaDone) => {
            let settings: TralingSpacesSettings = Object.assign({}, defaultSettings);
            settings.highlightCurrentLine = false;
            settings.includeEmptyLines = false;
            testFileEditor.selections = [new vscode.Selection(new vscode.Position(11, 3), new vscode.Position(11, 3))];
            assertDeleteTrailingSpaces(testFileEditor, settings, './files/delete_trailing_spaces_exclude_empty_line_when_exclude_current_line_highlight.js', done);
        });

        it("should not delete trailing spaces when language is set in syntaxIgnore", (done: MochaDone) => {
            let settings: TralingSpacesSettings = Object.assign({}, defaultSettings);
            settings.syntaxIgnore = [testFileEditor.document.languageId];
            assertDeleteTrailingSpaces(testFileEditor, settings, './files/should_not_delete_spaces.js', done);
        });

        it("should delete all trailing spaces including blank lines when regex is [\\s]+", (done: MochaDone) => {
            let settings: TralingSpacesSettings = Object.assign({}, defaultSettings);
            settings.regexp = "[\\s]+";
            assertDeleteTrailingSpaces(testFileEditor, settings, './files/delete_all_trailing_spaces_including_blank_lines.js', done);
        });

        it("should only delete trailing spaces in modified lines only", (done: MochaDone) => {
            let settings: TralingSpacesSettings = Object.assign({}, defaultSettings);
            settings.deleteModifiedLinesOnly = true;
            testFileEditor.edit((editBuilder: vscode.TextEditorEdit) => {
                editBuilder.insert(new vscode.Position(11, 2), "test");
                editBuilder.delete(new vscode.Range(1, 0, 1, 3));
            }).then((flag: boolean) => {
                assertDeleteTrailingSpaces(testFileEditor, settings, './files/delete_trailing_spaces_in_modified_lines.js', done);
            });
        });
    });

    afterEach((done: MochaDone) => {
        console.log("Reverting changes");
        vscode.commands.executeCommand("workbench.action.files.revert").then((value: {}) => {
            setTimeout(function() {
                done();
            },400);
        });
    });

});

let assertDeleteTrailingSpaces = (editor: vscode.TextEditor, settings: TralingSpacesSettings, expectedOutputFile: string, done: MochaDone): void => {
    let outputFile: string = fs.readFileSync(path.join(__dirname, expectedOutputFile), "utf-8");
    vscode.commands.executeCommand("trailing-spaces.loadConfig", JSON.stringify(settings)).then(() => {
        vscode.commands.executeCommand("trailing-spaces.deleteTrailingSpaces").then(() => {
            assert.equal(editor.document.getText(), outputFile);
            done();
        });
    });
};