import * as path from 'path';

import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        // When `npm test` is run from VS Code's integrated terminal (or any
        // Electron-spawned shell), ELECTRON_RUN_AS_NODE is inherited and forces
        // the test instance of VS Code to launch as plain Node, which rejects
        // all the Chromium launch flags ("bad option: --no-sandbox") and aborts.
        // Strip it so the test harness can launch the real editor.
        delete process.env.ELECTRON_RUN_AS_NODE;

        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to test runner
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // Which VS Code build to test against. CI sets VSCODE_VERSION to run the
        // suite on both `stable` and `insiders`; Insiders ships newer bundled
        // Node ahead of stable, which is where runtime breakages (e.g. removed
        // `util.*` helpers) surface first. Defaults to `stable` locally.
        const version = process.env.VSCODE_VERSION || 'stable';

        // Download VS Code, unzip it and run the integration test
        await runTests({ extensionDevelopmentPath, extensionTestsPath, version });
    } catch (err) {
        console.error('Failed to run tests');
        process.exit(1);
    }
}

main();
