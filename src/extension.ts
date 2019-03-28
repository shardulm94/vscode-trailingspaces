'use strict';

import * as vscode from 'vscode';
import TrailingSpacesLoader from './trailing-spaces/loader';

export function activate(context: vscode.ExtensionContext) {
    let trailingSpacesLoader: TrailingSpacesLoader = new TrailingSpacesLoader();
    trailingSpacesLoader.activate(context.subscriptions);
}