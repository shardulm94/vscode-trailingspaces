'use strict';

import * as vscode from 'vscode';
import { LogLevel, ILogger, Logger } from './logger';
import { Config } from './config';
import * as utils from './utils';
import fs = require('fs');
import path = require('path');
import glob = require('glob');
import {TextEditorEdit, WorkspaceEdit} from 'vscode';

export interface TrailingRegions {
    offendingLines: vscode.Range[],
    highlightable: vscode.Range[]
}

export interface TralingSpacesSettings {
    includeEmptyLines: boolean,
    highlightCurrentLine: boolean,
    regexp: string,
    liveMatching: boolean,
    deleteModifiedLinesOnly: boolean,
    syntaxIgnore: string[],
    trimOnSave: boolean,
    saveAfterTrim: boolean
}

export class TrailingSpaces {
    private logger: ILogger;
    private config: Config;
    private decorationOptions: vscode.DecorationRenderOptions = {
        borderRadius: "3px",
        borderWidth: "1px",
        borderStyle: "solid",
        backgroundColor: "rgba(255,0,0,0.3)",
        borderColor: "rgba(255,100,100,0.15)"
    };
    private decorationType: vscode.TextEditorDecorationType;
    private matchedRegions: { [id: string]: TrailingRegions; };
    private onDisk: { [id: string]: string; };
    private languagesToIgnore: { [id: string]: boolean; };
    private settings: TralingSpacesSettings;
    private highlightSettings: TralingSpacesSettings;

    constructor() {
        this.logger = Logger.getInstance();
        this.config = Config.getInstance();
        this.languagesToIgnore = {};
        this.matchedRegions = {};
        this.onDisk = {};
        this.loadConfig();
        this.decorationType = vscode.window.createTextEditorDecorationType(this.decorationOptions);
    }

    public loadConfig(settings?: string): void {
        if (settings)
            this.settings = JSON.parse(settings);
        else
            this.settings = {
                includeEmptyLines: this.config.get<boolean>("includeEmptyLines"),
                highlightCurrentLine: this.config.get<boolean>("highlightCurrentLine"),
                regexp: this.config.get<string>("regexp"),
                liveMatching: this.config.get<boolean>("liveMatching"),
                deleteModifiedLinesOnly: this.config.get<boolean>("deleteModifiedLinesOnly"),
                syntaxIgnore: this.config.get<string[]>("syntaxIgnore"),
                trimOnSave: this.config.get<boolean>("trimOnSave"),
                saveAfterTrim: this.config.get<boolean>("saveAfterTrim")
            }
        this.matchedRegions = {};
        this.refreshLanguagesToIgnore();
    }

    private refreshLanguagesToIgnore() {
        this.languagesToIgnore = {};
        this.settings.syntaxIgnore.map((language: string) => {
            this.languagesToIgnore[language] = true;
        });
    }

    public addListeners(): void {
        vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor) => {
            if (!editor) return;
            this.logger.log(`onDidChangeActiveTextEditor event called - ${editor.document.fileName}`);
            this.freezeLastVersion(editor.document);
            if (this.settings.liveMatching)
                return this.matchTrailingSpaces(editor);
            return;
        });
        vscode.window.onDidChangeTextEditorSelection((e: vscode.TextEditorSelectionChangeEvent) => {
            let editor = e.textEditor;
            this.logger.log(`onDidChangeTextEditorSelection event called - ${editor.document.fileName}`);
            if (this.settings.liveMatching)
                this.matchTrailingSpaces(editor);
            return;
        });
        vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
            this.logger.log(`onDidChangeTextDocument event called - ${e.document.fileName}`);
            if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document == e.document)
                if (this.settings.liveMatching)
                    this.matchTrailingSpaces(vscode.window.activeTextEditor);
        });
        vscode.workspace.onDidOpenTextDocument((document: vscode.TextDocument) => {
            this.logger.log(`onDidOpenTextDocument event called - ${document.fileName}`);
            if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document == document)
                if (this.settings.liveMatching)
                    this.matchTrailingSpaces(vscode.window.activeTextEditor);
        });
        vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
            this.logger.log(`onDidSaveTextDocument event called - ${document.fileName}`);
            vscode.window.visibleTextEditors.forEach((editor: vscode.TextEditor) => {
                if (document.uri === editor.document.uri)
                    if (this.settings.trimOnSave) {
                        editor.edit((editBuilder: vscode.TextEditorEdit) => {
                            this.delete(editor, editBuilder);
                        }).then(() => {
                            editor.document.save().then(() => {
                                this.freezeLastVersion(editor.document);
                            });
                        });
                    } else {
                        this.freezeLastVersion(editor.document);
                    }
            });
        });
        vscode.workspace.onDidCloseTextDocument((document: vscode.TextDocument) => {
            this.logger.log(`onDidCloseTextDocument event called - ${document.fileName}`);
            this.onDisk[document.uri.toString()] = null;
        });
    }

    public initialize(): void {
        if (this.settings.liveMatching) {
            vscode.window.visibleTextEditors.forEach((editor: vscode.TextEditor) => {
                this.matchTrailingSpaces(editor);
            });
            this.logger.info("All visible text editors highlighted");
        }
        this.refreshLanguagesToIgnore();
    }

    public delete(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit): void {
        this.deleteCore(editor.document, editor.selection, this.settings);
    }

    public deleteModifiedLinesOnly(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit): void {
        let modifiedLinesSettings: TralingSpacesSettings = Object.assign({}, this.settings);
        modifiedLinesSettings.deleteModifiedLinesOnly = true;
        this.deleteCore(editor.document, editor.selection, modifiedLinesSettings);
    }

    public highlight(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit): void {
        this.matchTrailingSpaces(editor);
    }

    public deleteInFolder(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit): void {
        this.deleteInFolderCore(editor.document, false);
    }

    public deleteInFolderRecursive(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit): void {
        this.deleteInFolderCore(editor.document, true);
    }

    private deleteCore(document: vscode.TextDocument, selection: vscode.Selection, settings: TralingSpacesSettings): void {
        let workspaceEdit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
        let end = document.validatePosition(selection.end);
        this.deleteTrailingRegions(document, settings, document.lineAt(end), workspaceEdit);
        if (workspaceEdit.size > 0) {
            vscode.workspace.applyEdit(workspaceEdit).then(() => {
                if (this.settings.saveAfterTrim && !this.settings.trimOnSave)
                    document.save();
            });
        }
    }

    private deleteInFolderCore(document: vscode.TextDocument, recursive: boolean = false): void {
        let folderPath: string = path.dirname(document.uri.fsPath);
        this.logger.info(`Deleting trailing spaces in folder (${recursive ? "" : "non-"}recursive) - ${folderPath}`);
        let workspaceEdit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
        let totalFilesProcessed: number = 0;
        let totalEdits: number = 0;
        let ignoredFiles: number = 0;

        let globsToIgnore: string[] = [];
        globsToIgnore = globsToIgnore.concat(utils.getTrueKeys(vscode.workspace.getConfiguration('search').get<any>('exclude')));
        globsToIgnore = globsToIgnore.map((g: string) => { return "**/" + g + "/**" });
        globsToIgnore = globsToIgnore.concat(utils.getTrueKeys(vscode.workspace.getConfiguration('files').get<any>('exclude')));

        let filePaths: string[] = glob.sync(folderPath + (recursive ? "/**" : "") + "/*.*", { nodir: true, ignore: globsToIgnore });
        let promises: PromiseLike<void>[] = [];
        filePaths.forEach((filePath: string) => {
            let promise: PromiseLike<void> = vscode.workspace.openTextDocument(vscode.Uri.file(filePath)).then((document: vscode.TextDocument) => {
                totalFilesProcessed++;
                if (!document) return;
                let edits: number = 0;
                edits = this.deleteTrailingRegions(document, this.settings, null, workspaceEdit);
                if (edits !== undefined) totalEdits += edits;
                else ignoredFiles++;
                let message: string = `Processing: ${totalFilesProcessed}/${filePaths.length} - ${filePath}`;
                vscode.window.setStatusBarMessage(message);
                this.logger.info(message);
            }, (reason: any) => {
                this.logger.error(reason);
            });
            promises.push(promise);
        }, this);
        Promise.all(promises).then(() => {
            if (workspaceEdit.size > 0) {
                vscode.workspace.applyEdit(workspaceEdit).then(() => {
                    let message: string = `Deleted ${totalEdits} trailing spaces in ${totalFilesProcessed - ignoredFiles} files. ${ignoredFiles} files ignored.`;
                    vscode.window.setStatusBarMessage(message);
                    this.logger.info(message);
                });
            } else {
                let message: string = `No trailing spaces to delete in ${totalFilesProcessed - ignoredFiles} files. ${ignoredFiles} files ignored.`;
                vscode.window.setStatusBarMessage(message);
                this.logger.info(message);
            }
        }, (reason: any) => {
            this.logger.error(reason);
        });
    }

    /**
     * Deletes trailing spaces within the given document.
     *
     * @private
     * @param {vscode.TextDocument} document The document from which the ranges have to be found
     * @param {TralingSpacesSettings} settings The settings to be used
     * @param {vscode.TextLine} currentLine The line on which the cursor currently is
     * @param {vscode.WorkspaceEdit} workspaceEdit The workspaceEdit instance to be used to apply edits
     * @returns {number} The number of trailing space regions deleted. If the file was ignored, undefined will be returned
     */
    private deleteTrailingRegions(document: vscode.TextDocument, settings: TralingSpacesSettings, currentLine: vscode.TextLine, workspaceEdit: vscode.WorkspaceEdit): number {
        let message: string;
        let edits: number = 0;
        if (this.ignoreFile(document.languageId)) {
            message = `File with langauge '${document.languageId}' ignored`;
            edits = undefined;
        } else {
            let regions: vscode.Range[] = this.getRegionsToDelete(document, settings, currentLine);
            if (regions.length > 0) {
                // Delete from the bottom to the top
                for (let i: number = regions.length - 1; i >= 0; i--) {
                    workspaceEdit.delete(document.uri, regions[i]);
                }
                message = `Deleted ${regions.length} trailing spaces region ${(regions.length > 1 ? "s" : "")}`;
                edits = regions.length;
            } else {
                message = "No trailing spaces to delete!";
            }
        }
        this.logger.info(message + " - " + document.fileName);
        vscode.window.setStatusBarMessage(message, 3000);
        return edits;
    }

    /**
     * Highlights the trailing spaces in the current editor.
     *
     * @private
     * @param {vscode.TextEditor} editor The editor for which the spaces have to be highlighted
     */
    private matchTrailingSpaces(editor: vscode.TextEditor): void {
        let regions: TrailingRegions = { offendingLines: [], highlightable: [] };
        if (this.ignoreFile(editor.document.languageId)) {
            this.logger.info(`File with langauge '${editor.document.languageId}' ignored - ${editor.document.fileName}`);
        } else {
            let posn = editor.document.validatePosition(editor.selection.end)
            regions = this.findTrailingSpaces(editor.document, this.settings, editor.document.lineAt(posn));
        }
        this.matchedRegions[editor.document.uri.toString()] = regions;
        editor.setDecorations(this.decorationType, regions.highlightable);
    }

    /**
     * Checks if the language of the file is set to be ignored.
     *
     * @private
     * @param {string} language The language of the file to be checked
     * @returns {boolean} A boolean indicating if the file needs to be ignored
     */
    private ignoreFile(language: string): boolean {
        return language ? (this.languagesToIgnore[language] == true) : false;
    }

    /**
     * Stores the version of the file on the disk in order to compare and get the modified lines.
     *
     * @private
     * @param {vscode.TextDocument} document The document whose `on disk` version has to fetched
     */
    private freezeLastVersion(document: vscode.TextDocument): void {
        if (document.isUntitled) return;
        this.onDisk[document.uri.toString()] = fs.readFileSync(document.uri.fsPath, "utf-8");
        this.logger.log(`File frozen - ${document.uri.fsPath}`);
    }

    /**
     * Gets ranges which have to be deleted. Avoids finding regions again if live matching is enabled and regions have already been matched for the document;
     * returns the already matched ranges instead.
     *
     * @private
     * @param {vscode.TextDocument} document The document from which the ranges have to be found
     * @param {TralingSpacesSettings} settings The settings to be used
     * @param {vscode.TextLine} [currentLine=null] The line on which the cursor currently is
     * @returns {vscode.Range[]} An array of ranges to be deleted
     */
    private getRegionsToDelete(document: vscode.TextDocument, settings: TralingSpacesSettings, currentLine: vscode.TextLine = null): vscode.Range[] {
        let regions: TrailingRegions;
        // If regions have already been matched for the document, return them instead of finding them again
        if (settings.liveMatching && this.matchedRegions[document.uri.toString()]) {
            regions = this.matchedRegions[document.uri.toString()];
        } else {
            regions = this.findTrailingSpaces(document, settings, currentLine);
        }
        // If deleteModifiedLinesOnly is set, filter out the ranges contained in the non-modified lines
        if (settings.deleteModifiedLinesOnly && !document.isUntitled) {
            let modifiedLines: number[] = utils.getModifiedLineNumbers(this.onDisk[document.uri.toString()], document.getText());
            regions.offendingLines = regions.offendingLines.filter((range: vscode.Range) => {
                return (modifiedLines.indexOf(range.start.line) >= 0);
            });
        }
        return regions.offendingLines;
    }

    /**
     * Finds all ranges in the document which contain trailing spaces based.
     *
     * @private
     * @param {vscode.TextDocument} document The document in which the trailing spaces should be found
     * @param {TralingSpacesSettings} settings The settings to be used
     * @param {vscode.TextLine} [currentLine=null] The line on which the cursor currently is. Only used in case the `highlightCurrentLine` property is set to false
     * @returns {TrailingRegions} An object containg 2 arrays of ranges; first has all the ranges, second contains only the ranges to be highlighted
     */
    private findTrailingSpaces(document: vscode.TextDocument, settings: TralingSpacesSettings, currentLine: vscode.TextLine = null): TrailingRegions {
        let regexp: string = "(" + settings.regexp + ")$";
        let noEmptyLinesRegexp = "\\S" + regexp;
        let offendingRangesRegexp: RegExp = new RegExp(settings.includeEmptyLines ? regexp : noEmptyLinesRegexp, "gm");
        let offendingRanges: vscode.Range[] = [];
        let highlightable: vscode.Range[] = [];
        let documentText: string = document.getText();
        let currentLineStart: number = document.offsetAt(currentLine.range.start),
            currentLineEnd: number = document.offsetAt(currentLine.range.end);
        let match: RegExpExecArray;
        // Loop through all the trailing spaces in the document
        while (match = offendingRangesRegexp.exec(documentText)) {
            let matchStart: number = (match.index + match[0].length - match[1].length),
                matchEnd: number = match.index + match[0].length;
            let matchRange: vscode.Range = new vscode.Range(document.positionAt(matchStart), document.positionAt(matchEnd));
            // Ignore ranges which are empty (only containing a single line ending)
            if (!matchRange.isEmpty) {
                offendingRanges.push(matchRange);
                let overlap: boolean = (matchEnd >= currentLineStart && currentLineEnd >= matchStart); // Checks whether the range or a part of it lies in the current line
                if (!settings.highlightCurrentLine && currentLine && overlap) {
                    // Push only those parts of the range which do not lie in the current line
                    if (matchStart < currentLineStart) {
                        highlightable.push(new vscode.Range(matchRange.start, currentLine.range.start));
                    }
                    if (currentLineEnd < matchEnd) {
                        highlightable.push(new vscode.Range(currentLine.range.end, matchRange.end));
                    }
                } else {
                    highlightable.push(matchRange);
                }
            }
        }
        return { offendingLines: offendingRanges, highlightable: highlightable };
    }
}