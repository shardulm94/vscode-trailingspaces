'use strict';

import * as vscode from 'vscode';
import { ILogger, Logger } from './logger';
import { Settings, TrailingSpacesSettings } from './settings';
import * as utils from './utils';
import fs = require('fs');


export class TrailingSpaces {
    private logger: ILogger;
    private settings: TrailingSpacesSettings;

    constructor() {
        this.logger = Logger.getInstance();
        this.settings = Settings.getInstance();
    }

    public highlight(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit | undefined = undefined): void {
        this.highlightTrailingSpaces(editor);
    }

    public delete(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit): void {
        this.deleteTrailingSpaces(editor, editorEdit)
    }

    public deleteModifiedLinesOnly(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit): void {
        this.deleteTrailingSpaces(editor, editorEdit, true);
    }

    /**
     * Highlights the trailing spaces in the current editor.
     *
     * @private
     * @param {vscode.TextEditor} editor The editor in which the spaces have to be highlighted
     */
    private highlightTrailingSpaces(editor: vscode.TextEditor): void {
        editor.setDecorations(this.settings.textEditorDecorationType, this.getRangesToHighlight(editor.document, editor.selection));
    }

    /**
     * Deletes the trailing spaces in the current editor.
     *
     * @private
     * @param {vscode.TextEditor} editor The editor in which the spaces have to be deleted
     * @param {vscode.TextEditorEdit} editBuilder The edit builders for apply deletions
     * @param {boolean} deleteModifiedLinesOnlyOverride Whether to only deleted modified lines regardless of the settings
     */
    private deleteTrailingSpaces(editor: vscode.TextEditor, editBuilder: vscode.TextEditorEdit, deleteModifiedLinesOnlyOverride: boolean = false): void {
        let ranges: vscode.Range[] = this.getRangesToDelete(editor.document, deleteModifiedLinesOnlyOverride);
        for (let i: number = ranges.length - 1; i >= 0; i--) {
            editBuilder.delete(ranges[i]);
        }
        this.showStatusBarMessage(editor.document, ranges.length, true)
    }

    /**
     * Returns the edits required to delete the trailings spaces from a document
     *
     * @param {vscode.TextDocument} document The document in which the trailing spaces should be found
     * @returns {vscode.TextEdit[]} An array of edits required to delete the trailings spaces from the document
     */
    public getEditsForDeletingTralingSpaces(document: vscode.TextDocument): vscode.TextEdit[] {
        let ranges: vscode.Range[] = this.getRangesToDelete(document);
        let edits: vscode.TextEdit[] = new Array<vscode.TextEdit>(ranges.length);
        for (let i: number = ranges.length - 1; i >= 0; i--) {
            edits[ranges.length - 1 - i] = vscode.TextEdit.delete(ranges[i]);
        }
        this.showStatusBarMessage(document, ranges.length);
        return edits;
    }

    /**
     * Displays a status bar message containing the number of trailing space regions deleted
     *
     * @private
     * @param {vscode.TextDocument} document The document for which the message has to be shown
     * @param {number} numRegions Number of trailing space regions found
     * @param {boolean} showIfNoRegions Should the message be shown even if no regions are founds
     */
    private showStatusBarMessage(document: vscode.TextDocument, numRegions: number, showIfNoRegions: boolean = false): void {
        let message: string;
        if (numRegions > 0) {
            message = `Deleting ${numRegions} trailing space region${(numRegions > 1 ? "s" : "")}`;
        } else {
            message = "No trailing spaces to delete!";
        }
        this.logger.info(message + " - " + document.fileName);
        if (this.settings.showStatusBarMessage) {
            if (numRegions > 0 || showIfNoRegions) {
                vscode.window.setStatusBarMessage(message, 3000);
            }
        }
    }

    /**
     * Gets trailing spaces ranges which have to be highlighted.
     *
     * @private
     * @param {vscode.TextDocument} document The document in which the trailing spaces should be found
     * @param {vscode.Selection} selection The current selection inside the editor
     * @returns {vscode.Range[]} An array of ranges containing the trailing spaces
     */
    private getRangesToHighlight(document: vscode.TextDocument, selection: vscode.Selection): vscode.Range[] {
        let ranges: vscode.Range[] = this.findTrailingSpaces(document);

        if (!this.settings.highlightCurrentLine) {
            let currentPosition: vscode.Position = document.validatePosition(selection.end)
            let currentLine: vscode.TextLine = document.lineAt(currentPosition);

            ranges = ranges.filter(range => {
                return range.intersection(currentLine.range) == undefined
            });
        }

        return ranges;
    }

    /**
     * Gets trailing spaces ranges which have to be deleted.
     *
     * @private
     * @param {vscode.TextDocument} document The document in which the trailing spaces should be found
     * @param {boolean} deleteModifiedLinesOnlyOverride Whether to delete only modified lines regardless of the settings
     * @returns {vscode.Range[]} An array of ranges containing the trailing spaces
     */
    private getRangesToDelete(document: vscode.TextDocument, deleteModifiedLinesOnlyOverride: boolean = false): vscode.Range[] {
        let ranges: vscode.Range[] = this.findTrailingSpaces(document);

        // If deleteModifiedLinesOnly is set, filter out the ranges contained in the non-modified lines
        if ((this.settings.deleteModifiedLinesOnly || deleteModifiedLinesOnlyOverride)
            && !document.isUntitled && document.uri.scheme == "file") {
            let modifiedLines: Set<number> = utils.getModifiedLineNumbers(fs.readFileSync(document.uri.fsPath, "utf-8"), document.getText());
            ranges = ranges.filter((range: vscode.Range) => {
                return (modifiedLines.has(range.start.line));
            });
        }
        return ranges;
    }

    /**
     * Finds all ranges in the document which contain trailing spaces
     *
     * @private
     * @param {vscode.TextDocument} document The document in which the trailing spaces should be found
     * @returns {vscode.Range[]} An array of ranges containing the trailing spaces
     */
    private findTrailingSpaces(document: vscode.TextDocument): vscode.Range[] {
        if (this.ignoreFile(document.languageId)) {
            this.logger.info(`File with langauge '${document.languageId}' ignored - ${document.fileName}`);
            return [];
        } else {
            let offendingRanges: vscode.Range[] = [];
            let regexp: string = "(" + this.settings.regexp + ")$";
            let noEmptyLinesRegexp: string = "\\S" + regexp;
            let offendingRangesRegexp: RegExp = new RegExp(this.settings.includeEmptyLines ? regexp : noEmptyLinesRegexp, "gm");
            let documentText: string = document.getText();

            let match: RegExpExecArray | null;
            // Loop through all the trailing spaces in the document
            while ((match = offendingRangesRegexp.exec(documentText)) !== null) {
                let matchStart: number = (match.index + match[0].length - match[1].length),
                    matchEnd: number = match.index + match[0].length;
                let matchRange: vscode.Range = new vscode.Range(document.positionAt(matchStart), document.positionAt(matchEnd));
                // Ignore ranges which are empty (only containing a single line ending)
                if (!matchRange.isEmpty) {
                    offendingRanges.push(matchRange);
                }
            }
            return offendingRanges;
        }
    }

    /**
     * Checks if the language of the file is set to be ignored.
     *
     * @private
     * @param {string} language The language of the file to be checked
     * @returns {boolean} A boolean indicating if the file needs to be ignored
     */
    private ignoreFile(language: string): boolean {
        return language ? (this.settings.languagesToIgnore[language] == true) : false;
    }
}
