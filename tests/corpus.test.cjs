const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")
const { join } = require("node:path")
const test = require("node:test")
const { parse, serialize, issues, open, addTarget, toRows, localeTag } = require("../corpus.js")

test("reads JSONL with an optional BOM and defaults missing translations", () => {
  const rows = parse('\ufeff{"source":"Light the beacon.","id":7}\n\n', "list.jsonl")
  assert.deepEqual(rows, [
    { id: "7", context: "", source: "Light the beacon.", target: "" },
  ])
})

test("reports invalid JSONL and invalid source fields with their line", () => {
  assert.throws(() => parse('{"source":"Compass"}\n{', "list.jsonl"), { code: "invalidJson", details: { position: 2, format: "jsonl" } })
  assert.throws(() => parse('{"source":3}', "list.jsonl"), { code: "invalidSource" })
})

test("reads CSV with quoted commas, double quotes and embedded newlines", () => {
  const rows = parse('source,target,context\r\n"A ""blue"" gate,\nleft","蓝门",map\r\n', "list.csv")
  assert.deepEqual(rows, [
    { id: "", context: "map", source: 'A "blue" gate,\nleft', target: "蓝门" },
  ])
})

test("reads an empty CSV field at end of file", () => {
  assert.equal(parse("source,target\nLight the beacon.,", "list.csv")[0].target, "")
})

test("rejects broken CSV quoting, duplicate headers and uneven rows", () => {
  assert.throws(() => parse('source,target\n"Compass,翻译', "list.csv"), { code: "invalidCsv" })
  assert.throws(() => parse("source,source\nCompass,Map", "list.csv"), { code: "invalidHeader" })
  assert.throws(() => parse("source,target\nCompass", "list.csv"), { code: "invalidColumnCount" })
})

test("rejects a quoted record with a missing source", () => {
  assert.throws(() => parse('source\n""\nMap', "list.csv"), { code: "invalidSource" })
})

test("finds blank translations and changed or duplicated placeholders", () => {
  assert.deepEqual(issues({ source: "[blue]Map[/blue]", target: " " }), ["missingTranslation"])
  assert.deepEqual(issues({ source: "Move ${step} to {port}", target: "移到 {port}" }), [
    "placeholderMismatch",
  ])
  assert.deepEqual(issues({ source: "%s", target: "%s %s" }), ["placeholderMismatch"])
  assert.deepEqual(issues({ source: "[blue]Map[/blue]", target: "[blue]地图" }), ["markupMismatch"])
  assert.deepEqual(issues({ source: "{left} ${right} %s", target: "%s ${right} {left}" }), [])
})

test("detects changes to percent-delimited names and unnumbered printf order", () => {
  assert.deepEqual(issues({ source: "%score%", target: "%speed%" }), ["placeholderMismatch"])
  assert.deepEqual(issues({ source: "Move %s %d times", target: "移动 %d 次 %s" }), [
    "placeholderMismatch",
  ])
  assert.deepEqual(issues({ source: "Move %1$s %2$d times", target: "移动 %2$d 次 %1$s" }), [])
})

test("detects reordered markup with matching tag names and counts", () => {
  assert.deepEqual(issues({ source: "[blue]Map[/blue]", target: "[/blue]地图[blue]" }), [
    "markupMismatch",
  ])
})

test("preserves edited Unicode and line breaks in JSONL and CSV", () => {
  const text = '{"context":"Map","source":"A \\"blue\\" gate","target":"旧稿"}'
  const rows = parse(text, "list.jsonl")
  rows[0].target = "蓝门\n下一行"
  assert.deepEqual(parse(serialize(rows, "jsonl"), "export.jsonl"), rows)
  assert.deepEqual(parse(serialize(rows, "csv"), "export.csv"), rows)
})

test("neutralizes formula-like values only in CSV exports", () => {
  const rows = [{ id: "1", context: "", source: "A beacon", target: "=1+1" }]
  assert.equal(parse(serialize(rows, "csv"), "export.csv")[0].target, "'=1+1")
  assert.equal(parse(serialize(rows, "jsonl"), "export.jsonl")[0].target, "=1+1")
})

test("imports both bundled fictional examples", () => {
  for (const name of ["fictional.jsonl", "fictional.csv"]) {
    const path = join(__dirname, "..", "examples", name)
    const rows = parse(readFileSync(path, "utf8"), name)
    assert.equal(rows.length, 3)
    assert.equal(rows[0].id, "demo-01")
  }
})

test("the fictional BGA-style example exercises three translation checks", () => {
  const name = "bga-style-demo.jsonl"
  const rows = parse(readFileSync(join(__dirname, "..", "examples", name), "utf8"), name)
  assert.equal(rows.length, 6)
  assert.deepEqual(rows.filter((row) => issues(row).length).map((row) => [row.id, issues(row)]), [
    ["orchard-demo-02", ["missingTranslation"]],
    ["orchard-demo-03", ["placeholderMismatch"]],
    ["orchard-demo-04", ["markupMismatch"]],
  ])
})

test("the fictional app example handles a quoted multiline UI string", () => {
  const name = "app-ui-demo.csv"
  const rows = parse(readFileSync(join(__dirname, "..", "examples", name), "utf8"), name)
  assert.equal(rows.length, 5)
  assert.equal(rows.find((row) => row.id === "ui-demo-03").source,
    'Choose "Export", then select a format.\nKeep the original for your records.')
  assert.deepEqual(rows.filter((row) => issues(row).length).map((row) => row.id), ["ui-demo-04"])
})

test("the click-to-load examples match the separately downloadable files", () => {
  const examples = require("../examples/bundled.js")
  for (const name of ["bga-style-demo.jsonl", "app-ui-demo.csv", "multilingual-demo.jsonl"]) {
    const asset = readFileSync(join(__dirname, "..", "examples", name), "utf8")
    assert.equal(examples[name], asset.replace(/\r\n/g, "\n"))
  }
})

test("round-trips one source and multiple target locales through JSONL and wide CSV", () => {
  const text = '{"id":"one","source_locale":"EN_us","source":"Open the draft.","translations":{"zh_cn":"打开草稿。","fr-FR":"Ouvrir le brouillon."}}\n' +
    '{"id":"two","source":"Save draft.","translations":{"fr-FR":"Enregistrer."}}\n'
  const workspace = open(parse(text, "multi.jsonl"))
  assert.equal(workspace.sourceLocale, "en-US")
  assert.deepEqual(workspace.targetLocales, ["zh-CN", "fr-FR"])
  const rows = toRows(workspace)
  assert.equal(rows[1].translations["zh-CN"], "")
  assert.match(serialize(rows, "csv"), /source_locale,target:zh-CN,target:fr-FR/)
  for (const format of ["jsonl", "csv"]) {
    const restored = parse(serialize(rows, format), "roundtrip." + format)
    assert.deepEqual(restored, rows)
  }
})

test("keeps legacy files compatible and retains existing text when naming their first target", () => {
  const rows = parse('{"source":"Brouillon","target":"Draft"}', "legacy.jsonl")
  const workspace = open(rows)
  assert.deepEqual(toRows(workspace), rows)
  workspace.sourceLocale = localeTag("fr")
  assert.equal(addTarget(workspace, "en"), "en")
  assert.equal(addTarget(workspace, "de-DE"), "de-DE")
  assert.equal(addTarget(workspace, "EN"), "en")
  const entry = workspace.entries[0]
  entry.translations.set("de-DE", "Entwurf")
  assert.equal(entry.originalTranslations.get("en"), "Draft")
  assert.deepEqual(toRows(workspace), [
    { id: "", context: "", source: "Brouillon", source_locale: "fr",
      translations: { en: "Draft", "de-DE": "Entwurf" } },
  ])
})

test("rejects inconsistent source locales, ambiguous targets and duplicate normalized tags", () => {
  const mixedSources = '{"source":"Draft","source_locale":"en"}\n{"source":"Texte","source_locale":"fr"}'
  assert.throws(() => open(parse(mixedSources, "input.jsonl")), { code: "mixedSources" })
  const mixedTargets = '{"source":"Draft","target":"草稿"}\n{"source":"Save","translations":{"fr":"Sauver"}}'
  assert.throws(() => open(parse(mixedTargets, "input.jsonl")), { code: "mixedTargets" })
  assert.throws(() => parse("source,target,target:fr\nDraft,草稿,Brouillon", "input.csv"),
    { code: "mixedTargets" })
  assert.throws(() => parse("source,target:zh-cn,target:zh_CN\nDraft,草稿,草稿", "input.csv"),
    { code: "duplicateTarget" })
  assert.throws(() => localeTag("some locale"), { code: "invalidLanguage" })
})

test("the fictional field guide pairs Spanish with three independent translations", () => {
  const name = "multilingual-demo.jsonl"
  const rows = parse(readFileSync(join(__dirname, "..", "examples", name), "utf8"), name)
  const workspace = open(rows)
  assert.equal(workspace.sourceLocale, "es")
  assert.deepEqual(workspace.targetLocales, ["en", "zh-CN", "ar"])
  assert.equal(workspace.entries[1].translations.get("ar"), "")
  assert.deepEqual(toRows(workspace), rows)
})

test("both interface languages cover the same messages and HTML bindings", () => {
  const { en, "zh-CN": zh } = require("../i18n.js")
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort())
  const html = readFileSync(join(__dirname, "..", "index.html"), "utf8")
  for (const [, key] of html.matchAll(/\bdata-(?:t|label|placeholder)="([^"]+)"/g)) {
    assert.ok(en[key] && zh[key], key)
  }
  for (const key of Object.keys(en)) {
    const tokens = (text) => Array.from(text.matchAll(/\{\w+\}/g), (match) => match[0]).sort()
    assert.deepEqual(tokens(en[key]), tokens(zh[key]), key)
  }
})
