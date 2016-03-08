'use strict';

import * as vscode from 'vscode';
import { LogLevel, ILogger, Logger } from './utils/logger';

export class Config {

    private static instance: Config = new Config();
    private config: vscode.WorkspaceConfiguration;
    private logger: ILogger;

    constructor() {
        if (!Config.instance) {
            Config.instance = this;
            this.logger = Logger.getInstance();
            this.load();
        }
    }

    public static getInstance(): Config {
        return Config.instance;
    }

    public load(): void {
        this.config = vscode.workspace.getConfiguration('trailing-spaces');
        this.logger.setLogLevel(<LogLevel>LogLevel[this.get<string>('logLevel')]);
        this.logger.log('Configuration loaded');
    }

    public get<T>(key: string): T {
        return this.config.get<T>(key);
    }
}