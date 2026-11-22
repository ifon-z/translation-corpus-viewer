# Translation Corpus Viewer

English · [简体中文](README.zh-CN.md)

Browse, search, edit, and validate bilingual entries in local JSONL and CSV files. The public edition runs entirely in your browser. It also includes [interface declarations](contracts/full-tool.d.ts) for the full edition's catalog, crawler tasks, corpus API, and submission workflow.

## Quick start

1. Download and unzip this repository, then open `index.html` in your browser.
2. Import the fictional [JSONL](examples/fictional.jsonl) or [CSV](examples/fictional.csv) example, or select a local file.
3. Search or filter entries, edit translations, and review alerts about empty translations, placeholders, and markup.
4. Export the full corpus as JSONL or CSV. Reopen the exported file to continue editing later.

The browser needs no installation, login, or local server. Edits stay in the current page until you save an export. Search and filters affect the display only.

## Public and full editions

The public app provides the local file workflow. The full edition adds a module catalog, crawl tasks, disk-backed corpora and snapshots, and a submission workflow. The public repository preserves those integration points as type declarations and reference documentation. Open the [edition comparison and interface reference](docs/full-tool.md) for the command names, local routes, and coverage by feature.

## File format

Use UTF-8. JSONL contains one object per line and CSV starts with a header row. Each record requires `source` and may include `id`, `context`, and `target`. These four fields are the public app's import and export format.

CSV exports prefix formula-like values with a single quote for spreadsheet use. Use JSONL when the original text must be preserved exactly.

## Responsible use and liability

This is an independent offline editor. Board Game Arena and other translation platforms do not sponsor, endorse, or authorize it. The examples are fictional. Use and share only data you have permission to handle, and follow applicable law, platform terms, and the rights holder's license.

Integration declarations grant no access to platform accounts, services, or data. Obtain explicit authorization from the platform before any automated access, collection, or submission. [BGA terms of use](https://fr.boardgamearena.com/legal?section=tos)

The software is provided as is. The warranty disclaimer and limitation of liability in Apache-2.0 sections 7 and 8 apply to the extent permitted by applicable law. Users are responsible for deciding whether the software and their data are suitable for their purposes. [Responsible-use notice](NOTICE.md) · [Apache-2.0 license](LICENSE)

## Tests

Run `node --test` with Node.js 20 or later. With TypeScript installed, run `tsc --strict --noEmit tests/full-tool-contract.types.ts` to check the declaration contract. Neither tool is required to open the viewer.
