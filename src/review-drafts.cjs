function draftKey(index, tag) {
  return index + ":" + tag
}

function updateDraft(drafts, draft, original) {
  const next = new Map(drafts)
  const key = draftKey(draft.index, draft.tag)
  if (draft.text === original.replace(/\r\n?/g, "\n")) next.delete(key)
  else next.set(key, draft)
  return next
}

function nameDrafts(drafts, tag) {
  const next = new Map()
  for (const draft of drafts.values()) {
    const named = draft.tag ? draft : { ...draft, tag }
    next.set(draftKey(named.index, named.tag), named)
  }
  return next
}

function saveDrafts(workspace, drafts) {
  const entries = [...workspace.entries]
  for (const { index, tag, text } of drafts) {
    const entry = entries[index]
    const translations = new Map(entry.translations).set(tag, text)
    entries[index] = { ...entry, translations }
  }
  return { ...workspace, entries }
}

module.exports = { draftKey, updateDraft, nameDrafts, saveDrafts }
