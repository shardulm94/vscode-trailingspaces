// 
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { TrailingSpaces, TralingSpacesSettings } from '../src/trailing-spaces/trailing-spaces';
import * as path from 'path';

let trailingSpaces: TrailingSpaces = new TrailingSpaces();
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
trailingSpaces.setSettings(defaultSettings);

describe("Extension Tests", () => {
    let testFileUri: vscode.Uri = vscode.Uri.file(path.join(__dirname, "files/sample.js"));
    let testFile: vscode.TextDocument;
    let testFileEditor: vscode.TextEditor;
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
    });
    afterEach((done: MochaDone) => {
        vscode.commands.executeCommand("workbench.action.files.revert").then(() => {
            done();
        });
    });

});

let assertDeleteTrailingSpaces = (editor: vscode.TextEditor, settings: TralingSpacesSettings, expectedOutputFile: string, done: MochaDone) => {
    let outputFileUri: vscode.Uri = vscode.Uri.file(path.join(__dirname, expectedOutputFile));
    let outputFile: vscode.TextDocument;
    let tmpSelections: vscode.Selection[] = editor.selections;
    vscode.workspace.openTextDocument(outputFileUri).then((document: vscode.TextDocument) => {
        outputFile = document;
        trailingSpaces.setSettings(settings);
        editor.selections = tmpSelections;
        editor.edit((editBuilder: vscode.TextEditorEdit) => {
            trailingSpaces.deleteTrailingSpaces(editor, editBuilder);
        }).then(() => {
            assert.equal(editor.document.getText(), outputFile.getText());
            done();
        });
    });
};