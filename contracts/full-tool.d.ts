type Id = string | number
type JsonObject = Record<string, unknown>

export interface LocalePair {
  module: string
  source: string
  dest: string
}

interface StoredPair {
  module_id: string
  source_locale: string
  dest_locale: string
  name: string | null
  display_name: string | null
  last_checked_at: string | null
}

interface ModuleSummary extends StoredPair {
  entries: number
  untranslated: number
  edited: number
  problems: number
  stale: number
  last_changed_at: string | null
  snapshots: number
}

interface EffectiveEntry {
  trk_id: Id
  context: string | null
  source: string
  target: string | null
  server_target: string | null
  edited: boolean
  stale: boolean
  problems: string[]
  warnings: string[]
  edited_at?: string
  edit_note?: string
}

interface CorpusResponse extends StoredPair {
  server_total: number | null
  count_mismatch: boolean | null
  entries: EffectiveEntry[]
}

interface CatalogResponse {
  updated_at: string | null
  source: string | null
  count: number
  modules: Array<{
    id: number
    name: string
    display_name: string
    status: string
    premium: boolean
    translated: number
    has_tutorial: boolean
    players: number[]
    aliases: string[]
  }>
}

interface HistoryResponse {
  snapshots: JsonObject[]
  changes: Array<{
    file: string
    counts: Record<string, number>
    added: unknown[]
    removed: unknown[]
    modified: unknown[]
  }>
  first_fetched_at: string | null
  last_changed_at: string | null
}

export type CrawlerTaskRequest =
  | { kind: "catalog" }
  | { kind: "crawl"; modules: Id | readonly [Id, ...Id[]]; dest?: string; names?: boolean }

interface TaskSnapshot {
  id: string
  kind: CrawlerTaskRequest["kind"]
  label: string
  status: "running" | "done" | "failed"
  lines: string[]
  exit_code: number | null
  started_at: string
  finished_at: string | null
  error?: string
}

interface EditResult {
  trk_id: Id
  target: string
  base_target: string
  base_trh_id: Id | null
  note: string
  edited_at: string
  problems: string[]
  warnings: string[]
}

interface PreviewEntry {
  payload: JsonObject
  source: string
  previous_target: string | null
  warnings: string[]
}

interface SubmissionPreview {
  module_id: string
  source_locale: string
  dest_locale: string
  endpoint: string
  ready: PreviewEntry[]
  blocked: Array<PreviewEntry & { problems: string[] }>
}

/** Local HTTP shapes from the full edition. The public app does not expose these routes. */
export interface FullToolHttp {
  "GET /api/modules": { response: { modules: ModuleSummary[]; store: string } }
  "GET /api/entries": { query: LocalePair; response: CorpusResponse }
  "GET /api/catalog": { response: CatalogResponse }
  "GET /api/history": { query: LocalePair; response: HistoryResponse }
  "GET /api/task": { query: { id: string }; response: TaskSnapshot }
  "POST /api/task": { body: CrawlerTaskRequest; response: TaskSnapshot }
  "POST /api/edit": {
    body: LocalePair & { trk_id: Id; text: string; note?: string }
    response: { ok: true; result: EditResult }
  }
  "POST /api/clear": {
    body: LocalePair & { trk_id: Id }
    response: { ok: true; result: { trk_id: Id; cleared: boolean } }
  }
  "POST /api/submit-preview": { body: LocalePair; response: SubmissionPreview }
}

/** Normalized CLI option names for submission mode selection. */
export type SubmitCliOptions = {
  module: string
  source?: string
  dest?: string
  store?: string
  trkIds?: readonly [string, ...string[]]
  limit?: number
} & (
  | { live?: false; yes?: boolean }
  | { live: true; yes: true }
)
