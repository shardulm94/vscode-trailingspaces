'use strict';

import * as vscode from 'vscode';
import TrailingSpacesLoader from './trailing-spaces/loader';
import { Settings } from './trailing-spaces/settings';

/**
 * Test-only hooks. The extension returns these only when running outside
 * production (i.e. in the integration-test host); real users get `undefined`,
 * so internal objects are never handed out on the production API surface.
 */
export interface TrailingSpacesTestApi {
    // The same Settings singleton the extension actually uses. The published
    // extension is bundled, so a test importing the Settings module directly
    // would get a *different* instance than the one running inside the host.
    settings: Settings;
    // Decorations cannot be read back through the VSCode API, so this surfaces
    // the ranges most recently highlighted in a given editor for assertions.
    getHighlightedRanges(editor: vscode.TextEditor): readonly vscode.Range[];
}

export function activate(context: vscode.ExtensionContext): TrailingSpacesTestApi | undefined {
    let trailingSpacesLoader: TrailingSpacesLoader = new TrailingSpacesLoader();
    trailingSpacesLoader.activate(context.subscriptions);
    if (context.extensionMode === vscode.ExtensionMode.Production) {
        return undefined;
    }
    return {
        settings: Settings.getInstance(),
        getHighlightedRanges: (editor: vscode.TextEditor) => trailingSpacesLoader.getHighlightedRanges(editor)
    };
}
