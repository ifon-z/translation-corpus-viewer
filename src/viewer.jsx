import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import Corpus from "../corpus.js"
import examples from "../examples/bundled.js"
import messages from "../i18n.js"
import draftsApi from "./review-drafts.cjs"

const { draftKey, updateDraft, nameDrafts, saveDrafts } = draftsApi
const demoFiles = [
  ["multilingual-demo.jsonl", "multilingual"],
  ["bga-style-demo.jsonl", "boardGame"],
  ["app-ui-demo.csv", "appCopy"],
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

function Header({ t, language, setLanguage, onExport, onFile, reading }) {
  const choose = (event, action) => {
    event.currentTarget.closest("details").open = false
    action()
  }
  return <header className="app-header">
    <h1>{t("title")}</h1>
    <div className="header-actions">
      <label className="button import-button">
        {t(reading ? "importing" : "importShort")}
        <input id="import" type="file" accept=".jsonl,.csv" multiple aria-label={t("importLabel")}
          onChange={onFile} disabled={reading} />
      </label>
      <div className="ui-language" role="group" aria-label={t("uiLanguage")}>
        <button type="button" lang="en" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>English</button>
        <button type="button" lang="zh-CN" aria-pressed={language === "zh-CN"} onClick={() => setLanguage("zh-CN")}>简体中文</button>
      </div>
      <details className="action-menu export-menu">
        <summary className="button">{t("exportShort")}</summary>
        <div className="menu-items">
          <button type="button" onClick={(event) => choose(event, () => onExport("csv"))}>{t("exportCsv")}</button>
          <button type="button" onClick={(event) => choose(event, () => onExport("jsonl"))}>{t("exportJsonl")}</button>
        </div>
      </details>
    </div>
  </header>
}

function Badge({ t, issues, draft }) {
  const tone = draft ? "draft" : issues.length ? "warning" : "ready"
  const label = draft ? t("draft") : issues.length ? issues.map((issue) => t(issue)).join(" · ") : t("passed")
  return <span className={"badge " + tone}>{label}</span>
}

function ProjectSelect({ t, projects, activeId, onSelect }) {
  const imports = projects.filter((project) => !project.example)
  return <label className="project-select">
    <span>{t("project")}</span>
    <select value={activeId} onChange={(event) => onSelect(event.target.value)}>
      {imports.length > 0 && <optgroup label={t("importedProjects")}>
        {imports.map(({ id, name, occurrence }) => <option key={id} value={id}>
          {occurrence > 1 ? name + " (" + occurrence + ")" : name}
        </option>)}
      </optgroup>}
      <optgroup label={t("sampleProjects")}>
        {projects.filter((project) => project.example).map(({ id, example }) =>
          <option key={id} value={id}>{t(example)}</option>)}
      </optgroup>
    </select>
  </label>
}

function ReviewList({ t, projects, activeId, onProject, rows, selected, onSelect, drafts, activeTarget, search, setSearch,
  filter, setFilter, searchInput, total, message }) {
  const list = useRef(null)
  useLayoutEffect(() => {
    reveal(list.current?.querySelector('[aria-current="true"]'), false)
  }, [activeId, selected?.index, rows.length])

  return <aside className="review-list" aria-label={t("entryList")}>
    <ProjectSelect t={t} projects={projects} activeId={activeId} onSelect={onProject} />
    <div className="list-controls">
      <label>
        <span className="sr-only">{t("search")}</span>
        <input ref={searchInput} type="search" placeholder={t("searchEntries")} autoComplete="off" spellCheck={false}
          value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      <label>
        <span className="sr-only">{t("filter")}</span>
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
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
      <span aria-live="polite">{t("count", { shown: rows.length, total })}</span>
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
      <div className="save-actions">
        <span id="translation-status" className="translation-status" role="status">
          <Badge t={t} issues={issues} />
        </span>
        <button type="button" className="button primary" disabled={!draft} onClick={onSave}>{t("save")}</button>
      </div>
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

function openProject(id, name, text, example) {
  const workspace = Corpus.open(Corpus.parse(text, name))
  return {
    id, name, example, workspace, activeTarget: workspace.targetLocales[0], selectedIndex: 0,
    search: "", filter: "all", dirty: false, drafts: new Map(), message: null,
  }
}

function App() {
  const [language, setLanguage] = useState("en")
  const [projects, setProjects] = useState(() => demoFiles.map(([file, label]) =>
    openProject(file, file, examples[file], label)))
  const [activeId, setActiveId] = useState(demoFiles[0][0])
  const [reading, setReading] = useState(false)
  const [importError, setImportError] = useState(null)
  const [dialog, setDialog] = useState(null)
  const active = projects.find((project) => project.id === activeId)
  const { workspace, activeTarget, selectedIndex, search, filter, drafts, message } = active
  const hasChanges = projects.some((project) => project.dirty || project.drafts.size > 0)
  const view = useRef({ activeId, dialog })
  const fileSequence = useRef(0)
  const searchInput = useRef(null)
  const t = (key, values = {}) => messages[language][key].replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "")
  const languageNames = useMemo(() => new Intl.DisplayNames([language], { type: "language" }), [language])
  const languageName = (tag) => tag ? languageNames.of(new Intl.Locale(tag).baseName) : t("unnamed")

  useLayoutEffect(() => { view.current = { activeId, dialog } })
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

  const rows = useMemo(() => workspace.entries.map((entry, index) => {
    const text = entry.translations.get(activeTarget) ?? ""
    return { entry, index, text, issues: Corpus.issues({ source: entry.source, target: text }),
      edited: text !== (entry.originalTranslations.get(activeTarget) ?? "") }
  }), [workspace, activeTarget])
  const query = search.trim().toLowerCase()
  const shown = rows.filter((row) => visible(row, filter, query))
  const selectedPosition = Math.max(0, shown.findIndex((row) => row.index === selectedIndex))
  const selected = shown[selectedPosition]
  const selectedDraft = selected && drafts.get(draftKey(selected.index, activeTarget))
  const targetIndex = workspace.targetLocales.indexOf(activeTarget)
  const targetAction = workspace.targetLocales[0] === "" ? "nameTarget" : "addTarget"

  function errorMessage(error) {
    const details = error.details ?? {}
    const key = Object.hasOwn(messages[language], error.code) ? error.code : "inputError"
    const text = t(key, details)
    return details.position ? t(details.format + "Location", { position: details.position, error: text }) : text
  }

  function updateProject(changes) {
    setProjects((previous) => previous.map((project) => project.id === activeId
      ? { ...project, ...(typeof changes === "function" ? changes(project) : changes) } : project))
  }

  function selectProject(id) {
    setImportError(null)
    setActiveId(id)
  }

  async function importFile(event) {
    const input = event.currentTarget
    const files = Array.from(input.files)
    if (files.length === 0) return
    setReading(true)
    setImportError(null)
    try {
      const results = await Promise.all(files.map(async (file) => {
        try {
          if (!/\.(jsonl|csv)$/i.test(file.name)) throw { code: "invalidFile" }
          const id = "file-" + ++fileSequence.current
          const project = openProject(id, file.name, await file.text())
          return { project: { ...project, message: { key: "imported", values: { name: file.name } } } }
        } catch (error) {
          return { name: file.name, error }
        }
      }))
      const imported = results.flatMap(({ project }) => project ? [project] : [])
      const failures = results.filter(({ error }) => error)
      if (imported.length) {
        setProjects((previous) => {
          const occurrences = new Map()
          for (const project of previous) {
            if (!project.example) occurrences.set(project.name, project.occurrence)
          }
          return [...previous, ...imported.map((project) => {
            const occurrence = (occurrences.get(project.name) ?? 0) + 1
            occurrences.set(project.name, occurrence)
            return { ...project, occurrence }
          })]
        })
        if (view.current.activeId === activeId && !view.current.dialog) setActiveId(imported[0].id)
      }
      setImportError(failures.length ? failures : null)
    } finally {
      input.value = ""
      setReading(false)
    }
  }

  function saveSelected() {
    if (!selectedDraft) return
    const text = selectedDraft.text
    const updated = { ...selected, text,
      issues: Corpus.issues({ source: selected.entry.source, target: text }),
      edited: text !== (selected.entry.originalTranslations.get(activeTarget) ?? "") }
    const nextIndex = visible(updated, filter, query)
      ? selected.index : shown[selectedPosition + 1]?.index ?? shown[selectedPosition - 1]?.index ?? selected.index
    const remaining = new Map(drafts)
    remaining.delete(draftKey(selected.index, activeTarget))
    updateProject({ workspace: saveDrafts(workspace, [selectedDraft]), drafts: remaining,
      selectedIndex: nextIndex, dirty: true, message: { key: "saved" } })
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
        updateProject({ workspace: { ...workspace, sourceLocale: code }, dirty: true, message: { key: "sourceUpdated" } })
      }
    } else {
      if (workspace.targetLocales.includes(code)) {
        updateProject({ activeTarget: code })
      } else {
        const next = { ...workspace, targetLocales: [...workspace.targetLocales] }
        const unnamed = next.targetLocales[0] === ""
        if (unnamed) {
          next.entries = next.entries.map((entry) => ({ ...entry,
            translations: new Map(entry.translations), originalTranslations: new Map(entry.originalTranslations) }))
        }
        Corpus.addTarget(next, code)
        updateProject({ workspace: next, drafts: unnamed ? nameDrafts(drafts, code) : drafts,
          activeTarget: code, dirty: true, message: { key: "targetUpdated" } })
      }
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
    link.download = active.name.replace(/\.[^.]+$/, "") + "-edited." + format
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    updateProject({ workspace: next, drafts: new Map(), dirty: false,
      message: { key: "download", values: { format: format.toUpperCase() } } })
  }

  function clearFilters() {
    updateProject({ search: "", filter: "all" })
    searchInput.current.focus()
  }

  const selectEntry = (index) => updateProject({ selectedIndex: index })
  const feedback = importError
    ? importError.map(({ name, error }) => t("importError", { name, error: errorMessage(error) })).join(" ")
    : message && t(message.key, message.values)

  return <div className="app-shell">
    <Header t={t} language={language} setLanguage={setLanguage}
      onExport={exportFile} onFile={importFile} reading={reading} />
    <div className="review-layout">
      <ReviewList t={t} projects={projects} activeId={activeId} onProject={selectProject}
        rows={shown} selected={selected} onSelect={selectEntry} drafts={drafts}
        activeTarget={activeTarget} search={search} setSearch={(search) => updateProject({ search })}
        filter={filter} setFilter={(filter) => updateProject({ filter })} searchInput={searchInput}
        total={rows.length} message={feedback} />
      <main className="review-main" key={activeId}>
        {selected && <h2 className="entry-title">{selected.entry.context || selected.entry.id || selected.entry.source}</h2>}
        <LanguageControls t={t} language={language} workspace={workspace} activeTarget={activeTarget}
          languageName={languageName} onTarget={(tag) => updateProject({ activeTarget: tag })}
          onSourceEdit={() => setDialog({ kind: "source", value: workspace.sourceLocale, title: t("changeSource") })}
          onTargetEdit={() => setDialog({ kind: "target", value: "", title: t(targetAction) })} />
        <div id="translation-panel" role="tabpanel" aria-labelledby={"target-tab-" + targetIndex}>
          {selected ? <ReviewEditor t={t} row={selected} tag={activeTarget}
            sourceLocale={workspace.sourceLocale} languageName={languageName} draft={selectedDraft}
            onDraft={(text) => updateProject((project) => ({
              drafts: updateDraft(project.drafts, { index: selected.index, tag: activeTarget, text }, selected.text),
            }))}
            onSave={saveSelected} previous={shown[selectedPosition - 1]} next={shown[selectedPosition + 1]}
            onSelect={selectEntry} />
            : <div className="empty-state">
              <h2>{t("emptyTitle")}</h2>
              <p>{t("emptyForTarget", { language: languageName(activeTarget) })}</p>
              <button type="button" className="button" onClick={clearFilters}>{t("clearFilters")}</button>
            </div>}
        </div>
      </main>
    </div>
    {dialog && <LocaleDialog t={t} dialog={dialog} onClose={() => setDialog(null)}
      onChange={(event) => setDialog({ ...dialog, value: event.target.value, error: undefined })} onSave={saveLocale} />}
  </div>
}

createRoot(document.getElementById("root")).render(<App />)
