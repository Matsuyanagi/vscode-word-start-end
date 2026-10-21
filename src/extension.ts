import * as vscode from 'vscode';
import { findWordBoundary, type Direction } from './wordBoundary';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('word-start-end.cursorWordLeft', () => moveCursors('left')),
		vscode.commands.registerCommand('word-start-end.cursorWordRight', () => moveCursors('right')),
	);
}

export function deactivate() {}

function resolveWordSeparators(document: vscode.TextDocument): string {
	const configured = vscode.workspace.getConfiguration('word-start-end', document).get<unknown>('wordSeparators');
	if (typeof configured === 'string') {
		return configured;
	}
	const inherited = vscode.workspace.getConfiguration('editor', document).get<unknown>('wordSeparators');
	return typeof inherited === 'string' ? inherited : '';
}

function moveCursors(direction: Direction): void {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}
	const document = editor.document;
	const separators = resolveWordSeparators(document);
	const lines = new Map<number, string>();
	function lineText(line: number): string {
		let text = lines.get(line);
		if (text === undefined) {
			text = document.lineAt(line).text;
			lines.set(line, text);
		}
		return text;
	}

	editor.selections = editor.selections.map(selection => {
		let { line, character } = selection.active;
		const text = lineText(line);
		if (direction === 'left' && character === 0 && line > 0) {
			character = lineText(--line).length;
		} else if (direction === 'right' && character === text.length && line < document.lineCount - 1) {
			line++;
			character = 0;
		} else {
			character = findWordBoundary(text, character, direction, separators);
		}
		return new vscode.Selection(line, character, line, character);
	});
	if (editor.selections.length === 1) {
		editor.revealRange(editor.selection);
	}
}
