'use strict';

import * as vscode from 'vscode';
import { LogLevel, ILogger, Logger } from './logger';

export interface TrailingSpacesSettings {
    logLevel: LogLevel,
    includeEmptyLines: boolean,
    highlightCurrentLine: boolean,
    regexp: string,
    liveMatching: boolean,
    deleteModifiedLinesOnly: boolean,
    languagesToIgnore: { [id: string]: boolean; },
    schemesToIgnore: { [id: string]: boolean; },
    trimOnSave: boolean,
    showStatusBarMessage: boolean,
    textEditorDecorationType: vscode.TextEditorDecorationType
}

export class Settings implements TrailingSpacesSettings {

    private static instance: Settings = new Settings();
    private logger!: ILogger;

    logLevel!: LogLevel;
    includeEmptyLines!: boolean;
    highlightCurrentLine!: boolean;
    regexp!: string;
    liveMatching!: boolean;
    deleteModifiedLinesOnly!: boolean;
    languagesToIgnore!: { [id: string]: boolean; };
    schemesToIgnore!: { [id: string]: boolean; };
    trimOnSave!: boolean;
    showStatusBarMessage!: boolean;
    backgroundColor!: string;
    borderColor!: string;
    textEditorDecorationType!: vscode.TextEditorDecorationType;

    constructor() {
        if (!Settings.instance) {
            Settings.instance = this;
            this.logger = Logger.getInstance();
            this.refreshSettings();
        }
    }

    public static getInstance(): Settings {
        return Settings.instance;
    }

    public refreshSettings(): void {
        let config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('trailing-spaces');
        this.logLevel = LogLevel[this.getOrError<keyof typeof LogLevel>(config, 'logLevel')];
        this.includeEmptyLines = this.getOrError<boolean>(config, 'includeEmptyLines');
        this.highlightCurrentLine = this.getOrError<boolean>(config, 'highlightCurrentLine');
        this.regexp = this.getOrError<string>(config, 'regexp');
        this.liveMatching = this.getOrError<boolean>(config, 'liveMatching');
        this.deleteModifiedLinesOnly = this.getOrError<boolean>(config, 'deleteModifiedLinesOnly');
        this.languagesToIgnore = this.getMapFromStringArray(this.getOrError<string[]>(config, 'syntaxIgnore'));
        this.schemesToIgnore = this.getMapFromStringArray(this.getOrError<string[]>(config, 'schemeIgnore'));
        this.trimOnSave = this.getOrError<boolean>(config, 'trimOnSave');
        this.showStatusBarMessage = this.getOrError<boolean>(config, 'showStatusBarMessage');
        this.setTextEditorDecorationType(config);
        this.logger.setLogLevel(this.logLevel);
        this.logger.setPrefix('Trailing Spaces');
        this.logger.log('Configuration loaded');
    }

    public resetToDefaults(): void {
        let config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('trailing-spaces');
        config.update('logLevel', undefined, true);
        config.update('includeEmptyLines', undefined, true);
        config.update('highlightCurrentLine', undefined, true);
        config.update('regexp', undefined, true);
        config.update('liveMatching', undefined, true);
        config.update('deleteModifiedLinesOnly', undefined, true);
        config.update('syntaxIgnore', undefined, true);
        config.update('schemeIgnore', undefined, true);
        config.update('trimOnSave', undefined, true);
        config.update('showStatusBarMessage', undefined, true);
        config.update('backgroundColor', undefined, true);
        config.update('borderColor', undefined, true);
        this.refreshSettings();
    }

    private getMapFromStringArray(array: string[]): { [id: string]: boolean; } {
        let map: { [id: string]: boolean; } = {};
        array.forEach((element: string) => {
            map[element] = true;
        });
        return map;
    }

    private setTextEditorDecorationType(config: vscode.WorkspaceConfiguration): void {
        let newBackgroundColor = this.getOrError<string>(config, 'backgroundColor');
        let newBorderColor = this.getOrError<string>(config, 'borderColor');

        if (newBackgroundColor !== this.backgroundColor || newBorderColor !== this.borderColor) {
            this.backgroundColor = newBackgroundColor;
            this.borderColor = newBorderColor;
            if (this.textEditorDecorationType) {
                // if an old decoration already exists, dispose it prior to creating a new one
                this.textEditorDecorationType.dispose();
            }
            this.textEditorDecorationType = vscode.window.createTextEditorDecorationType({
                borderRadius: "3px",
                borderWidth: "1px",
                borderStyle: "solid",
                backgroundColor: newBackgroundColor,
                borderColor: newBorderColor
            });
        }
    }

    private getOrError<T>(config: vscode.WorkspaceConfiguration, key: string): T {
        let value = config.get<T>(key);
        if (value === undefined) {
            throw new Error(`Did not expect undefined config: ${key}`);
        } else {
            return value;
        }
    }
}
