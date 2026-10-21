import { defineConfig } from '@vscode/test-cli';
import { mkdirSync, mkdtempSync } from 'node:fs';

const cache = new URL('./.vscode-test/', import.meta.url);
mkdirSync(cache, { recursive: true });
const workspaceFolder = mkdtempSync(new URL('workspace-', cache));
const installation = process.env.VSCODE_TEST_PATH;

export default defineConfig({
	files: 'out/test/**/*.test.js',
	workspaceFolder,
	launchArgs: ['--disable-extensions'],
	useInstallation: installation ? { fromPath: installation } : undefined,
});
