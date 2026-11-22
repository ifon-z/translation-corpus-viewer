const $ = (id) => document.getElementById(id)
const fileInput = $("import")
const search = $("search")
const filter = $("filter")
const sourceLocale = $("source-locale")
const targetLocale = $("target-locale")
const editor = $("editor")
const target = $("edit-target")
const localeDialog = $("locale-dialog")
const localeInput = $("locale-tag")
const localeError = $("locale-error")
let language = "en"
let workspace
let activeTarget = ""
let message = { key: "waiting" }
let filename = "corpus"
let current
let pendingExport = false

function tr(key, values = {}) {
  return ViewerMessages[language][key].replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "")
}

function errorMessage(error) {
  const details = error.details ?? {}
  const key = Object.hasOwn(ViewerMessages[language], error.code) ? error.code : "inputError"
  const text = tr(key, details)
  return details.position
    ? tr(details.format + "Location", { position: details.position, error: text })
    : text
}

function updateMessage() {
  const { key, values, error } = message
  $("status").textContent = tr(key, error ? { ...values, error: errorMessage(error) } : values)
}

function notify(key, values, error) {
  message = { key, values, error }
  updateMessage()
}

function languageName(tag) {
  if (!tag) return tr("unnamed")
  const display = new Intl.DisplayNames([language], { type: "language" }).of(tag)
  return display === tag ? tag : display + " · " + tag
}

function targetAction() {
  return workspace?.targetLocales[0] === "" ? "nameTarget" : "addTarget"
}

function updateLanguageControls() {
  sourceLocale.value = workspace?.sourceLocale ?? ""
  const tags = workspace?.targetLocales ?? [""]
  targetLocale.replaceChildren(...tags.map((tag) =>
    new Option(workspace ? languageName(tag) : tr("noTarget"), tag),
  ))
  targetLocale.value = activeTarget
  $("new-locale").textContent = tr(targetAction())
}

function visible({ entry, text, issues, edited }, query) {
  if (![entry.id, entry.context, entry.source, text].some((value) => value.toLowerCase().includes(query))) {
    return false
  }
  switch (filter.value) {
    case "issues": return issues.length > 0
    case "untranslated": return !text.trim()
    case "edited": return edited
    default: return true
  }
}

function cell(content, className, heading, tag) {
  const td = document.createElement("td")
  td.setAttribute("role", "cell")
  td.textContent = content
  if (className) td.className = className
  if (heading) {
    td.dataset.heading = tr(heading)
    td.dir = "auto"
  }
  if (tag) td.lang = tag
  return td
}

function editEntry(entry, text) {
  const source = $("edit-source")
  source.textContent = entry.source
  source.lang = workspace.sourceLocale
  source.dir = "auto"
  target.value = text
  target.lang = activeTarget
  target.dir = "auto"
  current = { entry, tag: activeTarget, initialText: target.value }
  $("edit-title").textContent = activeTarget
    ? tr("editIn", { language: languageName(activeTarget) })
    : tr("edit")
  editor.showModal()
}

function render() {
  if (!workspace) {
    $("empty-title").textContent = tr("startTitle")
    $("empty-help").textContent = tr("startHelp")
    return
  }
  const rows = workspace.entries.map((entry) => {
    const text = entry.translations.get(activeTarget) ?? ""
    return {
      entry, text,
      issues: Corpus.issues({ source: entry.source, target: text }),
      edited: text !== (entry.originalTranslations.get(activeTarget) ?? ""),
    }
  })
  const query = search.value.trim().toLowerCase()
  const shown = rows.filter((row) => visible(row, query))
  $("total").textContent = rows.length
  $("untranslated-count").textContent = rows.filter(({ text }) => !text.trim()).length
  $("issue-count").textContent = rows.filter(({ issues }) => issues.length > 0).length
  $("count").textContent = tr("count", { shown: shown.length, total: rows.length })
  $("empty-title").textContent = tr("emptyTitle")
  $("empty-help").textContent = tr("emptyHelp")
  $("empty").hidden = shown.length > 0
  $("table-scroll").hidden = shown.length === 0

  const body = document.createDocumentFragment()
  for (const { entry, text, issues, edited } of shown) {
    const row = document.createElement("tr")
    row.setAttribute("role", "row")
    const meta = [entry.id, entry.context].filter(Boolean).join("\n")
    const badge = document.createElement("span")
    badge.className = issues.length ? "badge issue" : "badge passed"
    badge.textContent = issues.length ? issues.map((issue) => tr(issue)).join("\n") : tr("passed")
    const validation = cell("")
    validation.append(badge)
    const button = document.createElement("button")
    button.type = "button"
    button.className = "button row-button"
    button.textContent = tr("edit")
    button.addEventListener("click", () => editEntry(entry, text))
    const actions = cell("", "actions")
    actions.append(button)
    row.append(
      cell(meta || "—", "metadata"),
      cell(entry.source, "", "source", workspace.sourceLocale),
      cell(text || "—", edited ? "edited" : "", "target", activeTarget),
      validation,
      actions,
    )
    body.append(row)
  }
  $("rows").replaceChildren(body)
}

function applyLanguage() {
  document.documentElement.lang = language
  for (const node of document.querySelectorAll("[data-t]")) node.textContent = tr(node.dataset.t)
  for (const node of document.querySelectorAll("[data-label]")) {
    node.setAttribute("aria-label", tr(node.dataset.label))
  }
  for (const node of document.querySelectorAll("[data-placeholder]")) {
    node.placeholder = tr(node.dataset.placeholder)
  }
  updateLanguageControls()
  updateMessage()
  render()
}

function loadCorpus(text, name) {
  if (editor.open || localeDialog.open) {
    notify("finishDialog")
    return
  }
  const next = Corpus.open(Corpus.parse(text, name))
  if (pendingExport && !window.confirm(tr("replaced"))) return
  workspace = next
  activeTarget = workspace.targetLocales[0]
  pendingExport = false
  filename = name.replace(/\.[^.]+$/, "")
  notify("imported", { name })
  search.value = ""
  filter.value = "all"
  for (const control of [search, filter, $("jsonl"), $("csv"), sourceLocale, targetLocale, $("new-locale")]) {
    control.disabled = false
  }
  updateLanguageControls()
  render()
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0]
  if (!file) return
  const startedIn = workspace
  fileInput.disabled = true
  try {
    if (!/\.(jsonl|csv)$/i.test(file.name)) throw { code: "invalidFile" }
    const text = await file.text()
    if (workspace === startedIn) loadCorpus(text, file.name)
  } catch (error) {
    if (workspace === startedIn) notify("importError", {}, error)
  } finally {
    fileInput.value = ""
    fileInput.disabled = false
  }
})

for (const button of document.querySelectorAll("[data-example]")) {
  button.addEventListener("click", () => {
    const name = button.dataset.example
    loadCorpus(ViewerExamples[name], name)
  })
}

$("ui-language").addEventListener("change", (event) => {
  language = event.target.value
  applyLanguage()
})
sourceLocale.addEventListener("change", () => {
  try {
    const code = sourceLocale.value.trim() ? Corpus.localeTag(sourceLocale.value) : ""
    if (workspace.sourceLocale !== code) {
      workspace.sourceLocale = code
      pendingExport = true
      notify("sourceUpdated")
      render()
    }
  } catch (error) {
    notify(error.code)
  }
  sourceLocale.value = workspace.sourceLocale
})
targetLocale.addEventListener("change", () => {
  activeTarget = targetLocale.value
  render()
})
$("new-locale").addEventListener("click", () => {
  $("locale-title").textContent = tr(targetAction())
  localeInput.value = ""
  localeError.hidden = true
  localeDialog.showModal()
})
$("locale-cancel").addEventListener("click", () => localeDialog.close())
$("locale-form").addEventListener("submit", (event) => {
  event.preventDefault()
  try {
    const previous = workspace.targetLocales.join(",")
    activeTarget = Corpus.addTarget(workspace, localeInput.value)
    if (previous !== workspace.targetLocales.join(",")) {
      pendingExport = true
      notify("targetUpdated")
    }
    updateLanguageControls()
    render()
    localeDialog.close()
  } catch (error) {
    localeError.textContent = errorMessage(error)
    localeError.hidden = false
  }
})

search.addEventListener("input", render)
filter.addEventListener("change", render)
$("cancel").addEventListener("click", () => editor.close())
$("edit-form").addEventListener("submit", (event) => {
  event.preventDefault()
  if (current.initialText !== target.value) {
    current.entry.translations.set(current.tag, target.value)
    pendingExport = true
    notify("saved")
    render()
  }
  editor.close()
})

for (const [format, type] of [["jsonl", "application/x-ndjson"], ["csv", "text/csv"]]) {
  $(format).addEventListener("click", () => {
    const content = Corpus.serialize(Corpus.toRows(workspace), format)
    const url = URL.createObjectURL(new Blob([content], { type: type + ";charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = filename + "-edited." + format
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    pendingExport = false
    notify("download", { format: format.toUpperCase() })
  })
}

window.addEventListener("beforeunload", (event) => {
  if (!pendingExport) return
  event.preventDefault()
  event.returnValue = ""
})

applyLanguage()
