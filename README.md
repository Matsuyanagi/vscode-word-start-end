# Word Start End

日本語や英数字の文字種が切り替わる位置へ、カーソルを左右に移動する VS Code 拡張です。VS Code 1.140.0 以降に対応しています。

## 使い方

コマンドパレットから次のコマンドを実行します。初期キー割り当てはありません。

| コマンド | コマンド ID |
| --- | --- |
| Word Start End: Move to Previous Word Boundary | `word-start-end.cursorWordLeft` |
| Word Start End: Move to Next Word Boundary | `word-start-end.cursorWordRight` |

VS Code の標準的な区切り設定では、次の `|` の位置に停止します。`|` は説明用の印で、文書には挿入されません。

```text
|リンゴ|を|食|べる|。|  |"|abc|/|def|"|  |+++;;;---|
```

- 単語の途中からは、移動方向の最寄りの境界へ移動します。境界上からは、次の境界へ移動します。
- 連続する空白・記号も一つの区間として扱い、その前後に停止します。
- 行末から右へ移動すると次行の先頭へ、行頭から左へ移動すると前行の末尾へ移動します。空行にも停止します。
- 複数カーソルに対応します。選択範囲がある場合は、操作側の端から移動し、選択を解除します。
- `ｶﾞ`・`ﾊﾟ` は分割せず、連続する半角カタカナとして扱います。

### キーを割り当てる

キーボードショートカット画面で上記コマンドを検索して割り当てるか、`keybindings.json` に追加してください。次の例は `Ctrl+Left` / `Ctrl+Right` を使用します。

```json
[
  {
    "key": "ctrl+left",
    "command": "word-start-end.cursorWordLeft",
    "when": "editorTextFocus"
  },
  {
    "key": "ctrl+right",
    "command": "word-start-end.cursorWordRight",
    "when": "editorTextFocus"
  }
]
```

macOS では、例えば `alt+left` / `alt+right` を指定すると Option キーで操作できます。

## 区切り文字の設定

`word-start-end.wordSeparators` は、この拡張だけに適用する区切り文字の一覧です。ユーザー・ワークスペース・フォルダー・言語ごとに設定できます。変更は次の移動から反映されます。

| 設定値 | 動作 |
| --- | --- |
| 未設定、または `null`（既定値） | 現在の文書に適用される `editor.wordSeparators` を参照します。 |
| 文字列 | その文字列だけを区切り文字一覧として使用します。標準設定との合成は行いません。 |
| `""` | 明示的な区切り文字を使用しません。日本語の文字種や空白・句読点による区切りは有効です。 |

例えば、次の設定では `abc_def` が `|abc|_|def|` に分かれます。空文字列を設定した場合は `|abc_def|` になります。

```json
{
  "word-start-end.wordSeparators": "_"
}
```

設定した文字は文字種より優先して区切り文字に分類します。異なる区切り文字でも、隣り合っていれば一つの区間になります。`editor.wordSeparators` 自体は変更しません。

## 文字の扱い

漢字などの「その他」、ひらがな、カタカナ、英数字、空白、句読点・記号、設定した区切り文字を分類します。英数字には全角英数字とアンダースコアも含みます。形態素解析や camelCase の分割は行いません。

サロゲートペアの途中には停止しません。ただし、一般の結合文字や複数文字からなる絵文字の表示単位を完全には扱いません。漢字と絵文字など、同じ「その他」分類が続く場合は一つの区間になります。文書の文字列は変更・正規化しません。

## 参考実装

文字分類は [Japanese Word Handler](https://github.com/sgryjp/japanese-word-handler) を参考にしています。変更点とライセンスは [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照してください。
