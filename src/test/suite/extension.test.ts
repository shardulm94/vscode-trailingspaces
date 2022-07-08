//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { Settings } from '../../trailing-spaces/settings';
import * as path from 'path';
import { Done, afterEach, describe, it } from 'mocha';
import * as fs from 'fs';

describe("Extension Tests", () => {
    let settings: Settings = Settings.getInstance();

    async function loadTestFileIntoEditor(testFileName: string, done: Done): Promise<vscode.TextEditor> {
        let testFileUri: vscode.Uri = vscode.Uri.file(path.join(__dirname, testFileName));

        return vscode.workspace.openTextDocument(testFileUri)
            .then(
                (document: vscode.TextDocument) => vscode.window.showTextDocument(document),
                (reason: any) => done(reason)
            );
    }

    describe("testForDeleteTrailingSpaces", () => {
        it("should delete all trailing spaces", (done: Done) => {
            loadTestFileIntoEditor('./files/delete_all_trailing_spaces_sample.js', done)
                .then((testEditor: vscode.TextEditor) => {
                    assertDeleteTrailingSpaces(testEditor, './files/delete_all_trailing_spaces_result.js', done);
                });
        });

        it("should not delete trailing spaces in empty lines", (done: Done) => {
            settings.includeEmptyLines = false;
            loadTestFileIntoEditor('./files/delete_trailing_spaces_exclude_empty_line_sample.js', done)
                .then((testEditor: vscode.TextEditor) => {
                    assertDeleteTrailingSpaces(testEditor, './files/delete_trailing_spaces_exclude_empty_line_result.js', done);
                });
        });

        it("should delete but not highlight trailing spaces in the current line", (done: Done) => {
            settings.highlightCurrentLine = false;
            loadTestFileIntoEditor('./files/delete_trailing_spaces_exclude_current_line_highlight_sample.js', done)
                .then((testEditor: vscode.TextEditor) => {
                    testEditor.selections = [new vscode.Selection(new vscode.Position(1, 3), new vscode.Position(1, 3))];
                    assertDeleteTrailingSpaces(testEditor, './files/delete_trailing_spaces_exclude_current_line_highlight_result.js', done);
                });
        });

        it("should not delete trailing spaces in the current line if line is empty", (done: Done) => {
            settings.includeEmptyLines = false;
            loadTestFileIntoEditor('./files/delete_trailing_spaces_exclude_empty_line_when_exclude_current_line_highlight_sample.js', done)
                .then((testEditor: vscode.TextEditor) => {
                    testEditor.selections = [new vscode.Selection(new vscode.Position(11, 3), new vscode.Position(11, 3))];
                    assertDeleteTrailingSpaces(testEditor, './files/delete_trailing_spaces_exclude_empty_line_when_exclude_current_line_highlight_result.js', done);
                });
        });

        it("should not delete trailing spaces when language is set in syntaxIgnore", (done: Done) => {
            loadTestFileIntoEditor('./files/should_not_delete_spaces_sample.js', done)
                .then((testEditor: vscode.TextEditor) => {
                    settings.languagesToIgnore[testEditor.document.languageId] = true;
                    assertDeleteTrailingSpaces(testEditor, './files/should_not_delete_spaces_result.js', done);
                });
        });

        it("should not delete trailing spaces when file scheme is set in schemeIgnore", (done: Done) => {
            loadTestFileIntoEditor('./files/should_not_delete_spaces_sample.js', done)
                .then((testEditor: vscode.TextEditor) => {
                    settings.schemesToIgnore[testEditor.document.uri.scheme] = true;
                    assertDeleteTrailingSpaces(testEditor, './files/should_not_delete_spaces_result.js', done);
                });
        });

        it("should delete all trailing spaces including blank lines when regex is [\\s]+", (done: Done) => {
            loadTestFileIntoEditor('./files/delete_all_trailing_spaces_including_blank_lines_sample.js', done)
                .then((testEditor: vscode.TextEditor) => {
                    settings.regexp = "[\\s]+";
                    assertDeleteTrailingSpaces(testEditor, './files/delete_all_trailing_spaces_including_blank_lines_result.js', done);
                });
        });

        it("should only delete trailing spaces in modified lines only", (done: Done) => {
            loadTestFileIntoEditor('./files/delete_trailing_spaces_in_modified_lines_sample.js', done)
                .then((testEditor: vscode.TextEditor) => {
                    settings.deleteModifiedLinesOnly = true;
                    testEditor.edit((editBuilder: vscode.TextEditorEdit) => {
                        editBuilder.insert(new vscode.Position(11, 2), "test");
                        editBuilder.delete(new vscode.Range(1, 0, 1, 3));
                    }).then((flag: boolean) => {
                        assertDeleteTrailingSpaces(testEditor, './files/delete_trailing_spaces_in_modified_lines_result.js', done);
                    });
                });
        });

        it("should delete trailing spaces in all consecutive modified lines only", (done: Done) => {
            loadTestFileIntoEditor('./files/delete_trailing_spaces_in_consecutive_modified_lines_sample.js', done)
                .then((testEditor: vscode.TextEditor) => {
                    settings.deleteModifiedLinesOnly = true;
                    testEditor.edit((editBuilder: vscode.TextEditorEdit) => {
                        editBuilder.insert(new vscode.Position(11, 2), "test");
                        editBuilder.insert(new vscode.Position(12, 2), "test");
                        editBuilder.delete(new vscode.Range(1, 0, 1, 3));
                    }).then((flag: boolean) => {
                        assertDeleteTrailingSpaces(testEditor, './files/delete_trailing_spaces_in_consecutive_modified_lines_result.js', done);
                    });
                });
        });

        it("should delete trailing spaces in newly inserted and modified lines only", (done: Done) => {
            loadTestFileIntoEditor('./files/delete_trailing_spaces_in_new_and_modified_lines_sample.js', done)
                .then((testEditor: vscode.TextEditor) => {
                    settings.deleteModifiedLinesOnly = true;
                    testEditor.edit((editBuilder: vscode.TextEditorEdit) => {
                        editBuilder.insert(new vscode.Position(11, 2), "test");
                        editBuilder.insert(new vscode.Position(12, 2), "test   \n");
                        editBuilder.delete(new vscode.Range(1, 0, 1, 3));
                    }).then((flag: boolean) => {
                        assertDeleteTrailingSpaces(testEditor, './files/delete_trailing_spaces_in_new_and_modified_lines_result.js', done);
                    });
                });
        });
    });

    afterEach((done: Done) => {
        settings.resetToDefaults();
        vscode.commands.executeCommand("workbench.action.closeActiveEditor").then(() => done());
    });

});

let assertDeleteTrailingSpaces = (editor: vscode.TextEditor, expectedOutputFile: string, done: Done): void => {
    let outputFile: string = fs.readFileSync(path.join(__dirname, expectedOutputFile), "utf-8");
    vscode.commands.executeCommand("trailing-spaces.deleteTrailingSpaces").then(() => {
        try {
            assert.equal(editor.document.getText(), outputFile);
        } catch (err) {
            done(err);
            return;
        }
        done();
        return;
    });
};
