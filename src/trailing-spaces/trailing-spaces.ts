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
    private languagesToIgnore: { [id: string]: boolean; };
    private settings: TralingSpacesSettings;
    private highlightSettings: TralingSpacesSettings;

    constructor() {
        this.logger = Logger.getInstance();
        this.config = Config.getInstance();
        this.loadConfig();
        this.decorationType = vscode.window.createTextEditorDecorationType(this.decorationOptions);
        this.matchedRegions = {};
        this.languagesToIgnore = {};
    }

    public loadConfig(): void {
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
    }

    public setSettings(settings: TralingSpacesSettings) {
        this.settings = settings;
    }

    public addListeners(): void {
        vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor) => {
            this.logger.log("onDidChangeActiveTextEditor event called - " + editor.document.fileName);
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
                            editor.document.save();
                        });
                    }
            });
        });
    }

    public initialize(): void {
        if (this.settings.liveMatching) {
            vscode.window.visibleTextEditors.forEach((editor: vscode.TextEditor) => {
                this.matchTrailingSpaces(editor);
            });
            this.logger.log("All visible text editors highlighted");
        }
        this.settings.syntaxIgnore.map((language: string) => {
            this.languagesToIgnore[language] = true;
        })
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
        let regions: vscode.Range[] = this.findRegionsToDelete(editor.document, settings, editor.document.lineAt(editor.selection.end));

        if (regions) {
            regions.reverse();
            regions.forEach((region: vscode.Range) => {
                editorEdit.delete(region);
            });
        }

        let message: string;
        if (regions.length > 0) {
            message = "Deleted " + regions.length + " trailing spaces region" + (regions.length > 1 ? "s" : "");
        } else {
            message = "No trailing spaces to delete!";
        }

        this.logger.log(message);
        vscode.window.setStatusBarMessage(message, 3000);
    }

    private matchTrailingSpaces(editor: vscode.TextEditor): void {
        if (this.ignoreFile(editor)) {
            this.logger.log("File with langauge '" + editor.document.languageId + "' ignored.");
            return;
        }

        let regions: TrailingRegions = this.findTrailingSpaces(editor.document, this.settings, editor.document.lineAt(editor.selection.end));
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
        let onDisk: string = null;
        if (document.fileName)
            onDisk = fs.readFileSync(document.fileName, "utf-8");
        let onBuffer: string = document.getText();

        return this.modifiedLinesAsNumbers(onDisk, onBuffer);
    }

    private findRegionsToDelete(document: vscode.TextDocument, settings: TralingSpacesSettings, currentLine: vscode.TextLine = null): vscode.Range[] {
        let regions: TrailingRegions;

        if (settings.liveMatching && this.matchedRegions[document.uri.toString()])
            regions = this.matchedRegions[document.uri.toString()];
        else
            regions = this.findTrailingSpaces(document, settings, currentLine);

        if (settings.deleteModifiedLinesOnly) {
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

        let offendingLines: vscode.Range[] = [];
        let offendingLinesRegexp: RegExp = new RegExp(settings.includeEmptyLines ? regexp : noEmptyLinesRegexp);

        for (let i: number = 0; i < document.lineCount; i++) {
            let line: vscode.TextLine = document.lineAt(i);
            let match: RegExpExecArray = offendingLinesRegexp.exec(line.text);
            if (match) {
                offendingLines.push(new vscode.Range(new vscode.Position(i, line.text.lastIndexOf(match[1])), line.range.end));
            }
        }

        if (!settings.highlightCurrentLine && currentLine) {
            let currentOffender: RegExpExecArray = offendingLinesRegexp.exec(currentLine.text);
            let currentOffenderRange: vscode.Range = (!currentOffender) ? null : (new vscode.Range(new vscode.Position(currentLine.lineNumber, currentLine.text.lastIndexOf(currentOffender[1])), currentLine.range.end));
            let removal: vscode.Range = (!currentOffenderRange) ? null : currentLine.range.intersection(currentOffenderRange);
            let highlightable: vscode.Range[] = [];
            if (removal) {
                for (let i: number = 0; i < offendingLines.length; i++) {
                    if (!offendingLines[i].isEqual(currentOffenderRange)) {
                        highlightable.push(offendingLines[i]);
                    }
                }
            } else {
                highlightable = offendingLines;
            }
            return { offendingLines: offendingLines, highlightable: highlightable };
        } else {
            return { offendingLines: offendingLines, highlightable: offendingLines };
        }
    }

}