'use strict';

import * as vscode from 'vscode';
import { LogLevel, ILogger, Logger } from './utils/logger';
import { Config } from './config';
import jsdiff = require('diff');
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
    saveAfterTrim: boolean,
    backgroundColor: string,
    borderColor: string
}

export class TrailingSpaces {

    private logger: ILogger;
    private config: Config;
    private decorationOptions: vscode.DecorationRenderOptions;
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
                saveAfterTrim: this.config.get<boolean>("saveAfterTrim"),
                backgroundColor: this.config.get<string>("backgroundColor"),
                borderColor: this.config.get<string>("borderColor")
            }
        this.decorationOptions = this.getDecorationOptions();
        this.matchedRegions = {};
        this.refreshLanguagesToIgnore();
    }

    private getDecorationOptions() {
        return {
            borderRadius: "3px",
            borderWidth: "1px",
            borderStyle: "solid",
            backgroundColor: this.settings.backgroundColor,
            borderColor: this.settings.borderColor
        }
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
            this.logger.log("onDidChangeActiveTextEditor event called - " + editor.document.fileName);
            this.freezeLastVersion(editor.document);
            if (this.settings.liveMatching)
                return this.matchTrailingSpaces(editor);
            return;
        });

        vscode.window.onDidChangeTextEditorSelection((e: vscode.TextEditorSelectionChangeEvent) => {
            let editor = e.textEditor;
            this.logger.log("onDidChangeTextEditorSelection event called - " + editor.document.fileName);
            if (this.settings.liveMatching)
                this.matchTrailingSpaces(editor);
            return;
        });
        vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
            this.logger.log("onDidChangeTextDocument event called - " + e.document.fileName);
            if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document == e.document)
                if (this.settings.liveMatching)
                    this.matchTrailingSpaces(vscode.window.activeTextEditor);
        });
        vscode.workspace.onDidOpenTextDocument((document: vscode.TextDocument) => {
            this.logger.log("onDidOpenTextDocument event called - " + document.fileName);
            if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document == document)
                if (this.settings.liveMatching)
                    this.matchTrailingSpaces(vscode.window.activeTextEditor);
        });
        vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
            this.logger.log("onDidSaveTextDocument event called - " + document.fileName);
            vscode.window.visibleTextEditors.forEach((editor: vscode.TextEditor) => {
                if (document.uri === editor.document.uri)
                    if (this.settings.trimOnSave) {
                        editor.edit((editBuilder: vscode.TextEditorEdit) => {
                            this.deleteTrailingSpaces(editor, editBuilder);
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
            this.logger.log("onDidCloseTextDocument event called - " + document.fileName);
            this.onDisk[document.uri.toString()] = null;
        });
    }

    public initialize(): void {
        if (this.settings.liveMatching) {
            vscode.window.visibleTextEditors.forEach((editor: vscode.TextEditor) => {
                this.matchTrailingSpaces(editor);
            });
            this.logger.log("All visible text editors highlighted");
        }
        this.refreshLanguagesToIgnore();
    }

    public deleteTrailingSpaces(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit): void {
        this.deleteTrailingSpacesCore(editor.document, editor.selection, this.settings);
    }

    public deleteTrailingSpacesModifiedLinesOnly(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit): void {
        let modifiedLinesSettings: TralingSpacesSettings = Object.assign({}, this.settings);
        modifiedLinesSettings.deleteModifiedLinesOnly = true;
        this.deleteTrailingSpacesCore(editor.document, editor.selection, modifiedLinesSettings);
    }

    public highlightTrailingSpaces(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit): void {
        this.matchTrailingSpaces(editor);
    }

    public deleteInFolder(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit): void {
        this.deleteInFolderCore(editor.document, false);
    }

    public deleteInFolderRecursive(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit): void {
        this.deleteInFolderCore(editor.document, true);
    }

    private deleteTrailingSpacesCore(document: vscode.TextDocument, selection: vscode.Selection, settings: TralingSpacesSettings): void {
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
        this.logger.log("Deleting trailing spaces in folder (" + (recursive ? "" : "non-") + "recursive) - " + folderPath);
        let workspaceEdit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
        let totalFilesProcessed: number = 0;
        let totalEdits: number = 0;
        let ignoredFiles: number = 0;
        let globsToIgnore: string[] = [];

        function getTrueKeys(obj: Object): string[] {
            let trueKeys: string[] = [];
            for (var key in obj) {
                if (obj.hasOwnProperty(key) && obj[key] == true) {
                    trueKeys.push(key);
                }
            }
            return trueKeys;
        }

        globsToIgnore = globsToIgnore.concat(getTrueKeys(vscode.workspace.getConfiguration('search').get<any>('exclude')));
        globsToIgnore = globsToIgnore.map((g: string) => { return "**/" + g + "/**" });
        globsToIgnore = globsToIgnore.concat(getTrueKeys(vscode.workspace.getConfiguration('files').get<any>('exclude')));
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
                vscode.window.setStatusBarMessage("Processing: " + totalFilesProcessed + "/" + filePaths.length + " - " + filePath);
                this.logger.log("Processing: " + totalFilesProcessed + "/" + filePaths.length + " - " + filePath);
            }, (reason: any) => {
                this.logger.log(reason);
            });
            promises.push(promise);
        }, this);
        Promise.all(promises).then(() => {
            if (workspaceEdit.size > 0) {
                vscode.workspace.applyEdit(workspaceEdit).then(() => {
                    vscode.window.setStatusBarMessage("Deleted " + totalEdits + " trailing spaces in " + (totalFilesProcessed - ignoredFiles) + " files. " + ignoredFiles + " files ignored.");
                });
            } else {
                vscode.window.setStatusBarMessage("No trailing spaces to delete in " + (totalFilesProcessed - ignoredFiles) + " files. " + ignoredFiles + " files ignored.");
            }
        }, (reason: any) => {
            this.logger.log(reason);
        });
    }

    private deleteTrailingRegions(document: vscode.TextDocument, settings: TralingSpacesSettings, currentLine: vscode.TextLine, workspaceEdit: vscode.WorkspaceEdit): number {
        let message: string;
        let edits: number = 0;
        if (this.ignoreFile(document)) {
            message = "File with langauge '" + document.languageId + "' ignored.";
            edits = undefined;
        } else {
            let regions: vscode.Range[] = this.findRegionsToDelete(document, settings, currentLine);

            if (regions) {
                regions.reverse();
                regions.forEach((region: vscode.Range) => {
                    workspaceEdit.delete(document.uri, region);
                });
            }

            if (regions.length > 0) {
                message = "Deleted " + regions.length + " trailing spaces region" + (regions.length > 1 ? "s" : "");
            } else {
                message = "No trailing spaces to delete!";
            }
            edits += regions.length;
        }
        this.logger.log(message);
        vscode.window.setStatusBarMessage(message, 3000);
        return edits;
    }

    private matchTrailingSpaces(editor: vscode.TextEditor): void {
        let regions: TrailingRegions = { offendingLines: [], highlightable: [] };
        if (this.ignoreFile(editor.document)) {
            this.logger.log("File with langauge '" + editor.document.languageId + "' ignored.");
        } else {
            let posn = editor.document.validatePosition(editor.selection.end)
            regions = this.findTrailingSpaces(editor.document, this.settings, editor.document.lineAt(posn));
        }
        this.addTrailingSpacesRegions(editor.document, regions);
        this.highlightTrailingSpacesRegions(editor, regions.highlightable);
    }

    private ignoreFile(document: vscode.TextDocument): boolean {
        let viewSyntax: string = document.languageId;
        return viewSyntax ? (this.languagesToIgnore[viewSyntax] == true) : false;
    }

    private addTrailingSpacesRegions(document: vscode.TextDocument, regions: TrailingRegions): void {
        this.matchedRegions[document.uri.toString()] = regions;
    }

    private highlightTrailingSpacesRegions(editor: vscode.TextEditor, highlightable: vscode.Range[]): void {
        editor.setDecorations(this.decorationType, []);
        editor.setDecorations(this.decorationType, highlightable);
    }

    private modifiedLinesAsNumbers(oldFile: string, newFile: string): number[] {
        let diffs: jsdiff.IDiffResult[] = jsdiff.diffLines(oldFile, newFile);

        let lineNumber: number = 0;
        let editedLines: number[] = [];
        diffs.forEach((diff: jsdiff.IDiffResult) => {
            if (diff.added)
                editedLines.push(lineNumber);
            if (!diff.removed)
                lineNumber += diff.count;
        });
        return editedLines;
    }

    private getModifiedLineNumbers(document: vscode.TextDocument): number[] {
        let onBuffer: string = document.getText();
        return this.modifiedLinesAsNumbers(this.onDisk[document.uri.toString()], onBuffer);
    }

    public freezeLastVersion(document: vscode.TextDocument) {
        if (document.isUntitled) return;
        this.onDisk[document.uri.toString()] = fs.readFileSync(document.uri.fsPath, "utf-8");
        this.logger.log("File frozen - " + document.uri.fsPath);
    }

    private findRegionsToDelete(document: vscode.TextDocument, settings: TralingSpacesSettings, currentLine: vscode.TextLine = null): vscode.Range[] {
        let regions: TrailingRegions;

        if (settings.liveMatching && this.matchedRegions[document.uri.toString()])
            regions = this.matchedRegions[document.uri.toString()];
        else
            regions = this.findTrailingSpaces(document, settings, currentLine);

        if (settings.deleteModifiedLinesOnly && !document.isUntitled) {
            let modifiedLines: number[] = this.getModifiedLineNumbers(document);

            function onlyThoseWithTrailingSpaces(regions: TrailingRegions, modifiedLines: number[]): TrailingRegions {
                return {
                    offendingLines: regions.offendingLines.filter((range: vscode.Range) => {
                        return (modifiedLines.indexOf(range.start.line) >= 0);
                    }),
                    highlightable: []
                }
            }

            regions = onlyThoseWithTrailingSpaces(regions, modifiedLines);
        }
        return regions.offendingLines;
    }

    private findTrailingSpaces(document: vscode.TextDocument, settings: TralingSpacesSettings, currentLine: vscode.TextLine = null): TrailingRegions {

        let regexp: string = "(" + settings.regexp + ")$";
        let noEmptyLinesRegexp = "\\S" + regexp;

        let offendingRanges: vscode.Range[] = [];
        let offendingRangesRegexp: RegExp = new RegExp(settings.includeEmptyLines ? regexp : noEmptyLinesRegexp, "gm");
        let documentText: string = document.getText();

        let match: RegExpExecArray;
        while (match = offendingRangesRegexp.exec(documentText)) {
            let matchRange: vscode.Range = new vscode.Range(document.positionAt(match.index + match[0].length - match[1].length), document.positionAt(match.index + match[0].length));
            if (!matchRange.isEmpty)
                offendingRanges.push(matchRange);
        }

        if (!settings.highlightCurrentLine && currentLine) {
            let highlightable: vscode.Range[] = [];
            let lineText: string = currentLine.text + '\n';
            let currentOffender: RegExpExecArray = offendingRangesRegexp.exec(lineText);
            let currentOffenderRange: vscode.Range = (!currentOffender) ? null : (new vscode.Range(new vscode.Position(currentLine.lineNumber, lineText.lastIndexOf(currentOffender[1])), currentLine.range.end));
            let removal: vscode.Range = (!currentOffenderRange) ? null : currentLine.range.intersection(currentOffenderRange);
            if (removal) {
                for (let i: number = 0; i < offendingRanges.length; i++) {
                    if (!offendingRanges[i].contains(currentOffenderRange)) {
                        highlightable.push(offendingRanges[i]);
                    } else {
                        function splitRange(range: vscode.Range): vscode.Range[] {
                            let returnRanges: vscode.Range[] = [];
                            for (let i: number = range.start.line; i <= range.end.line; i++) {
                                returnRanges.push(document.lineAt(i).range.intersection(range));
                            }
                            return returnRanges;
                        }
                        let lineNumber: number = currentLine.lineNumber;
                        let splitRanges: vscode.Range[] = splitRange(offendingRanges[i]);
                        for (let i: number = 0; i < splitRanges.length; i++) {
                            if (splitRanges[i].start.line != lineNumber)
                                highlightable.push(splitRanges[i]);
                        }
                    }
                }
            } else {
                highlightable = offendingRanges;
            }
            return { offendingLines: offendingRanges, highlightable: highlightable };
        } else {
            return { offendingLines: offendingRanges, highlightable: offendingRanges };
        }
    }

}