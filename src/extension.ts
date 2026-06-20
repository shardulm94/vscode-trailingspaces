'use strict';

import * as vscode from 'vscode';
import TrailingSpacesLoader from './trailing-spaces/loader';
import { Settings } from './trailing-spaces/settings';

export interface TrailingSpacesApi {
    settings: Settings;
}

export function activate(context: vscode.ExtensionContext): TrailingSpacesApi {
    let trailingSpacesLoader: TrailingSpacesLoader = new TrailingSpacesLoader();
    trailingSpacesLoader.activate(context.subscriptions);
    // Exposed so integration tests can drive the same Settings singleton the
    // extension actually uses. The published extension is bundled, so a test
    // importing the Settings module directly would get a *different* instance
    // than the one running inside the extension host.
    return { settings: Settings.getInstance() };
}
