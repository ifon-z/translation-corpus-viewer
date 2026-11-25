# Full edition comparison and interface reference

English · [Simplified Chinese](full-tool.zh-CN.md)

The **public edition** runs as a static page over a user-selected JSONL or CSV file. The **full edition** adds a Python CLI and a local web server over a corpus store. [TypeScript declarations](../contracts/full-tool.d.ts) retain the full edition's local HTTP interface and CLI submission modes. They are compile-time definitions only. Opening the public app starts no server and performs no platform requests.

## Feature comparison

| Capability | Public edition | Full edition |
| --- | --- | --- |
| Inspect translations | Switch between open projects, then search and filter entries in the current project and target language | List stored modules and browse entries by module and locale pair |
| Edit and validate | Edit in the browser, flag empty translations and token or markup differences | Keep edits separately from the captured corpus and compare them with the saved translation |
| Store and export | Download the current project as JSONL or CSV | Save JSONL and CSV per module and locale pair, with snapshots and change records |
| Verify captured data | Validate import structure and translation text | Compare captured pages, exported files, and stored metadata |
| Catalog and crawler | Request and response declarations | Search or refresh the catalog, crawl selected modules, and report task progress |
| Submission | Preview and CLI mode declarations | Preview local edits, with a separate CLI mode for live submission |

The public format retains `id`, `context`, and `source`, with an optional source locale and one or more targets. The [file format reference](../README.md#file-format) covers both the legacy and named-target formats. If you need entry IDs from an authorized full-edition file, map `trk_id` to `id` before importing it. Full-edition history and submission metadata stay in the full edition's store.

## Full edition CLI

These are reference names from the full edition. The public app runs from `index.html`.

| Command | Role and key options |
| --- | --- |
| `catalog` | Read or refresh the module catalog, with `--search` and `--refresh` |
| `crawl` | Fetch selected `--modules` for `--source` and `--dest`. `--dry-run` compares results without updating the corpus. |
| `modules` | List the stored modules and locale pairs |
| `show` | Inspect one `--module`, optionally filtered with `--find` |
| `verify` | Report discrepancies in the stored corpus and captured data |
| `edit` | Record or clear a local change for a `--module` and `--trk-id` |
| `submit` | Preview by default. The live mode is CLI-only and requires both `--live` and `--yes`. |

## Full edition local HTTP

The table describes the full edition's local server. `FullToolHttp` captures these shapes in the public repository. The provider-specific payload inside a submission preview is represented as an opaque object.

| Route | Input | Successful response |
| --- | --- | --- |
| `GET /api/modules` | None | Stored module and locale pairs with counts |
| `GET /api/entries` | Query with `module`, `source`, and `dest` | Entries with local edits and validation results |
| `GET /api/catalog` | None | Cached catalog |
| `GET /api/history` | Query with `module`, `source`, and `dest` | Snapshots and changes |
| `POST /api/task` | Catalog task with `kind: "catalog"`, or crawl task with `kind: "crawl"` and `modules` | Task snapshot with an ID |
| `GET /api/task` | Query with task `id` | Task status, output lines, and exit code |
| `POST /api/edit` | Locale pair, `trk_id`, `text`, and optional `note` | Saved local edit |
| `POST /api/clear` | Locale pair and `trk_id` | Whether a local edit was cleared |
| `POST /api/submit-preview` | Locale pair | Ready and blocked entries, with warnings |

Live submission is a full-edition CLI operation. See the [responsible-use section](../README.md#responsible-use-and-liability) before implementing or using a separate integration.
