'use strict';

import * as vscode from 'vscode';
import { ILogger, Logger } from './logger';
import { Settings } from './settings';
import { TrailingSpaces } from './trailing-spaces';

export default class TrailingSpacesLoader {

    private logger: ILogger;
    private settings: Settings;
    private trailingSpaces: TrailingSpaces;
    private listenerDisposables: vscode.Disposable[] | undefined;

    constructor() {
        this.logger = Logger.getInstance();
        this.settings = Settings.getInstance();
        this.trailingSpaces = new TrailingSpaces();
    }

    public activate(subscriptions: vscode.Disposable[]): void {
        subscriptions.push(this);
        this.initialize(subscriptions);
        this.logger.log("Trailing Spaces activated.");
    }

    private initialize(subscriptions: vscode.Disposable[]): void {
        vscode.workspace.onDidChangeConfiguration(this.reinitialize, this, subscriptions);
        this.registerCommands(subscriptions);
        this.registerEventListeners();
        this.highlightActiveEditors()
    }

    private reinitialize(): void {
        this.dispose();
        this.settings.refreshSettings();
        this.registerEventListeners();
        this.highlightActiveEditors()
    }

    private registerCommands(subscriptions: vscode.Disposable[]): void {
        subscriptions.push(
            vscode.commands.registerTextEditorCommand('trailing-spaces.deleteTrailingSpaces', this.trailingSpaces.delete, this.trailingSpaces),
            vscode.commands.registerTextEditorCommand('trailing-spaces.deleteTrailingSpacesModifiedLinesOnly', this.trailingSpaces.deleteModifiedLinesOnly, this.trailingSpaces),
            vscode.commands.registerTextEditorCommand('trailing-spaces.highlightTrailingSpaces', this.trailingSpaces.highlight, this.trailingSpaces)
        )
    }

    private registerEventListeners(): void {
        let disposables: vscode.Disposable[] = []
        if (this.settings.liveMatching) {
            disposables.push(
                vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor | undefined) => {
                    if (editor !== undefined) {
                        this.logger.log(`onDidChangeActiveTextEditor event called - ${editor.document.fileName}`);
                        this.trailingSpaces.highlight(editor);
                    }
                }),
                vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
                    if (vscode.window.activeTextEditor !== undefined && vscode.window.activeTextEditor.document == event.document) {
                        this.logger.log(`onDidChangeTextDocument event called - ${event.document.fileName}`);
                        this.trailingSpaces.highlight(vscode.window.activeTextEditor);
                    }
                }),
                vscode.workspace.onDidOpenTextDocument((document: vscode.TextDocument) => {
                    if (vscode.window.activeTextEditor !== undefined && vscode.window.activeTextEditor.document == document) {
                        this.logger.log(`onDidOpenTextDocument event called - ${document.fileName}`);
                        this.trailingSpaces.highlight(vscode.window.activeTextEditor);
                    }
                })
            );

            if (!this.settings.highlightCurrentLine) {
                disposables.push(
                    vscode.window.onDidChangeTextEditorSelection((event: vscode.TextEditorSelectionChangeEvent) => {
                        let editor: vscode.TextEditor = event.textEditor;
                        this.logger.log(`onDidChangeTextEditorSelection event called - ${editor.document.fileName}`);
                        this.trailingSpaces.highlight(editor);
                    })
                );
            }
        }

        if (this.settings.trimOnSave) {
            disposables.push(
                vscode.workspace.onWillSaveTextDocument((event: vscode.TextDocumentWillSaveEvent) => {
                    this.logger.log(`onWillSaveTextDocument event called - ${event.document.fileName}`);
                    vscode.window.visibleTextEditors.forEach((editor: vscode.TextEditor) => {
                        if (event.document.uri === editor.document.uri) {
                            event.waitUntil(Promise.resolve(this.trailingSpaces.getEditsForDeletingTralingSpaces(editor.document)));
                        }
                    });
                })
            );
        }
        this.listenerDisposables = disposables;
    }

    private highlightActiveEditors(): void {
        if (this.settings.liveMatching) {
            vscode.window.visibleTextEditors.forEach((editor: vscode.TextEditor) => {
                this.trailingSpaces.highlight(editor);
            });
            this.logger.info("All visible text editors highlighted");
        }
    }

    public dispose(): void {
        if (this.listenerDisposables !== undefined) {
            this.listenerDisposables.forEach(disposable => {
                disposable.dispose();
            })
        }
    }
}
