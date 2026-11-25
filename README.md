# Translation Corpus Viewer

English · [Simplified Chinese](README.zh-CN.md)

Browse, search, edit, and validate a local corpus with one source language and one or more target languages. The public edition runs entirely in your browser and includes [interface declarations](contracts/full-tool.d.ts) for the full edition's catalog, crawler tasks, corpus API, and submission workflow.

## Quick start

1. Save [index.html](index.html) from its raw view or download it in the repository ZIP. Double-click the file to open it in your browser. Use the language switch at the top to choose English or Simplified Chinese.
2. Choose **Import files** to open one or more local JSONL or CSV files. Each file becomes a project. Use **Project** above the entry list to switch between imports and the built-in examples.
3. Click the displayed **Source language** to change it. Select a **Target language** tab to search, filter, validate, or edit that translation. The arrow keys move between tabs. Use **Add target language** to add another. In a legacy file, **Name target language** labels the existing translations first.
4. Select an entry in the left list and edit its translation next to the source. Use **Save translation** to apply the edit in the current page. **Previous** and **Next** move through the filtered list.
5. Choose **Export** to save the current project as JSONL or CSV, including every target language and any pending drafts. Reopen the exported file to continue editing later.

The HTML file contains the React viewer, styles, and fictional examples. Move it anywhere and open it offline. Each project keeps its own edits, selected language, and filters while the page stays open. Export each project you want to keep before closing or refreshing the page.

### Example 1 — A BGA-style board game

Under **Project**, choose **BGA-style board game** or import the [board-game JSONL](examples/bga-style-demo.jsonl). It contains six invented English–Chinese entries. Select **Validation alerts** to find a blank translation, a missing placeholder, and missing markup. Edit `orchard-demo-03` so the translation keeps `{bellTime}`, then export JSONL to save the draft.

### Example 2 — Localizing a writing app

Under **Project**, choose **Application UI copy** or import the [application UI CSV](examples/app-ui-demo.csv). Review navigation labels, status messages, and a multiline export instruction in a fictional writing app. Use **Untranslated** to find `ui-demo-04` and fill in its translation. Export CSV to hand the copy back to a teammate.

### Example 3 — A multilingual field guide

Under **Project**, choose **Multilingual field guide** or import its [fictional JSONL](examples/multilingual-demo.jsonl). The Spanish source has English, Simplified Chinese, and Arabic targets. Switch to Arabic and select **Untranslated** to find `guide-demo-02`. Switch back to English to see that the same entry already has a translation. Export either format to keep all three targets.

## Public and full editions

The public app provides the local file workflow. The full edition adds a module catalog, crawl tasks, disk-backed corpora and snapshots, and a submission workflow. The public repository preserves those integration points as type declarations and reference documentation. Open the [edition comparison and interface reference](docs/full-tool.md) for the command names, local routes, and coverage by feature.

## File format

Use UTF-8. JSONL contains one object per line and CSV starts with a header row. Each entry requires `source` and may include `id` and `context`. A corpus can supply one `source_locale` across its entries, for example `es`. Entries without it inherit the source locale when one is supplied elsewhere in the file.

| Format | Existing single target | Named targets |
| --- | --- | --- |
| JSONL | The `target` text field | A `translations` object keyed by language tag, for example `{"zh-CN":"...", "fr-FR":"..."}` |
| CSV | The `target` column | One column per language, for example `target:zh-CN,target:fr-FR` |

Use a language tag recognized by your browser, such as `en`, `zh-CN`, or `fr-FR`. Blank cells or missing translations are editable and shown as untranslated. Keep named and unnamed target text in separate files. The viewer preserves the single-target format until that target is named.

CSV exports prefix formula-like values with a single quote for spreadsheet use. Use JSONL when the original text must be preserved exactly.

## Responsible use and liability

This is an independent offline editor with no affiliation, endorsement, or authorization from Board Game Arena or other translation platforms. All bundled game text, translations, and identifiers are fictional. The BGA-style example uses no BGA data and makes no connection to BGA. Use and share only data you have permission to handle, and follow applicable law, platform terms, and the rights holder's license.

Integration declarations grant no access to platform accounts, services, or data. Obtain explicit authorization from the platform before any automated access, collection, or submission. [BGA terms of use](https://fr.boardgamearena.com/legal?section=tos)

The software is provided as is. The warranty disclaimer and limitation of liability in Apache-2.0 sections 7 and 8 apply to the extent permitted by applicable law. Users are responsible for deciding whether the software and their data are suitable for their purposes. [Apache-2.0 license](LICENSE)

## Development

Use Node.js 24 and pnpm 11 to install development dependencies and build the standalone file.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm check:build
pnpm test
pnpm test:browser
```

The browser test uses an installed Edge browser by default. Set `BROWSER_PATH` to use another installed Chromium browser. With TypeScript installed, run `tsc --strict --noEmit tests/full-tool-contract.types.ts` to check the declaration contract.
