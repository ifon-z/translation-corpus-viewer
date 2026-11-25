const assert = require("node:assert/strict")
const test = require("node:test")
const Corpus = require("../corpus.js")

test("applies drafts separately by entry and language without mutating the saved corpus", () => {
  const { draftKey, updateDraft, saveDrafts } = require("../src/review-drafts.cjs")
  const corpus = Corpus.open(Corpus.parse(
    '{"source":"A","translations":{"fr":"","es":"Uno"}}\n{"source":"B","translations":{"fr":"Deux","es":""}}',
    "example.jsonl",
  ))
  let drafts = updateDraft(new Map(), { index: 0, tag: "fr", text: "Un" }, "")
  drafts = updateDraft(drafts, { index: 0, tag: "es", text: "Primero" }, "Uno")
  drafts = updateDraft(drafts, { index: 1, tag: "es", text: "Dos" }, "")
  assert.equal(drafts.get(draftKey(0, "fr")).text, "Un")
  assert.deepEqual(Corpus.toRows(saveDrafts(corpus, drafts.values())).map((row) => row.translations), [
    { fr: "Un", es: "Primero" }, { fr: "Deux", es: "Dos" },
  ])
  assert.equal(corpus.entries[0].translations.get("fr"), "")
  assert.equal(corpus.entries[0].originalTranslations.get("es"), "Uno")
})

test("clears reverted drafts and moves unnamed drafts when the target is labeled", () => {
  const { draftKey, updateDraft, nameDrafts } = require("../src/review-drafts.cjs")
  const draft = { index: 0, tag: "", text: "Première ligne\nDeuxième ligne" }
  const original = "Première ligne\r\nDeuxième ligne"
  const entered = updateDraft(new Map(), draft, "Old text")
  assert.equal(updateDraft(entered, draft, original).size, 0)
  const renamed = nameDrafts(entered, "fr")
  assert.equal(renamed.get(draftKey(0, "fr")).text, draft.text)
  assert.equal(renamed.has(draftKey(0, "")), false)
})
