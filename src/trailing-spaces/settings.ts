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
    trimOnSave: boolean
}

export class Settings implements TrailingSpacesSettings {

    private static instance: Settings = new Settings();
    private config!: vscode.WorkspaceConfiguration;
    private logger!: ILogger;

    logLevel!: LogLevel;
    includeEmptyLines!: boolean;
    highlightCurrentLine!: boolean;
    regexp!: string;
    liveMatching!: boolean;
    deleteModifiedLinesOnly!: boolean;
    languagesToIgnore!: { [id: string]: boolean; };
    trimOnSave!: boolean;

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
        this.config = vscode.workspace.getConfiguration('trailing-spaces');
        this.logLevel = LogLevel[this.config.get<keyof typeof LogLevel>('logLevel')];
        this.includeEmptyLines = this.config.get<boolean>('includeEmptyLines');
        this.highlightCurrentLine = this.config.get<boolean>('highlightCurrentLine');
        this.regexp = this.config.get<string>('regexp');
        this.liveMatching = this.config.get<boolean>('liveMatching');
        this.deleteModifiedLinesOnly = this.config.get<boolean>('deleteModifiedLinesOnly');
        this.languagesToIgnore = this.getLanguagesToIgnore(this.config.get<string[]>('syntaxIgnore'));
        this.trimOnSave = this.config.get<boolean>('trimOnSave');
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
        config.update('trimOnSave', undefined, true);
        this.refreshSettings()
    }

    private getLanguagesToIgnore(syntaxIgnore: string[]): { [id: string]: boolean; } {
        let languagesToIgnore: { [id: string]: boolean; } = {};
        syntaxIgnore.forEach((language: string) => {
            this.languagesToIgnore[language] = true;
        });
        return languagesToIgnore;
    }
}
