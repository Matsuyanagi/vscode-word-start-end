export type Direction = 'left' | 'right';

const enum CharClass {
	Alnum,
	Whitespace,
	Punctuation,
	Hiragana,
	Katakana,
	Other,
	Separator,
}

// Adapted from Japanese Word Handler; modified ranges and Unicode traversal. See THIRD_PARTY_NOTICES.md.
function classify(ch: number, wordSeparators: string): CharClass {
	if (wordSeparators.includes(String.fromCodePoint(ch))) {
		return CharClass.Separator;
	}
	if ((ch >= 0x09 && ch <= 0x0d) || ch === 0x20 || ch === 0x3000) {
		return CharClass.Whitespace;
	}
	if (
		(ch >= 0x30 && ch <= 0x39) ||
		(ch >= 0xff10 && ch <= 0xff19) ||
		(ch >= 0x41 && ch <= 0x5a) || ch === 0x5f ||
		(ch >= 0x61 && ch <= 0x7a) ||
		(ch >= 0xc0 && ch <= 0xff && ch !== 0xd7 && ch !== 0xf7) ||
		(ch >= 0xff21 && ch <= 0xff3a) || ch === 0xff3f ||
		(ch >= 0xff41 && ch <= 0xff5a)
	) {
		return CharClass.Alnum;
	}
	if (
		(ch >= 0x21 && ch <= 0x2f) ||
		(ch >= 0x3a && ch <= 0x40) ||
		(ch >= 0x5b && ch <= 0x60) ||
		(ch >= 0x7b && ch <= 0x7f) ||
		(ch >= 0x3001 && ch <= 0x303f && ch !== 0x3005) || ch === 0x30fb ||
		(ch >= 0xff01 && ch <= 0xff0f) ||
		(ch >= 0xff1a && ch <= 0xff20) ||
		(ch >= 0xff3b && ch <= 0xff40) ||
		(ch >= 0xff5b && ch <= 0xff65) ||
		(ch >= 0xffe0 && ch <= 0xffee)
	) {
		return CharClass.Punctuation;
	}
	if ((ch >= 0x30a0 && ch <= 0x30ff) || (ch >= 0xff66 && ch <= 0xff9f)) {
		return CharClass.Katakana;
	}
	if (ch >= 0x3041 && ch <= 0x309f) {
		return CharClass.Hiragana;
	}
	return CharClass.Other;
}

function codePointStart(text: string, offset: number): number {
	const current = text.charCodeAt(offset);
	const previous = text.charCodeAt(offset - 1);
	return current >= 0xdc00 && current <= 0xdfff && previous >= 0xd800 && previous <= 0xdbff
		? offset - 1 : offset;
}

export function findWordBoundary(text: string, offset: number, direction: Direction, wordSeparators: string): number {
	if (direction === 'left') {
		if (offset === 0) {
			return offset;
		}
		let position = codePointStart(text, offset - 1);
		const category = classify(text.codePointAt(position)!, wordSeparators);
		while (position > 0) {
			const previous = codePointStart(text, position - 1);
			if (classify(text.codePointAt(previous)!, wordSeparators) !== category) {
				break;
			}
			position = previous;
		}
		return position;
	}
	if (offset === text.length) {
		return offset;
	}
	let position = codePointStart(text, offset);
	let ch = text.codePointAt(position)!;
	const category = classify(ch, wordSeparators);
	do {
		position += ch > 0xffff ? 2 : 1;
		if (position === text.length) {
			break;
		}
		ch = text.codePointAt(position)!;
	} while (classify(ch, wordSeparators) === category);
	return position;
}
