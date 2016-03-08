'use strict';

import * as vscode from 'vscode';
import { LogLevel, ILogger, Logger } from './utils/logger';
import { Config } from './config';
import TrailingSpaces from './trailing-spaces';

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
    }

    public activate(subscriptions: vscode.Disposable[]): void {
        subscriptions.push(this);
        vscode.workspace.onDidChangeConfiguration(this.config.load, this.config, subscriptions);
        vscode.commands.registerTextEditorCommand('trailing-spaces.deleteTrailingSpaces', this.trailingSpaces.deleteTrailingSpaces, this.trailingSpaces);
        vscode.commands.registerTextEditorCommand('trailing-spaces.highlightTrailingSpaces', this.trailingSpaces.highlightTrailingSpaces, this.trailingSpaces);
        this.trailingSpaces.addListeners();
        this.logger.log("Trailing Spaces activated.");
        this.trailingSpaces.initialize();
    }

    public dispose(): void {
        
    }


}