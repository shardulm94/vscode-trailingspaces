'use strict';

import * as vscode from 'vscode';
import { LogLevel, ILogger, Logger } from './utils/logger';
import { Config } from './config';
import jsdiff = require('diff');
import fs = require('fs');

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
        editor.edit((editBuilder: vscode.TextEditorEdit) => {
            this.deleteTrailingRegions(editor, editBuilder, this.settings);
        }).then(() => {
            if (this.settings.saveAfterTrim && !this.settings.trimOnSave)
                editor.document.save();
        });
    }

    public deleteTrailingSpacesModifiedLinesOnly(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit): void {
        let modifiedLinesSettings: TralingSpacesSettings = Object.assign({}, this.settings);
        modifiedLinesSettings.deleteModifiedLinesOnly = true;
        editor.edit((editBuilder: vscode.TextEditorEdit) => {
            this.deleteTrailingRegions(editor, editBuilder, modifiedLinesSettings);
        }).then(() => {
            if (this.settings.saveAfterTrim && !this.settings.trimOnSave)
                editor.document.save();
        });
    }

    public highlightTrailingSpaces(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit): void {
        this.matchTrailingSpaces(editor);
    }

    private deleteTrailingRegions(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit, settings: TralingSpacesSettings): void {
        let message: string;

        if (this.ignoreFile(editor)) {
            message = "File with langauge '" + editor.document.languageId + "' ignored.";
        } else {
            let regions: vscode.Range[] = this.findRegionsToDelete(editor.document, settings, editor.document.lineAt(editor.selection.end));

            if (regions) {
                regions.reverse();
                regions.forEach((region: vscode.Range) => {
                    editorEdit.delete(region);
                });
            }

            if (regions.length > 0) {
                message = "Deleted " + regions.length + " trailing spaces region" + (regions.length > 1 ? "s" : "");
            } else {
                message = "No trailing spaces to delete!";
            }
        }
        this.logger.log(message);
        vscode.window.setStatusBarMessage(message, 3000);
    }

    private matchTrailingSpaces(editor: vscode.TextEditor): void {
        let regions: TrailingRegions = { offendingLines: [], highlightable: [] };
        if (this.ignoreFile(editor)) {
            this.logger.log("File with langauge '" + editor.document.languageId + "' ignored.");
        } else {
            regions = this.findTrailingSpaces(editor.document, this.settings, editor.document.lineAt(editor.selection.end));
        }
        this.addTrailingSpacesRegions(editor.document, regions);
        this.highlightTrailingSpacesRegions(editor, regions.highlightable);
    }

    private ignoreFile(editor: vscode.TextEditor): boolean {
        let viewSyntax: string = editor.document.languageId;
        return (this.languagesToIgnore[viewSyntax] == true);
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