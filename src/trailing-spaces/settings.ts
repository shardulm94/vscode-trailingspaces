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
        this.logLevel = LogLevel[config.get<keyof typeof LogLevel>('logLevel')];
        this.includeEmptyLines = config.get<boolean>('includeEmptyLines');
        this.highlightCurrentLine = config.get<boolean>('highlightCurrentLine');
        this.regexp = config.get<string>('regexp');
        this.liveMatching = config.get<boolean>('liveMatching');
        this.deleteModifiedLinesOnly = config.get<boolean>('deleteModifiedLinesOnly');
        this.languagesToIgnore = this.getMapFromStringArray(config.get<string[]>('syntaxIgnore'));
        this.schemesToIgnore = this.getMapFromStringArray(config.get<string[]>('schemeIgnore'));
        this.trimOnSave = config.get<boolean>('trimOnSave');
        this.showStatusBarMessage = config.get<boolean>('showStatusBarMessage');
        this.textEditorDecorationType = this.getTextEditorDecorationType(config.get<string>('backgroundColor'), config.get<string>('borderColor'));
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

    private getTextEditorDecorationType(backgroundColor: string, borderColor: string): vscode.TextEditorDecorationType {
        return vscode.window.createTextEditorDecorationType({
            borderRadius: "3px",
            borderWidth: "1px",
            borderStyle: "solid",
            backgroundColor: backgroundColor,
            borderColor: borderColor
        });
    }
}
