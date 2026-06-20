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

    public getHighlightedRanges(editor: vscode.TextEditor): readonly vscode.Range[] {
        return this.trailingSpaces.getHighlightedRanges(editor);
    }

    public activate(subscriptions: vscode.Disposable[]): void {
        subscriptions.push(this);
        this.initialize(subscriptions);
        this.logger.log("Trailing Spaces activated.");
    }

    private initialize(subscriptions: vscode.Disposable[]): void {
        vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
            // Only reinitialize when our own configuration changes. Reacting to
            // unrelated config events needlessly reloads settings (and, during
            // tests, races with manually-set overrides).
            if (e.affectsConfiguration('trailing-spaces')) {
                this.reinitialize();
            }
        }, this, subscriptions);
        this.registerCommands(subscriptions);
        this.registerEventListeners();
        this.highlightActiveEditors();
    }

    private reinitialize(): void {
        this.dispose();
        this.settings.refreshSettings();
        this.registerEventListeners();
        this.highlightActiveEditors();
    }

    private registerCommands(subscriptions: vscode.Disposable[]): void {
        subscriptions.push(
            vscode.commands.registerTextEditorCommand('trailing-spaces.deleteTrailingSpaces', this.trailingSpaces.delete, this.trailingSpaces),
            vscode.commands.registerTextEditorCommand('trailing-spaces.deleteTrailingSpacesModifiedLinesOnly', this.trailingSpaces.deleteModifiedLinesOnly, this.trailingSpaces),
            vscode.commands.registerTextEditorCommand('trailing-spaces.highlightTrailingSpaces', this.trailingSpaces.highlight, this.trailingSpaces)
        );
    }

    private registerEventListeners(): void {
        let disposables: vscode.Disposable[] = [];
        if (this.settings.liveMatching) {
            disposables.push(
                vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor | undefined) => {
                    if (editor !== undefined) {
                        this.logger.log(`onDidChangeActiveTextEditor event called - ${editor.document.fileName}`);
                        this.trailingSpaces.highlight(editor);
                    }
                }),
                vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
                    this.logger.log(`onDidChangeTextDocument event called - ${event.document.fileName}`);
                    // Re-highlight every visible editor showing this document, not
                    // just the active one. When the same file is open in split view,
                    // editing one pane must refresh the other pane's decorations too,
                    // otherwise highlights desync between panes (issue #71).
                    this.highlightEditorsForDocument(event.document);
                }),
                vscode.workspace.onDidOpenTextDocument((document: vscode.TextDocument) => {
                    this.logger.log(`onDidOpenTextDocument event called - ${document.fileName}`);
                    this.highlightEditorsForDocument(document);
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
                    const document: vscode.TextDocument = event.document;
                    // Record the version we compute the edits against and discard
                    // them if the document has moved on, so stale ranges are never
                    // applied to shifted content (issue #80). VSCode already ignores
                    // will-save edits on concurrent modification; this is
                    // defense-in-depth on top of that.
                    const versionAtSnapshot: number = document.version;
                    event.waitUntil(Promise.resolve().then(() =>
                        this.trailingSpaces.getEditsForDeletingTralingSpaces(document, versionAtSnapshot)
                    ));
                })
            );
        }
        this.listenerDisposables = disposables;
    }

    private highlightEditorsForDocument(document: vscode.TextDocument): void {
        vscode.window.visibleTextEditors
            .filter((editor: vscode.TextEditor) => editor.document === document)
            .forEach((editor: vscode.TextEditor) => this.trailingSpaces.highlight(editor));
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
            });
        }
    }
}
