# Word Start End Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Use superpowers:subagent-driven-development only if the user selects delegated execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every editor cursor to the nearest strictly earlier or later character-class boundary, including whitespace boundaries and adjacent line edges.

**Architecture:** A pure TypeScript function finds a boundary in one line. The extension resolves separator configuration for the active document, handles line transitions, and updates selections. The implementation must use the existing VS Code extension scaffold and test runner.

**Tech Stack:** TypeScript, VS Code API, Mocha/assert through `@vscode/test-cli`, existing ESLint configuration.

**Spec:** `docs/plan.md`, supplemented by the user decisions and proposed details below. The original requirements file must remain unchanged.

**Status:** The user approved implementation. All three implementation tasks are complete. Compilation, lint, 35 normal tests, and 36 tests with the opt-in benchmark passed. Physical key-repeat and visual scrolling checks remain unperformed because native-app automation is unavailable. VSIX contents remain unverified because no packaging tool is installed. See `docs/verification.md` for results and limitations.

## Confirmed requirements

- The extension must expose left and right word-boundary movement.
- Both directions must use the same stopping positions. A cursor at a boundary must advance to the next boundary in the requested direction.
- Whitespace runs must have boundaries on both sides. Movement must not skip whitespace and an adjacent word in one invocation.
- Right movement from a line end must stop at the next line start. Left movement from a line start must stop at the previous line end.
- Character classification must use `reference/japanese-word-handler` as a reference.
- Intrinsic character classification must keep halfwidth katakana and their voiced or semi-voiced marks in one run, including `ｶﾞ` and `ﾊﾟ`.
- The extension must provide a separator setting independent of `editor.wordSeparators`. When the extension setting is absent, movement must use the applicable `editor.wordSeparators` value.
- The extension must contribute no default keybindings. Users assign keys themselves.
- Frequent cursor movement must remain responsive.

## Approved implementation details

### Commands and editor behavior

- Command IDs: `word-start-end.cursorWordLeft` and `word-start-end.cursorWordRight`.
- Command titles: `Word Start End: Move to Previous Word Boundary` and `Word Start End: Move to Next Word Boundary`.
- Commands must appear in the Command Palette. The extension must not register handlers under VS Code's built-in command IDs.
- All selections must move independently from `Selection.active`; each resulting selection must be empty. This follows the reference extension's movement behavior, including reversed selections.
- With one resulting selection, reveal the destination using `editor.revealRange`. With multiple selections, follow the reference behavior and do not explicitly scroll.
- With no active text editor, the command must return without a notification or exception.
- At the document start or end, outward movement must leave the cursor unchanged. An empty document must remain at `(0, 0)`.
- Line transitions must use `lineAt(previousLine).text.length` or `(nextLine, 0)`, so CRLF and LF produce the same logical positions. Empty lines must not be skipped.
- Movement must leave document contents, dirty state, and text undo history unchanged.

### Separator configuration

- Setting key: `word-start-end.wordSeparators`.
- Manifest type: `["string", "null"]`; default: `null`; scope: `language-overridable`.
- Resolve both settings with the active `TextDocument` as the configuration scope, including URI and language.
- A string value, including `""`, must replace the inherited separator string completely. Do not merge the strings.
- An absent or `null` value must select the effective `editor.wordSeparators` value for the same document. Do not copy a hard-coded VS Code default into the extension manifest.
- Read configuration once per command, outside the selection loop. Changes must affect the next command without reloading the extension. No persistent configuration cache or change listener is necessary.
- Treat an invalid non-string extension value as inheritance. If the inherited value is unexpectedly non-string, use `""` as a safe fallback. Do not show notifications during movement.
- A configured separator must receive the `Separator` class before intrinsic character classification. Adjacent separator characters form one run even when the characters differ.
- Empty configuration disables only the explicit separator class. Intrinsic punctuation and Japanese character-class boundaries still apply.
- Example: for `abc_def`, setting `"_"` yields `|abc|_|def|`; setting `""` yields `|abc_def|`.

### Character classification and Unicode scope

- Start from the reference `makeClassifier` rules in `reference/japanese-word-handler/src/web/extension.ts:375`.
- Preserve the reference ordering and ranges for `Whitespace`, `Alnum`, `Punctuation`, `Katakana`, `Hiragana`, and `Other`, after the configurable `Separator` check, except for the halfwidth katakana range extension specified below.
- This includes fullwidth alphanumeric characters, underscores, fullwidth space, halfwidth katakana, the katakana long vowel mark, and the reference treatment of `々` and `・`.
- Extend the halfwidth `Katakana` range from U+FF66–U+FF9D to U+FF66–U+FF9F. U+FF9E (`ﾞ`) and U+FF9F (`ﾟ`) must receive the same intrinsic class as halfwidth katakana. Thus `ｶﾞ`, `ﾊﾟ`, and `ｶﾞﾊﾟ` each form one run, with no stop between a base character and its mark. Isolated marks also receive this class. Explicit separator configuration retains its documented precedence.
- Han characters belong to `Other`, as in the reference. Characters outside the explicit ranges also belong to `Other`; adjacent characters in this class form one run.
- Compare character classes, not individual character values. Do not introduce camelCase splitting or dictionary-based Japanese segmentation.
- Walk Unicode code points while returning UTF-16 offsets required by VS Code. Valid surrogate pairs must never be split. If the input offset is inside a pair, classify the containing code point and find the outer boundary of its character-class run in the requested direction.
- Preserve source text exactly; do not normalize it.
- Scope limit: this version does not guarantee extended grapheme-cluster boundaries. General combining marks and emoji sequences follow the reference classes/code-point rules. Halfwidth voiced and semi-voiced marks follow the explicit range extension above; that requirement does not require general grapheme segmentation.

### Algorithm and performance

- Export `type Direction = 'left' | 'right'` and `findWordBoundary(text: string, offset: number, direction: Direction, wordSeparators: string): number` from `src/wordBoundary.ts`.
- Preconditions: `text` contains one logical line; `offset` is an integer in `[0, text.length]`. Production callers obtain these values from VS Code.
- Right movement examines the code point at the cursor; left movement examines the code point immediately before the cursor. Traverse that character-class run and return its outer boundary.
- At the relevant line edge, the pure function returns the same offset; the extension handles crossing to another line.
- Read line text once per distinct selected line during a command. A command-local map may share that text across cursors.
- Do not allocate a `Position` or `Range`, fetch document text, or read settings inside the character loop. Construct only final selections at the editor boundary.
- Do not tokenize the whole document, build a complete line-boundary array for each move, or persist a document cache in the initial implementation.
- The search must be linear in the code points traversed for a fixed separator-string length. Record separator lookup cost separately if unusually large configured strings affect measurements.

## Global Constraints

- Preserve the current minimum VS Code version `^1.140.0` and existing toolchain/dependencies.
- Add no runtime dependency, selection-extension command, deletion command, or default keybinding.
- Preserve unrelated working-tree changes and the reference directory.
- Shell commands must use `rtk`; PowerShell invocations must include `-NoProfile`.
- AI-facing documents must use precise English. Human-facing README and setting descriptions should use clear Japanese.
- If reference classification code is adapted, retain its full zlib notice in `THIRD_PARTY_NOTICES.md`, identify the adapted source, and mark the adapted implementation with a short attribution comment. The notice must be included in distributions.
- Product implementation must start only after the user accepts this plan, including the proposed behavior and Unicode scope.

## Files and responsibilities

| File | Action and responsibility |
| --- | --- |
| `src/wordBoundary.ts` | Create the pure classifier and directional boundary search. |
| `src/extension.ts` | Replace Hello World with configuration resolution and editor movement. |
| `src/test/wordBoundary.test.ts` | Create table-driven boundary tests and a repeatable performance measurement. |
| `src/test/extension.test.ts` | Replace the sample test with command/configuration integration tests. |
| `.vscode-test.mjs` | Supply a fresh test workspace for isolated configuration tests. |
| `package.json` | Replace the sample command; declare both movement commands and the nullable setting. |
| `README.md`, `CHANGELOG.md` | Describe movement, configuration, optional user keybindings, and the initial feature. |
| `THIRD_PARTY_NOTICES.md` | Preserve the reference notice when adapting its classifier. |
| `.vscodeignore` | Exclude reference sources, planning documents, agent/index files, and compiled tests from distribution. |

Existing `tsconfig.json` and npm scripts should remain sufficient. Change these files only if an observed toolchain issue requires a focused adjustment.

## Review Focus

1. Empty-string settings must override inheritance; changing a language-scoped fallback must affect the next invocation. Covered by Task 2.
2. Forward and reversed nonempty selections and multiple cursors must use each active endpoint without changing text. Covered by Task 2.
3. Consecutive punctuation, whitespace, and empty lines must always make directional progress until the document edge. Covered by Tasks 1 and 2.
4. Halfwidth voiced and semi-voiced katakana must remain one run; astral characters must not produce a split surrogate pair. General combining characters must match the documented scope. Covered by Task 1.
5. Long runs and many short runs must avoid repeated whole-line tokenization and excessive allocation. Covered by Task 3.

## Task 1: Implement and verify line-boundary search

**Files:** Create `src/wordBoundary.ts`, `src/test/wordBoundary.test.ts`, and `THIRD_PARTY_NOTICES.md` if adapting reference code.

**Interfaces:** Produces `Direction` and `findWordBoundary` with the signatures specified above. This module must not import `vscode`.

- [x] Write failing table-driven tests that encode expected stopping positions with `|`. Remove markers to obtain the input and derive UTF-16 offsets from marker positions. For every valid input offset, assert that left/right movement returns the nearest strictly earlier/later expected stop, or the same offset at the corresponding line edge.
- [x] Include the exact specification fixture `|リンゴ|を|食|べる|。|  |"|abc|/|def|"|  |+++;;;---|`, with the explicit test separator string `"\"/+;-"`. This makes the fixture independent of the developer's VS Code settings.
- [x] Include these exact cases: empty input; `|abc|` from every offset; `|  \t　|`; `|abc|_|def|` with `"_"`; `|abc_def|` with `""`; `|+++|;;;|---|` with `";"`; `|漢字々|ひらがな|カタカナー|・|ＡＢ１２＿|` with `""`; `|a|😀|b|` with `""`.
- [x] Assert `|ｶﾞ|`, `|ﾊﾟ|`, `|ｶﾞﾊﾟ|`, `|a|ｶﾞ|b|`, and `|ﾞﾟ|` under empty separators. For both `ｶﾞ` and `ﾊﾟ`, offset `1` must move left to `0` and right to `2`. For `aｶﾞb`, offset `2` must move left to `1` and right to `3`. Apply the table-driven checks in both directions from every offset.
- [x] Pin the remaining Unicode scope with `|が|` and `|e|́|` under empty separators. For `a😀b`, offset `2` must move left to `1` and right to `3`. For lone surrogate code units, assert termination and an in-range result.
- [x] Run `rtk npm test` and confirm failure is caused by the missing boundary implementation, not runner setup.
- [x] Implement the pure directional search, applying the halfwidth katakana range extension, preserving the remaining reference classification, and ensuring surrogate-pair safety. Add the reference notice and attribution when applicable.
- [x] Run `rtk npm test`; all boundary assertions must pass, and compilation/lint must pass through the existing pretest script.

## Task 2: Connect commands, configuration, and editor selections

**Files:** Modify `src/extension.ts`, `package.json`, `src/test/extension.test.ts`, and `.vscode-test.mjs`.

**Interfaces:** Consumes Task 1's `findWordBoundary`. Produces the two command IDs and setting key specified above. Keep editor helpers private: `resolveWordSeparators(document: vscode.TextDocument): string` and `moveCursors(direction: Direction): void`.

- [x] In `.vscode-test.mjs`, use Node's `mkdirSync`/`mkdtempSync` to create a fresh workspace directory below `.vscode-test/` and pass it as `workspaceFolder`. Retain the runner's isolated profile and use `--disable-extensions` to exclude unrelated installed extensions. Keep the existing test glob. Configuration tests must operate on files within that workspace.
- [x] Write failing integration tests using scratch documents and `vscode.commands.executeCommand`. Replace the sample notification and sample assertion.
- [x] Assert command registration and absence of contributed default keybindings. Assert both commands are harmless without an active editor.
- [x] Assert full left/right traversal of the specification fixture and empty surrounding lines; test LF and CRLF documents. Assert document-edge no-ops, unchanged text/version/dirty state, and empty resulting selections.
- [x] Assert multiple cursors and both selection orientations move from their active endpoints. For `abc def`, a selection with anchor `0` and active `2` must move right to `3`; the reversed selection must move right from active `0` to `3`.
- [x] Test inherited `"_"`, explicit `""`, explicit `"_"` overriding an empty fallback, explicit `null`, and configuration changes between two invocations. For `abc_def` from offset `0`, right movement must return `3` with `"_"` and `7` with `""`.
- [x] Add a language-specific setting test with two different language IDs. Verify that configuration resolution uses the target document and that an explicit independent value is not overridden by the built-in setting.
- [x] Write test settings at `ConfigurationTarget.Workspace`. Every settings mutation must be awaited and restored in `finally`, including language-specific overrides. Close scratch editors after each test. Do not mutate the user's persistent global settings.
- [x] Run `rtk npm test` and confirm the new tests fail for missing commands or behavior.
- [x] Declare commands and configuration in `package.json`; remove Hello World. Implement private configuration and movement helpers, register/dispose both commands, and follow the editor behavior specified above.
- [x] Run `rtk npm test`; confirm compilation, lint, and the complete extension test suite pass with a nonzero executed test count.

## Task 3: Measure responsiveness and finish user documentation

**Files:** Extend `src/test/wordBoundary.test.ts`; update `README.md`, `CHANGELOG.md`, and `.vscodeignore`.

**Interfaces:** Uses Task 1's pure function and Task 2's registered commands. Adds no public API.

- [x] Add correctness checks for a 100,000-character ASCII run and an alternating `aあ` line of the same length. Assert correct endpoints, progress, and bounded results in both directions.
- [x] Add an opt-in timing case controlled by `WORD_START_END_BENCHMARK=1`. After warmup, measure repeated endpoint searches on the long run and full boundary traversals on the alternating line. Record fixture sizes, operations, elapsed time, runtime version, and environment. Do not add a machine-dependent timing assertion to the normal suite.
- [x] Run normal tests, then run the opt-in measurement with `rtk pwsh.exe -NoProfile -Command '$env:WORD_START_END_BENCHMARK="1"; rtk npm test'`. Investigate repeated full-line scans or large regressions before declaring responsiveness verified. No fixed latency target was supplied, so report measurements rather than inventing a requirement.
- [ ] In an Extension Development Host with an isolated profile, assign temporary keys and hold each direction across mixed Japanese text, whitespace, and long lines. Verify visible progress, selection behavior, scrolling, and immediate configuration changes. Report this separately from pure-function timings.
- [x] Replace README scaffold text with Japanese usage instructions, command IDs, optional `keybindings.json` examples, configuration inheritance, the meaning of `""`, separator-run grouping, halfwidth voiced/semi-voiced katakana grouping, and the remaining Unicode scope. Include the reference attribution. Record the initial feature in `CHANGELOG.md`.
- [x] Update packaging exclusions for `reference/**`, `docs/**`, `.codegraph/**`, `.claude/**`, `.codex/**`, `.gemini/**`, `.mcp.json`, `AGENTS.md`, `GEMINI.md`, `*.code-workspace`, and `out/test/**`. Retain runtime output and the third-party notice.
- [x] Run `rtk npm test` after the final changes and inspect `rtk git diff --check`. Inspect newly created files separately because ordinary git diff does not include untracked files. If a packaging tool is already available, inspect its file list; otherwise report package contents as unverified and do not install a new dependency solely for this check.

## Completion and execution handoff

- Deliver code, tests, README, change log, and any required third-party notice together.
- Report executed test counts, performance measurements, manual checks, and remaining limitations precisely.
- Do not publish, create a release, modify the user's keybindings, or stage unrelated files.
- Commit boundaries, if requested, should follow the three completed tasks. Planning alone must not create commits.
- Execution: the primary agent implemented the three dependent tasks. Support agents ran bounded checks and collected review evidence as required by the repository instructions. Changes remain uncommitted on `feat/word-boundary-navigation`.

## API references

- [VS Code configuration contributions and setting scopes](https://code.visualstudio.com/api/references/contribution-points#contributes.configuration)
- [VS Code command contributions](https://code.visualstudio.com/api/references/contribution-points#contributes.commands)
- Local API types: `node_modules/@types/vscode/index.d.ts`.
- Local reference implementation and license: `reference/japanese-word-handler/src/web/extension.ts` and `reference/japanese-word-handler/LICENSE`.
