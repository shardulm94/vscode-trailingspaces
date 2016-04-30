'use strict';

import * as vscode from 'vscode';
import { LogLevel, ILogger, Logger } from './logger';
import { Config } from './config';
import { TrailingSpaces } from './trailing-spaces';

export default class TrailingSpacesLoader {

    private documentListener: vscode.Disposable;
    private logger: ILogger;
    private config: Config;
    private trailingSpaces: TrailingSpaces;

    constructor() {
        this.logger = Logger.getInstance();
        this.logger.setPrefix('Trailing Spaces');
        this.config = Config.getInstance();
        this.config.load();
        this.trailingSpaces = new TrailingSpaces();
        this.config.onLoad(this.trailingSpaces.loadConfig, this.trailingSpaces);
    }

    public activate(subscriptions: vscode.Disposable[]): void {
        subscriptions.push(this);
        vscode.workspace.onDidChangeConfiguration(this.config.load, this.config, subscriptions);
        vscode.commands.registerTextEditorCommand('trailing-spaces.deleteTrailingSpaces', this.trailingSpaces.delete, this.trailingSpaces);
        vscode.commands.registerTextEditorCommand('trailing-spaces.deleteTrailingSpacesModifiedLinesOnly', this.trailingSpaces.deleteModifiedLinesOnly, this.trailingSpaces);
        vscode.commands.registerTextEditorCommand('trailing-spaces.highlightTrailingSpaces', this.trailingSpaces.highlight, this.trailingSpaces);
        vscode.commands.registerTextEditorCommand('trailing-spaces.deleteInFolder', this.trailingSpaces.deleteInFolder, this.trailingSpaces);
        vscode.commands.registerTextEditorCommand('trailing-spaces.deleteInFolderRecursive', this.trailingSpaces.deleteInFolderRecursive, this.trailingSpaces);
        vscode.commands.registerCommand('trailing-spaces.loadConfig', this.trailingSpaces.loadConfig, this.trailingSpaces);
        this.trailingSpaces.addListeners();
        this.logger.log("Trailing Spaces activated.");
        this.trailingSpaces.initialize();
    }

    public dispose(): void {

    }
}