import type { FullToolHttp, SubmitCliOptions } from "../contracts/full-tool"

type Accept<Expected, Actual extends Expected> = Actual
type ExactKeys<Shape, Keys extends keyof Shape> =
  Exclude<keyof Shape, Keys> extends never ? true : false
type Assert<T extends true> = T

export type RouteNames = Assert<ExactKeys<FullToolHttp,
  | "GET /api/modules"
  | "GET /api/entries"
  | "GET /api/catalog"
  | "GET /api/history"
  | "GET /api/task"
  | "POST /api/task"
  | "POST /api/edit"
  | "POST /api/clear"
  | "POST /api/submit-preview"
>>

export type CatalogTask = Accept<FullToolHttp["POST /api/task"]["body"], {
  kind: "catalog"
}>
export type CrawlTask = Accept<FullToolHttp["POST /api/task"]["body"], {
  kind: "crawl"
  modules: [101, "102"]
  dest: "fr_FR"
  names: false
}>
// @ts-expect-error The crawl task requires modules.
export type MissingModules = Accept<FullToolHttp["POST /api/task"]["body"], { kind: "crawl" }>

export type TaskPoll = Assert<ExactKeys<FullToolHttp["GET /api/task"]["query"], "id">>
export type PreviewRequest = Assert<ExactKeys<
  FullToolHttp["POST /api/submit-preview"]["body"], "module" | "source" | "dest"
>>
export type PreviewMode = Accept<SubmitCliOptions, { module: "101" }>
export type LiveMode = Accept<SubmitCliOptions, { module: "101"; live: true; yes: true }>
// @ts-expect-error Live CLI submission requires explicit confirmation.
export type UnconfirmedLiveMode = Accept<SubmitCliOptions, { module: "101"; live: true }>
