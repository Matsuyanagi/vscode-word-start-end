import * as assert from 'assert';
import { cpus } from 'os';
import { findWordBoundary } from '../wordBoundary';

suite('Word boundaries', () => {
	const fixtures: [string, string][] = [
		['|', ''],
		['|abc|', ''],
		['|  \t　|', ''],
		['|リンゴ|を|食|べる|。|  |"|abc|/|def|"|  |+++;;;---|', '"/+;-'],
		['|abc|_|def|', '_'],
		['|abc_def|', ''],
		['|+++|;;;|---|', ';'],
		['|漢字々|ひらがな|カタカナー|・|ＡＢ１２＿|', ''],
		['|éÀ１２abc_Ａｚ|×÷|', ''],
		['|ｶﾞ|', ''],
		['|ﾊﾟ|', ''],
		['|ｶﾞﾊﾟ|', ''],
		['|a|ｶﾞ|b|', ''],
		['|ﾞﾟ|', ''],
		['|か\u3099|', ''],
		['|e|\u0301|', ''],
		['|a|😀|b|', ''],
		['|漢😀字|', ''],
		['|漢|😀|字|', '😀'],
		['|\ud800|a|\udc00|', ''],
		['|\udc00\ud800|', ''],
		['|a| \t|b|', ' \t'],
		['|。、「」|あ|', ''],
	];

	for (const [marked, separators] of fixtures) {
		test(`nearest boundary from every offset: ${JSON.stringify(marked)} (${JSON.stringify(separators)})`, () => {
			const pieces = marked.split('|').slice(1, -1);
			const text = pieces.join('');
			const stops = [0];
			for (const piece of pieces) {
				stops.push(stops[stops.length - 1] + piece.length);
			}
			for (let offset = 0; offset <= text.length; offset++) {
				const left = stops.filter(stop => stop < offset).at(-1) ?? 0;
				const right = stops.find(stop => stop > offset) ?? text.length;
				assert.strictEqual(findWordBoundary(text, offset, 'left', separators), left, `left at ${offset}`);
				assert.strictEqual(findWordBoundary(text, offset, 'right', separators), right, `right at ${offset}`);
			}
		});
	}

	test('reaches the endpoints of a 100,000-character run', () => {
		const text = 'a'.repeat(100_000);
		for (const offset of [0, 1, 50_000, 99_999, 100_000]) {
			assert.strictEqual(findWordBoundary(text, offset, 'left', '"/+;_-'), 0);
			assert.strictEqual(findWordBoundary(text, offset, 'right', '"/+;_-'), text.length);
		}
	});

	test('advances through all boundaries of a 100,000-character alternating line', () => {
		const text = 'aあ'.repeat(50_000);
		for (let offset = 0; offset < text.length; offset++) {
			assert.strictEqual(findWordBoundary(text, offset, 'right', ''), offset + 1);
			assert.strictEqual(findWordBoundary(text, offset + 1, 'left', ''), offset);
		}
	});

	if (process.env.WORD_START_END_BENCHMARK === '1') {
		test('measures long-run searches and alternating-line traversal', function () {
			this.timeout(30_000);
			const separators = '"/+;_-';
			const text = 'a'.repeat(100_000);
			const alternating = 'aあ'.repeat(50_000);
			for (let warmup = 0; warmup < 10; warmup++) {
				findWordBoundary(text, 0, 'right', separators);
				findWordBoundary(text, text.length, 'left', separators);
			}
			const environment = { node: process.version, electron: process.versions.electron,
				platform: process.platform, arch: process.arch, cpu: cpus()[0]?.model, separators };
			let start = performance.now();
			for (let repetition = 0; repetition < 100; repetition++) {
				assert.strictEqual(findWordBoundary(text, 0, 'right', separators), text.length);
				assert.strictEqual(findWordBoundary(text, text.length, 'left', separators), 0);
			}
			console.log('[benchmark]', JSON.stringify({ ...environment, fixture: 'ASCII run',
				length: text.length, operations: 200, elapsedMs: performance.now() - start }));
			for (let offset = 0; offset < alternating.length; offset++) {
				findWordBoundary(alternating, offset, 'right', separators);
				findWordBoundary(alternating, offset + 1, 'left', separators);
			}
			start = performance.now();
			for (let repetition = 0; repetition < 5; repetition++) {
				for (let offset = 0; offset < alternating.length; offset++) {
					assert.strictEqual(findWordBoundary(alternating, offset, 'right', separators), offset + 1);
					assert.strictEqual(findWordBoundary(alternating, offset + 1, 'left', separators), offset);
				}
			}
			console.log('[benchmark]', JSON.stringify({ ...environment, fixture: 'alternating a/hiragana',
				length: alternating.length, operations: 1_000_000, elapsedMs: performance.now() - start }));
		});
	}
});
