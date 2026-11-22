const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")
const { join } = require("node:path")
const test = require("node:test")
const { parse, serialize, issues } = require("../corpus.js")

test("reads JSONL with an optional BOM and defaults missing translations", () => {
  const rows = parse('\ufeff{"source":"Light the beacon.","id":7}\n\n', "list.jsonl")
  assert.deepEqual(rows, [
    { id: "7", context: "", source: "Light the beacon.", target: "" },
  ])
})

test("reports invalid JSONL and invalid source fields with their line", () => {
  assert.throws(() => parse('{"source":"Compass"}\n{', "list.jsonl"), /2/)
  assert.throws(() => parse('{"source":3}', "list.jsonl"), /source/)
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
  assert.throws(() => parse('source,target\n"Compass,翻译', "list.csv"), /CSV/)
  assert.throws(() => parse("source,source\nCompass,Map", "list.csv"), /列名/)
  assert.throws(() => parse("source,target\nCompass", "list.csv"), /列数/)
})

test("rejects a quoted record with a missing source", () => {
  assert.throws(() => parse('source\n""\nMap', "list.csv"), /source/)
})

test("finds blank translations and changed or duplicated placeholders", () => {
  assert.deepEqual(issues({ source: "[blue]Map[/blue]", target: " " }), ["译文为空"])
  assert.deepEqual(issues({ source: "Move ${step} to {port}", target: "移到 {port}" }), [
    "占位符不一致",
  ])
  assert.deepEqual(issues({ source: "%s", target: "%s %s" }), ["占位符不一致"])
  assert.deepEqual(issues({ source: "[blue]Map[/blue]", target: "[blue]地图" }), ["标记不一致"])
  assert.deepEqual(issues({ source: "{left} ${right} %s", target: "%s ${right} {left}" }), [])
})

test("detects changes to percent-delimited names and unnumbered printf order", () => {
  assert.deepEqual(issues({ source: "%score%", target: "%speed%" }), ["占位符不一致"])
  assert.deepEqual(issues({ source: "Move %s %d times", target: "移动 %d 次 %s" }), [
    "占位符不一致",
  ])
  assert.deepEqual(issues({ source: "Move %1$s %2$d times", target: "移动 %2$d 次 %1$s" }), [])
})

test("detects reordered markup with matching tag names and counts", () => {
  assert.deepEqual(issues({ source: "[blue]Map[/blue]", target: "[/blue]地图[blue]" }), [
    "标记不一致",
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
    ["orchard-demo-02", ["译文为空"]],
    ["orchard-demo-03", ["占位符不一致"]],
    ["orchard-demo-04", ["标记不一致"]],
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
  for (const name of ["bga-style-demo.jsonl", "app-ui-demo.csv"]) {
    const asset = readFileSync(join(__dirname, "..", "examples", name), "utf8")
    assert.equal(examples[name], asset.replace(/\r\n/g, "\n"))
  }
})
