import * as assert from 'assert';
import * as vscode from 'vscode';

const left = 'word-start-end.cursorWordLeft';
const right = 'word-start-end.cursorWordRight';
const ownSetting = 'word-start-end.wordSeparators';
const inheritedSetting = 'editor.wordSeparators';
let fileNumber = 0;

suite('Word movement commands', function () {
	this.timeout(20_000);
	let restoreSettings: (() => Thenable<void>)[];

	setup(() => { restoreSettings = []; });

	teardown(async () => {
		try {
			for (const restore of restoreSettings.reverse()) {
				await restore();
			}
		} finally {
			await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
			await vscode.commands.executeCommand('workbench.action.closeAllEditors');
		}
	});

	async function configure(key: string, value: unknown, document?: vscode.TextDocument, language = false) {
		const configuration = vscode.workspace.getConfiguration(undefined, document);
		const inspected = configuration.inspect(key);
		const previous = language ? inspected?.workspaceLanguageValue : inspected?.workspaceValue;
		await configuration.update(key, value, vscode.ConfigurationTarget.Workspace, language);
		restoreSettings.push(() => configuration.update(key, previous, vscode.ConfigurationTarget.Workspace, language));
	}

	async function open(text: string, language = 'plaintext'): Promise<vscode.TextEditor> {
		const folder = vscode.workspace.workspaceFolders?.[0];
		assert.ok(folder, 'Tests require an isolated workspace');
		const uri = vscode.Uri.joinPath(folder.uri, `fixture-${fileNumber++}.txt`);
		await vscode.workspace.fs.writeFile(uri, Buffer.from(text, 'utf8'));
		const document = await vscode.languages.setTextDocumentLanguage(await vscode.workspace.openTextDocument(uri), language);
		return vscode.window.showTextDocument(document);
	}

	async function move(editor: vscode.TextEditor, command: string, line: number, character: number) {
		editor.selection = new vscode.Selection(line, character, line, character);
		await vscode.commands.executeCommand(command);
		return editor.selection.active;
	}

	test('registers both commands without assigning default keys', async () => {
		const extension = vscode.extensions.all.find(item => item.packageJSON.name === 'word-start-end');
		assert.ok(extension);
		await vscode.commands.executeCommand(left);
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes(left));
		assert.ok(commands.includes(right));
		assert.strictEqual(extension.packageJSON.contributes.keybindings?.length ?? 0, 0);
	});

	test('does nothing without an active editor', async () => {
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
		assert.strictEqual(vscode.window.activeTextEditor, undefined);
		await vscode.commands.executeCommand(left);
		await vscode.commands.executeCommand(right);
		assert.strictEqual(vscode.window.activeTextEditor, undefined);
	});

	for (const eol of ['\n', '\r\n']) {
		test(`visits every boundary and empty line with ${JSON.stringify(eol)}`, async () => {
			await configure(ownSetting, '"/+;-');
			const marked = '|リンゴ|を|食|べる|。|  |"|abc|/|def|"|  |+++;;;---|';
			const pieces = marked.split('|').slice(1, -1);
			const text = pieces.join('');
			const editor = await open(['', text, '', ''].join(eol));
			const document = editor.document;
			const original = { text: document.getText(), version: document.version, dirty: document.isDirty };
			const stops = [new vscode.Position(0, 0), new vscode.Position(1, 0)];
			let offset = 0;
			for (const piece of pieces) {
				offset += piece.length;
				stops.push(new vscode.Position(1, offset));
			}
			stops.push(new vscode.Position(2, 0), new vscode.Position(3, 0));
			editor.selection = new vscode.Selection(stops[0], stops[0]);
			for (const expected of stops.slice(1)) {
				await vscode.commands.executeCommand(right);
				assert.ok(editor.selection.active.isEqual(expected), `right to ${expected.line}:${expected.character}`);
				assert.ok(editor.selection.isEmpty);
			}
			await vscode.commands.executeCommand(right);
			assert.ok(editor.selection.active.isEqual(stops.at(-1)!));
			for (const expected of stops.slice(0, -1).reverse()) {
				await vscode.commands.executeCommand(left);
				assert.ok(editor.selection.active.isEqual(expected), `left to ${expected.line}:${expected.character}`);
			}
			await vscode.commands.executeCommand(left);
			assert.ok(editor.selection.active.isEqual(stops[0]));
			assert.deepStrictEqual({ text: document.getText(), version: document.version, dirty: document.isDirty }, original);
		});
	}

	test('leaves an empty document at its only position', async () => {
		const editor = await open('');
		for (const command of [left, right]) {
			assert.ok((await move(editor, command, 0, 0)).isEqual(new vscode.Position(0, 0)));
		}
	});

	test('moves every selection from its active endpoint and clears the range', async () => {
		await configure(ownSetting, '');
		const editor = await open('abc def\nabc def');
		for (const command of [left, right]) {
			editor.selections = [new vscode.Selection(0, 0, 0, 2), new vscode.Selection(1, 2, 1, 0)];
			await vscode.commands.executeCommand(command);
			assert.strictEqual(editor.selections.length, 2);
			const expected = command === right
				? [new vscode.Position(0, 3), new vscode.Position(1, 3)]
				: [new vscode.Position(0, 0), new vscode.Position(0, 7)];
			for (let line = 0; line < 2; line++) {
				assert.ok(editor.selections[line].active.isEqual(expected[line]));
				assert.ok(editor.selections[line].isEmpty);
			}
		}
	});

	test('keeps halfwidth voiced and semi-voiced katakana together', async () => {
		await configure(ownSetting, '');
		const editor = await open('aｶﾞﾊﾟb');
		for (const offset of [2, 3, 4]) {
			assert.strictEqual((await move(editor, left, 0, offset)).character, 1);
			assert.strictEqual((await move(editor, right, 0, offset)).character, 5);
		}
	});

	test('inherits settings only when the independent value is absent or null', async () => {
		const editor = await open('abc_def');
		await configure(inheritedSetting, '_');
		await configure(ownSetting, undefined);
		assert.strictEqual((await move(editor, right, 0, 0)).character, 3);
		await configure(ownSetting, '');
		assert.strictEqual((await move(editor, right, 0, 0)).character, 7);
		await configure(ownSetting, null);
		assert.strictEqual((await move(editor, right, 0, 0)).character, 3);
		await configure(inheritedSetting, '');
		assert.strictEqual((await move(editor, right, 0, 0)).character, 7);
		await configure(ownSetting, '_');
		assert.strictEqual((await move(editor, right, 0, 0)).character, 3);
		assert.strictEqual(vscode.workspace.getConfiguration('editor', editor.document).get('wordSeparators'), '');
	});

	test('resolves language overrides for the active document', async () => {
		let plain = await open('abc_def');
		let typescript = await open('abc_def', 'typescript');
		await configure(inheritedSetting, '');
		await configure(inheritedSetting, '_', typescript.document, true);
		await configure(ownSetting, null);
		assert.strictEqual((await move(typescript, right, 0, 0)).character, 3);
		plain = await vscode.window.showTextDocument(plain.document);
		assert.strictEqual((await move(plain, right, 0, 0)).character, 7);
		await configure(ownSetting, '', typescript.document, true);
		typescript = await vscode.window.showTextDocument(typescript.document);
		assert.strictEqual((await move(typescript, right, 0, 0)).character, 7);
	});

	test('preserves dirty text and the text undo operation', async () => {
		await configure(ownSetting, '');
		const editor = await open('abc');
		await editor.edit(edit => edit.insert(new vscode.Position(0, 3), ' def'));
		const version = editor.document.version;
		assert.ok(editor.document.isDirty);
		await move(editor, left, 0, 7);
		await vscode.commands.executeCommand(right);
		assert.strictEqual(editor.document.getText(), 'abc def');
		assert.strictEqual(editor.document.version, version);
		assert.ok(editor.document.isDirty);
		await vscode.commands.executeCommand('undo');
		assert.strictEqual(editor.document.getText(), 'abc');
	});
});
