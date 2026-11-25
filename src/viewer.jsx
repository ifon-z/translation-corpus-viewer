import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import Corpus from "../corpus.js"
import examples from "../examples/bundled.js"
import messages from "../i18n.js"
import draftsApi from "./review-drafts.cjs"

const { draftKey, updateDraft, nameDrafts, saveDrafts } = draftsApi
const demoFiles = [
  ["bga-style-demo.jsonl", "boardGame"],
  ["app-ui-demo.csv", "appCopy"],
  ["multilingual-demo.jsonl", "multilingual"],
]
const filters = ["all", "issues", "untranslated", "edited"]

function visible({ entry, text, issues, edited }, filter, query) {
  if (![entry.id, entry.context, entry.source, text].some((value) => value.toLowerCase().includes(query))) return false
  if (filter === "issues") return issues.length > 0
  if (filter === "untranslated") return !text.trim()
  if (filter === "edited") return edited
  return true
}

function reveal(control, horizontal) {
  const container = control?.closest(horizontal ? ".target-tabs" : ".entry-list")
  if (!container) return
  const bounds = container.getBoundingClientRect()
  const item = control.getBoundingClientRect()
  if (horizontal) {
    if (item.left < bounds.left) container.scrollLeft -= bounds.left - item.left
    if (item.right > bounds.right) container.scrollLeft += item.right - bounds.right
  } else {
    if (item.top < bounds.top) container.scrollTop -= bounds.top - item.top
    if (item.bottom > bounds.bottom) container.scrollTop += item.bottom - bounds.bottom
  }
}

function navigate(event, position, length, backward, forward) {
  let next
  if (event.key === backward) next = (position + length - 1) % length
  else if (event.key === forward) next = (position + 1) % length
  else if (event.key === "Home") next = 0
  else if (event.key === "End") next = length - 1
  else return null
  event.preventDefault()
  return next
}

function Header({ t, language, setLanguage, canExport, onExport, onFile, onExample, reading }) {
  const choose = (event, action) => {
    event.currentTarget.closest("details").open = false
    action()
  }
  return <header className="app-header">
    <h1>{t("title")}</h1>
    <div className="header-actions">
      <label className="button import-button">
        {t("importShort")}
        <input id="import" type="file" accept=".jsonl,.csv" aria-label={t("importLabel")}
          onChange={onFile} disabled={reading} />
      </label>
      <details className="action-menu">
        <summary className="button">{t("examplesShort")}</summary>
        <div className="menu-items">
          {demoFiles.map(([file, key]) => <button key={file} type="button"
            onClick={(event) => choose(event, () => onExample(file))}>{t(key)}</button>)}
        </div>
      </details>
      <div className="ui-language" role="group" aria-label={t("uiLanguage")}>
        <button type="button" lang="en" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>English</button>
        <button type="button" lang="zh-CN" aria-pressed={language === "zh-CN"} onClick={() => setLanguage("zh-CN")}>简体中文</button>
      </div>
      {canExport ? <details className="action-menu export-menu">
        <summary className="button">{t("exportShort")}</summary>
        <div className="menu-items">
          <button type="button" onClick={(event) => choose(event, () => onExport("csv"))}>{t("exportCsv")}</button>
          <button type="button" onClick={(event) => choose(event, () => onExport("jsonl"))}>{t("exportJsonl")}</button>
        </div>
      </details> : <button className="button" type="button" disabled>{t("exportShort")}</button>}
    </div>
  </header>
}

function Badge({ t, issues, draft }) {
  const tone = draft ? "draft" : issues.length ? "warning" : "ready"
  const label = draft ? t("draft") : issues.length ? issues.map((issue) => t(issue)).join(" · ") : t("passed")
  return <span className={"badge " + tone}>{label}</span>
}

function ReviewList({ t, rows, selected, onSelect, drafts, activeTarget, disabled, search, setSearch,
  filter, setFilter, searchInput, total, message }) {
  const list = useRef(null)
  useLayoutEffect(() => {
    reveal(list.current?.querySelector('[aria-current="true"]'), false)
  }, [selected?.index, rows.length])

  return <aside className="review-list" aria-label={t("entryList")}>
    <div className="list-controls">
      <label>
        <span className="sr-only">{t("search")}</span>
        <input ref={searchInput} type="search" placeholder={t("searchEntries")} autoComplete="off" spellCheck={false}
          disabled={disabled} value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      <label>
        <span className="sr-only">{t("filter")}</span>
        <select disabled={disabled} value={filter} onChange={(event) => setFilter(event.target.value)}>
          {filters.map((key) => <option key={key} value={key}>{t(key)}</option>)}
        </select>
      </label>
    </div>
    {rows.length > 0 && <ul className="entry-list" ref={list}>
      {rows.map((row, position) => {
        const active = row.index === selected.index
        const title = row.entry.context || row.entry.id || row.entry.source
        return <li key={row.index}>
          <button type="button" className="entry-button" aria-current={active ? "true" : undefined}
            tabIndex={active ? 0 : -1} onClick={() => onSelect(row.index)}
            onKeyDown={(event) => {
              const next = navigate(event, position, rows.length, "ArrowUp", "ArrowDown")
              if (next == null) return
              onSelect(rows[next].index)
              list.current.children[next].firstElementChild.focus({ preventScroll: true })
            }}>
            <span className="entry-label">
              <strong>{title}</strong>
              {row.entry.id && row.entry.id !== title && <small>{row.entry.id}</small>}
            </span>
            <Badge t={t} issues={row.issues} draft={drafts.has(draftKey(row.index, activeTarget))} />
          </button>
        </li>
      })}
    </ul>}
    <div className="list-summary">
      <span role="status">{message}</span>
      {!disabled && <span aria-live="polite">{t("count", { shown: rows.length, total })}</span>}
    </div>
  </aside>
}

function LanguageControls({ t, language, workspace, activeTarget, languageName, onTarget, onSourceEdit, onTargetEdit }) {
  const tabs = useRef(null)
  const locales = workspace.targetLocales
  useLayoutEffect(() => {
    reveal(tabs.current.querySelector('[aria-selected="true"]'), true)
  }, [locales, activeTarget, language])

  return <div className="language-controls" role="group" aria-label={t("languages")}>
    <div className="source-language">
      <span>{t("sourceLanguage")}</span>
      <button type="button" className="button source-button" onClick={onSourceEdit}
        aria-label={t("sourceControl", { language: languageName(workspace.sourceLocale) })}>
        {languageName(workspace.sourceLocale)}
      </button>
    </div>
    <div className="target-language">
      <span>{t("targetLanguage")}</span>
      <div ref={tabs} className="target-tabs" role="tablist" aria-label={t("targetLanguage")}>
        {locales.map((tag, index) => <button key={tag} id={"target-tab-" + index} type="button" role="tab"
          className="target-tab" aria-controls="translation-panel" aria-selected={tag === activeTarget}
          aria-label={tag ? languageName(tag) + " · " + tag : undefined}
          tabIndex={tag === activeTarget ? 0 : -1}
          onClick={() => onTarget(tag)} onKeyDown={(event) => {
            const next = navigate(event, index, locales.length, "ArrowLeft", "ArrowRight")
            if (next == null) return
            onTarget(locales[next])
            tabs.current.children[next].focus({ preventScroll: true })
          }}>{languageName(tag)}</button>)}
      </div>
      <button type="button" className="button language-add" onClick={onTargetEdit}>
        {t(locales[0] === "" ? "nameTarget" : "addTarget")}
      </button>
    </div>
  </div>
}

function ReviewEditor({ t, row, tag, sourceLocale, languageName, draft, onDraft, onSave, previous, next, onSelect }) {
  const text = draft?.text ?? row.text.replace(/\r\n?/g, "\n")
  const issues = draft ? Corpus.issues({ source: row.entry.source, target: text }) : row.issues
  const sourceLabel = sourceLocale ? t("sourceWithLanguage", { language: languageName(sourceLocale) }) : t("source")
  const targetLabel = tag ? t("translationLanguage", { language: languageName(tag) }) : t("target")
  return <>
    <div className="review-panes">
      <section aria-labelledby="source-title">
        <h3 id="source-title">{sourceLabel}</h3>
        <div className="source-text" lang={sourceLocale || undefined} dir="auto">{row.entry.source}</div>
      </section>
      <div className="target-pane">
        <label htmlFor="review-translation">{targetLabel}</label>
        <div className="translation-field" key={draftKey(row.index, tag)}>
          <span className="field-badge" id="translation-status"><Badge t={t} issues={issues} /></span>
          <textarea id="review-translation" lang={tag || undefined} dir="auto" spellCheck={false}
            autoComplete="off" aria-describedby="translation-status" value={text}
            onChange={(event) => onDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) {
                event.preventDefault()
                if (draft) onSave()
              }
            }} />
        </div>
      </div>
    </div>
    <div className="review-actions">
      <div className="step-actions">
        <button type="button" className="button" disabled={!previous} onClick={() => onSelect(previous.index)}>{t("previous")}</button>
        <button type="button" className="button" disabled={!next} onClick={() => onSelect(next.index)}>{t("next")}</button>
      </div>
      <button type="button" className="button primary" disabled={!draft} onClick={onSave}>{t("save")}</button>
    </div>
  </>
}

function LocaleDialog({ t, dialog, onClose, onChange, onSave }) {
  const modal = useRef(null)
  const isSource = dialog.kind === "source"
  useLayoutEffect(() => {
    const element = modal.current
    element.showModal()
    return () => element.close()
  }, [])
  return <dialog ref={modal} aria-labelledby="dialog-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
    <form onSubmit={onSave} noValidate>
      <h2 id="dialog-title">{dialog.title}</h2>
      <label htmlFor="locale-tag">{t("tagLabel")}</label>
      <input id="locale-tag" type="text" autoComplete="off" spellCheck={false}
        aria-describedby="locale-help locale-error" required={!isSource} autoFocus value={dialog.value} onChange={onChange} />
      <p id="locale-help" className="field-help">{t(isSource ? "sourceTagHelp" : "tagHelp")}</p>
      <p id="locale-error" className="field-error" role="alert" hidden={!dialog.error}>{dialog.error}</p>
      <div className="dialog-actions">
        <button type="button" className="button" onClick={onClose}>{t("cancel")}</button>
        <button type="submit" className="button primary">{t("saveLanguage")}</button>
      </div>
    </form>
  </dialog>
}

function App() {
  const [language, setLanguage] = useState("en")
  const [workspace, setWorkspace] = useState(null)
  const [filename, setFilename] = useState("")
  const [activeTarget, setActiveTarget] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [dirty, setDirty] = useState(false)
  const [drafts, setDrafts] = useState(() => new Map())
  const [reading, setReading] = useState(false)
  const [message, setMessage] = useState({ key: "waiting" })
  const [dialog, setDialog] = useState(null)
  const hasChanges = dirty || drafts.size > 0
  const current = useRef({ hasChanges: false, dialog: null, language: "en" })
  const importVersion = useRef(0)
  const searchInput = useRef(null)
  const t = (key, values = {}) => messages[language][key].replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "")
  const languageNames = useMemo(() => new Intl.DisplayNames([language], { type: "language" }), [language])
  const languageName = (tag) => tag ? languageNames.of(new Intl.Locale(tag).baseName) : t("unnamed")

  useLayoutEffect(() => { current.current = { hasChanges, dialog, language } })
  useEffect(() => {
    document.documentElement.lang = language
    document.title = messages[language].title
  }, [language])
  useEffect(() => {
    if (!hasChanges) return
    const warn = (event) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [hasChanges])

  const rows = useMemo(() => (workspace?.entries ?? []).map((entry, index) => {
    const text = entry.translations.get(activeTarget) ?? ""
    return { entry, index, text, issues: Corpus.issues({ source: entry.source, target: text }),
      edited: text !== (entry.originalTranslations.get(activeTarget) ?? "") }
  }), [workspace, activeTarget])
  const query = search.trim().toLowerCase()
  const shown = rows.filter((row) => visible(row, filter, query))
  const selectedPosition = Math.max(0, shown.findIndex((row) => row.index === selectedIndex))
  const selected = shown[selectedPosition]
  const selectedDraft = selected && drafts.get(draftKey(selected.index, activeTarget))
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
      if (current.current.hasChanges && !window.confirm(messages[current.current.language].replaced)) return
      importVersion.current += 1
      setWorkspace(next)
      setActiveTarget(next.targetLocales[0])
      setSelectedIndex(0)
      setFilename(name.replace(/\.[^.]+$/, ""))
      setMessage({ key: "imported", values: { name } })
      setSearch("")
      setFilter("all")
      setDrafts(new Map())
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

  function saveSelected() {
    if (!selectedDraft) return
    setWorkspace(saveDrafts(workspace, [selectedDraft]))
    setDrafts((previous) => updateDraft(previous, selectedDraft, selectedDraft.text))
    const text = selectedDraft.text
    const updated = { ...selected, text,
      issues: Corpus.issues({ source: selected.entry.source, target: text }),
      edited: text !== (selected.entry.originalTranslations.get(activeTarget) ?? "") }
    if (!visible(updated, filter, query)) {
      setSelectedIndex(shown[selectedPosition + 1]?.index ?? shown[selectedPosition - 1]?.index ?? selected.index)
    }
    setDirty(true)
    setMessage({ key: "saved" })
  }

  function saveLocale(event) {
    event.preventDefault()
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
          setDrafts((previous) => nameDrafts(previous, code))
        }
        Corpus.addTarget(next, code)
        setWorkspace(next)
        setDirty(true)
        setMessage({ key: "targetUpdated" })
      }
      setActiveTarget(code)
    }
    setDialog(null)
  }

  function exportFile(format) {
    const next = drafts.size ? saveDrafts(workspace, drafts.values()) : workspace
    const content = Corpus.serialize(Corpus.toRows(next), format)
    const mime = format === "csv" ? "text/csv" : "application/x-ndjson"
    const url = URL.createObjectURL(new Blob([content], { type: mime + ";charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = filename + "-edited." + format
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setWorkspace(next)
    setDrafts(new Map())
    setDirty(false)
    setMessage({ key: "download", values: { format: format.toUpperCase() } })
  }

  function clearFilters() {
    setSearch("")
    setFilter("all")
    searchInput.current.focus()
  }

  return <div className="app-shell">
    <Header t={t} language={language} setLanguage={setLanguage} canExport={Boolean(workspace)}
      onExport={exportFile} onFile={importFile} onExample={(name) => loadCorpus(examples[name], name)} reading={reading} />
    <div className="review-layout">
      <ReviewList t={t} rows={shown} selected={selected} onSelect={setSelectedIndex} drafts={drafts}
        activeTarget={activeTarget} disabled={!workspace} search={search} setSearch={setSearch}
        filter={filter} setFilter={setFilter} searchInput={searchInput} total={rows.length}
        message={t(message.key, message.error ? { error: errorMessage(message.error) } : message.values)} />
      <main className="review-main">
        {workspace && <>
          {selected && <h2 className="entry-title">{selected.entry.context || selected.entry.id || selected.entry.source}</h2>}
          <LanguageControls t={t} language={language} workspace={workspace} activeTarget={activeTarget}
            languageName={languageName} onTarget={setActiveTarget}
            onSourceEdit={() => setDialog({ kind: "source", value: workspace.sourceLocale, title: t("changeSource") })}
            onTargetEdit={() => setDialog({ kind: "target", value: "", title: t(targetAction) })} />
        </>}
        <div id="translation-panel" role={workspace ? "tabpanel" : undefined}
          aria-labelledby={targetIndex >= 0 ? "target-tab-" + targetIndex : undefined}>
          {selected ? <ReviewEditor t={t} row={selected} tag={activeTarget}
            sourceLocale={workspace.sourceLocale} languageName={languageName} draft={selectedDraft}
            onDraft={(text) => setDrafts((previous) => updateDraft(previous,
              { index: selected.index, tag: activeTarget, text }, selected.text))}
            onSave={saveSelected} previous={shown[selectedPosition - 1]} next={shown[selectedPosition + 1]}
            onSelect={setSelectedIndex} />
            : <div className="empty-state">
              <h2>{t(workspace ? "emptyTitle" : "startTitle")}</h2>
              <p>{workspace ? t("emptyForTarget", { language: languageName(activeTarget) }) : t("startHelp")}</p>
              {workspace && (query || filter !== "all") && <button type="button" className="button" onClick={clearFilters}>
                {t("clearFilters")}
              </button>}
            </div>}
        </div>
      </main>
    </div>
    {dialog && <LocaleDialog t={t} dialog={dialog} onClose={() => setDialog(null)}
      onChange={(event) => setDialog({ ...dialog, value: event.target.value, error: undefined })} onSave={saveLocale} />}
  </div>
}

createRoot(document.getElementById("root")).render(<App />)
