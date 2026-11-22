import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import Corpus from "../corpus.js"
import examples from "../examples/bundled.js"
import messages from "../i18n.js"

const demoFiles = [
  ["bga-style-demo.jsonl", "boardGame", "boardGameHelp", "JSONL"],
  ["app-ui-demo.csv", "appCopy", "appHelp", "CSV"],
  ["multilingual-demo.jsonl", "multilingual", "multilingualHelp", "JSONL"],
]
const filters = [["all", "all"], ["issues", "issues"], ["untranslated", "untranslated"], ["edited", "edited"]]

function visible({ entry, text, issues, edited }, filter, query) {
  if (![entry.id, entry.context, entry.source, text].some((value) => value.toLowerCase().includes(query))) {
    return false
  }
  switch (filter) {
    case "issues": return issues.length > 0
    case "untranslated": return !text.trim()
    case "edited": return edited
    default: return true
  }
}

function Sidebar({ t, onFile, onExample, reading }) {
  return <aside className="sidebar" aria-label={t("sources")}>
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">Aa</span>
      <span>{t("brand")}</span>
    </div>
    <section className="sidebar-section" aria-labelledby="import-heading">
      <h2 id="import-heading">{t("corpusFile")}</h2>
      <label className="file-picker">
        <span className="file-picker-icon" aria-hidden="true" />
        <span><strong>{t("importFile")}</strong><small>JSONL / CSV · UTF-8</small></span>
        <input id="import" type="file" accept=".jsonl,.csv" aria-label={t("importLabel")}
          onChange={onFile} disabled={reading} />
      </label>
    </section>
    <section className="sidebar-section" aria-labelledby="examples-heading">
      <h2 id="examples-heading">{t("examples")}</h2>
      <div className="examples">
        {demoFiles.map(([file, title, description, format]) =>
          <button key={file} className="example-button" type="button" onClick={() => onExample(file)}>
            <span><strong>{t(title)}</strong><small>{t(description)}</small></span>
            <span className="file-type">{format}</span>
          </button>,
        )}
      </div>
    </section>
    <p className="local-status">{t("offline")}</p>
  </aside>
}

function Header({ t, language, setLanguage, canExport, onExport }) {
  return <header className="page-header">
    <div><h1>{t("title")}</h1><p>{t("intro")}</p></div>
    <div className="header-tools">
      <div className="ui-language" role="group" aria-label={t("uiLanguage")}>
        <button type="button" lang="en" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>English</button>
        <button type="button" lang="zh-CN" aria-pressed={language === "zh-CN"} onClick={() => setLanguage("zh-CN")}>简体中文</button>
      </div>
      <div className="downloads">
        <button type="button" className="button" disabled={!canExport} onClick={() => onExport("csv")}>{t("exportCsv")}</button>
        <button type="button" className="button primary" disabled={!canExport} onClick={() => onExport("jsonl")}>{t("exportJsonl")}</button>
      </div>
    </div>
  </header>
}

function LanguageControls({ t, language, workspace, activeTarget, languageName, onTarget, onSourceEdit, onTargetEdit }) {
  const tabs = useRef(null)
  const locales = workspace?.targetLocales
  const targetAction = locales?.[0] === "" ? "nameTarget" : "addTarget"

  useLayoutEffect(() => {
    const group = tabs.current
    const tab = group?.querySelector('[aria-selected="true"]')
    if (!tab) return
    const bounds = group.getBoundingClientRect()
    const selected = tab.getBoundingClientRect()
    if (selected.left < bounds.left) group.scrollLeft -= bounds.left - selected.left
    if (selected.right > bounds.right) group.scrollLeft += selected.right - bounds.right
  }, [locales, activeTarget, language])

  function onKey(event, index) {
    const length = locales.length
    let next
    switch (event.key) {
      case "ArrowLeft": next = (index + length - 1) % length; break
      case "ArrowRight": next = (index + 1) % length; break
      case "Home": next = 0; break
      case "End": next = length - 1; break
      default: return
    }
    event.preventDefault()
    onTarget(locales[next])
    tabs.current.children[next].focus({ preventScroll: true })
  }

  const source = workspace?.sourceLocale
  return <div className="language-controls" role="group" aria-label={t("languages")}>
    <div className="source-language">
      <span className="field-title">{t("sourceLanguage")}</span>
      <button type="button" className="button source-button" disabled={!workspace} onClick={onSourceEdit}
        aria-label={t("sourceControl", { language: languageName(source) })}>
        <span>{languageName(source)}</span>
        <span className="language-code" aria-hidden="true">{source || "—"}</span>
      </button>
    </div>
    <div className="target-language">
      <div className="target-heading">
        <span className="field-title">{t("targetLanguage")}</span>
        <button type="button" className="button language-add" disabled={!workspace} onClick={onTargetEdit}>
          {t(targetAction)}
        </button>
      </div>
      {locales ? <div ref={tabs} className="target-tabs" role="tablist" aria-label={t("targetLanguage")}>
        {locales.map((tag, index) => <button key={tag} id={"target-tab-" + index} type="button" role="tab"
          className="target-tab" aria-controls="translation-panel" aria-selected={tag === activeTarget}
          tabIndex={tag === activeTarget ? 0 : -1}
          onClick={() => onTarget(tag)} onKeyDown={(event) => onKey(event, index)}>
          <span>{languageName(tag)}</span>
          {tag && <span className="language-code">{tag}</span>}
        </button>)}
      </div> : <p className="target-placeholder">{t("noTarget")}</p>}
    </div>
  </div>
}

function CorpusTable({ t, workspace, activeTarget, languageName, rows, onEdit }) {
  const source = workspace.sourceLocale
  return <div className="table-scroll" tabIndex={0} role="region" aria-label={t("table")}>
    <table role="table" aria-label={t("rows")}>
      <thead role="rowgroup"><tr role="row">
        <th scope="col" role="columnheader">{t("context")}</th>
        <th scope="col" role="columnheader">{t("source")}{source && <small>{languageName(source)}</small>}</th>
        <th scope="col" role="columnheader">{t("target")}{activeTarget && <small>{languageName(activeTarget)}</small>}</th>
        <th scope="col" role="columnheader">{t("validation")}</th>
        <th scope="col" role="columnheader">{t("actions")}</th>
      </tr></thead>
      <tbody role="rowgroup">
        {rows.map((row) => <tr role="row" key={row.index}>
          <td role="cell" className="metadata">{[row.entry.id, row.entry.context].filter(Boolean).join("\n") || "—"}</td>
          <td role="cell" data-heading={t("source")}>
            <span className="literal" lang={source || undefined} dir="auto">{row.entry.source}</span>
          </td>
          <td role="cell" data-heading={t("target")} className={row.edited ? "edited" : undefined}>
            <span className="literal" lang={activeTarget || undefined} dir="auto">{row.text || "—"}</span>
          </td>
          <td role="cell"><span className={row.issues.length ? "badge issue" : "badge passed"}>
            {row.issues.length ? row.issues.map((issue) => t(issue)).join("\n") : t("passed")}
          </span></td>
          <td role="cell" className="actions"><button type="button" className="button row-button" onClick={() => onEdit(row)}>
            {t("edit")}
          </button></td>
        </tr>)}
      </tbody>
    </table>
  </div>
}

function EditorDialog({ t, dialog, onClose, onChange, onSave }) {
  const modal = useRef(null)
  const isEdit = dialog.kind === "edit"
  const isSource = dialog.kind === "source"
  useLayoutEffect(() => {
    const element = modal.current
    element.showModal()
    return () => element.close()
  }, [])

  return <dialog ref={modal} aria-labelledby="dialog-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
    <form onSubmit={onSave} noValidate>
      <h2 id="dialog-title">{dialog.title}</h2>
      {isEdit ? <>
        <p className="field-title">{t("source")}</p>
        <p id="edit-source" lang={dialog.sourceLocale || undefined} dir="auto">{dialog.source}</p>
        <label htmlFor="edit-target">{t("target")}</label>
        <textarea id="edit-target" rows={5} lang={dialog.tag || undefined} dir="auto"
          autoComplete="off" spellCheck={false} autoFocus value={dialog.value} onChange={onChange} />
      </> : <>
        <label htmlFor="locale-tag">{t("tagLabel")}</label>
        <input id="locale-tag" type="text" autoComplete="off" spellCheck={false}
          aria-describedby="locale-help locale-error" required={!isSource} autoFocus value={dialog.value} onChange={onChange} />
        <p id="locale-help" className="field-help">{t(isSource ? "sourceTagHelp" : "tagHelp")}</p>
        <p id="locale-error" className="field-error" role="alert" hidden={!dialog.error}>{dialog.error}</p>
      </>}
      <div className="dialog-actions">
        <button type="button" className="button" onClick={onClose}>{t("cancel")}</button>
        <button type="submit" className="button primary">{t(isEdit ? "save" : "saveLanguage")}</button>
      </div>
    </form>
  </dialog>
}

function App() {
  const [language, setLanguage] = useState("en")
  const [workspace, setWorkspace] = useState(null)
  const [filename, setFilename] = useState("")
  const [activeTarget, setActiveTarget] = useState("")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [dirty, setDirty] = useState(false)
  const [reading, setReading] = useState(false)
  const [message, setMessage] = useState({ key: "waiting" })
  const [dialog, setDialog] = useState(null)
  const current = useRef({ dirty: false, dialog: null, language: "en" })
  const importVersion = useRef(0)
  const searchInput = useRef(null)
  const t = (key, values = {}) => messages[language][key].replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "")
  const languageNames = useMemo(() => new Intl.DisplayNames([language], { type: "language" }), [language])
  const languageName = (tag) => tag ? languageNames.of(new Intl.Locale(tag).baseName) : t("unnamed")

  useLayoutEffect(() => { current.current = { dirty, dialog, language } })
  useEffect(() => {
    document.documentElement.lang = language
    document.title = messages[language].brand
  }, [language])
  useEffect(() => {
    if (!dirty) return
    const warn = (event) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const rows = useMemo(() => (workspace?.entries ?? []).map((entry, index) => {
    const text = entry.translations.get(activeTarget) ?? ""
    return { entry, index, text, issues: Corpus.issues({ source: entry.source, target: text }),
      edited: text !== (entry.originalTranslations.get(activeTarget) ?? "") }
  }), [workspace, activeTarget])
  const query = search.trim().toLowerCase()
  const shown = rows.filter((row) => visible(row, filter, query))
  const metrics = [
    ["total", rows.length],
    ["untranslated", rows.filter(({ text }) => !text.trim()).length],
    ["issues", rows.filter(({ issues }) => issues.length).length],
  ]
  const targetIndex = workspace?.targetLocales.indexOf(activeTarget) ?? -1
  const targetAction = workspace?.targetLocales[0] === "" ? "nameTarget" : "addTarget"

  function errorMessage(error) {
    const details = error.details ?? {}
    const key = Object.hasOwn(messages[language], error.code) ? error.code : "inputError"
    const text = t(key, details)
    return details.position ? t(details.format + "Location", { position: details.position, error: text }) : text
  }

  function loadCorpus(text, name) {
    if (current.current.dialog) {
      setMessage({ key: "finishDialog" })
      return
    }
    try {
      const next = Corpus.open(Corpus.parse(text, name))
      if (current.current.dirty && !window.confirm(messages[current.current.language].replaced)) return
      importVersion.current += 1
      setWorkspace(next)
      setActiveTarget(next.targetLocales[0])
      setFilename(name.replace(/\.[^.]+$/, ""))
      setMessage({ key: "imported", values: { name } })
      setSearch("")
      setFilter("all")
      setDirty(false)
    } catch (error) {
      setMessage({ key: "importError", error })
    }
  }

  async function importFile(event) {
    const input = event.currentTarget
    const file = input.files[0]
    if (!file) return
    const version = importVersion.current
    setReading(true)
    try {
      if (!/\.(jsonl|csv)$/i.test(file.name)) throw { code: "invalidFile" }
      const text = await file.text()
      if (version === importVersion.current) loadCorpus(text, file.name)
    } catch (error) {
      if (version === importVersion.current) setMessage({ key: "importError", error })
    } finally {
      input.value = ""
      setReading(false)
    }
  }

  function openEditor(row) {
    const value = row.text.replace(/\r\n?/g, "\n")
    setDialog({ kind: "edit", index: row.index, tag: activeTarget, source: row.entry.source,
      sourceLocale: workspace.sourceLocale, value, initialValue: value,
      title: activeTarget ? t("editIn", { language: languageName(activeTarget) }) : t("edit") })
  }

  function saveDialog(event) {
    event.preventDefault()
    if (dialog.kind === "edit") {
      if (dialog.initialValue !== dialog.value) {
        const entries = [...workspace.entries]
        const entry = entries[dialog.index]
        const translations = new Map(entry.translations).set(dialog.tag, dialog.value)
        entries[dialog.index] = { ...entry, translations }
        setWorkspace({ ...workspace, entries })
        setDirty(true)
        setMessage({ key: "saved" })
      }
    } else {
      let code
      try {
        code = dialog.kind === "source" && !dialog.value.trim() ? "" : Corpus.localeTag(dialog.value)
      } catch (error) {
        setDialog({ ...dialog, error: errorMessage(error) })
        return
      }
      if (dialog.kind === "source") {
        if (workspace.sourceLocale !== code) {
          setWorkspace({ ...workspace, sourceLocale: code })
          setDirty(true)
          setMessage({ key: "sourceUpdated" })
        }
      } else {
        if (!workspace.targetLocales.includes(code)) {
          const next = { ...workspace, targetLocales: [...workspace.targetLocales] }
          if (next.targetLocales[0] === "") {
            next.entries = next.entries.map((entry) => ({ ...entry,
              translations: new Map(entry.translations), originalTranslations: new Map(entry.originalTranslations) }))
          }
          Corpus.addTarget(next, code)
          setWorkspace(next)
          setDirty(true)
          setMessage({ key: "targetUpdated" })
        }
        setActiveTarget(code)
      }
    }
    setDialog(null)
  }

  function exportFile(format) {
    const content = Corpus.serialize(Corpus.toRows(workspace), format)
    const mime = format === "csv" ? "text/csv" : "application/x-ndjson"
    const url = URL.createObjectURL(new Blob([content], { type: mime + ";charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = filename + "-edited." + format
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setDirty(false)
    setMessage({ key: "download", values: { format: format.toUpperCase() } })
  }

  function clearFilters() {
    setSearch("")
    setFilter("all")
    searchInput.current.focus()
  }

  return <div className="app-shell">
    <Sidebar t={t} onFile={importFile} onExample={(name) => loadCorpus(examples[name], name)} reading={reading} />
    <main className="main-panel">
      <Header t={t} language={language} setLanguage={setLanguage} canExport={Boolean(workspace)} onExport={exportFile} />
      <dl className="metrics" aria-label={t("stats")}>
        {metrics.map(([key, count]) => <div className="metric" key={key} data-metric={key}>
          <dt>{t(key)}</dt><dd>{count}</dd>
        </div>)}
      </dl>
      <section className="workspace" aria-label={t("rows")}>
        <LanguageControls t={t} language={language} workspace={workspace} activeTarget={activeTarget}
          languageName={languageName} onTarget={setActiveTarget}
          onSourceEdit={() => setDialog({ kind: "source", value: workspace.sourceLocale, title: t("changeSource") })}
          onTargetEdit={() => setDialog({ kind: "target", value: "", title: t(targetAction) })} />
        <div id="translation-panel" role={workspace ? "tabpanel" : undefined}
          aria-labelledby={targetIndex >= 0 ? "target-tab-" + targetIndex : undefined}>
          <div className="toolbar">
            <label><span>{t("search")}</span>
              <input ref={searchInput} type="search" placeholder={t("searchHint")} autoComplete="off" spellCheck={false}
                disabled={!workspace} value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <label><span>{t("filter")}</span>
              <select disabled={!workspace} value={filter} onChange={(event) => setFilter(event.target.value)}>
                {filters.map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}
              </select>
            </label>
          </div>
          <div className="summary">
            <p role="status">{t(message.key, message.error ? { error: errorMessage(message.error) } : message.values)}</p>
            <p className="entry-count" aria-live="polite">
              {workspace && t("count", { shown: shown.length, total: rows.length })}
            </p>
          </div>
          {shown.length > 0
            ? <CorpusTable t={t} workspace={workspace} activeTarget={activeTarget} languageName={languageName} rows={shown} onEdit={openEditor} />
            : <div className="empty-state">
              <span className="empty-icon" aria-hidden="true" />
              <h2>{t(workspace ? "emptyTitle" : "startTitle")}</h2>
              <p>{workspace ? t("emptyForTarget", { language: languageName(activeTarget) }) : t("startHelp")}</p>
              {workspace && (query || filter !== "all") && <button type="button" className="button" onClick={clearFilters}>
                {t("clearFilters")}
              </button>}
            </div>}
        </div>
      </section>
    </main>
    {dialog && <EditorDialog t={t} dialog={dialog} onClose={() => setDialog(null)}
      onChange={(event) => setDialog({ ...dialog, value: event.target.value, error: undefined })} onSave={saveDialog} />}
  </div>
}

createRoot(document.getElementById("root")).render(<App />)
