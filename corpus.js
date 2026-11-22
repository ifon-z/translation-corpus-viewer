const Corpus = (() => {
  const baseFields = ["id", "context", "source"]
  const placeholders = /\$?\{[A-Za-z_][\w.-]*\}|%[A-Za-z_]\w*%|%(?:\d+\$)?[sdif]/g
  const tags = /\[\/?[A-Za-z][\w-]*(?:=[^\]\r\n]*)?\]|<\/?[A-Za-z][\w-]*(?:\s[^<>]*)?\/?>/g

  function fail(code, details = {}) {
    throw Object.assign(new Error(code), { code, details })
  }

  function localeTag(value, details = {}) {
    if (typeof value === "string" && value.trim()) {
      try {
        return Intl.getCanonicalLocales(value.trim().replace(/_/g, "-"))[0]
      } catch {
        // Return a localizable error for invalid language tags.
      }
    }
    fail("invalidLanguage", details)
  }

  function normalize(row, details) {
    if (!row || typeof row.source !== "string" || !row.source.trim()) fail("invalidSource", details)
    if (row.id != null && typeof row.id !== "string" && !Number.isFinite(row.id)) {
      fail("invalidId", details)
    }
    for (const field of ["context", "target"]) {
      if (row[field] != null && typeof row[field] !== "string") fail("invalidText", { ...details, field })
    }
    const result = { id: String(row.id ?? ""), context: row.context ?? "", source: row.source }
    if (row.source_locale != null && !(typeof row.source_locale === "string" && !row.source_locale.trim())) {
      result.source_locale = localeTag(row.source_locale, details)
    }
    if (row.translations == null) return { ...result, target: row.target ?? "" }
    if (row.target != null) fail("mixedTargets", details)
    if (typeof row.translations !== "object" || Array.isArray(row.translations)) {
      fail("invalidTranslations", details)
    }
    const translations = new Map()
    for (const [name, value] of Object.entries(row.translations)) {
      const tag = localeTag(name, details)
      if (translations.has(tag)) fail("duplicateTarget", details)
      if (value != null && typeof value !== "string") fail("invalidText", { ...details, field: tag })
      translations.set(tag, value ?? "")
    }
    return { ...result, translations: Object.fromEntries(translations) }
  }

  function parseJsonl(text) {
    const rows = []
    for (const [index, line] of text.split(/\r\n|\n|\r/).entries()) {
      if (!line.trim()) continue
      const details = { position: index + 1, format: "jsonl" }
      let row
      try {
        row = JSON.parse(line)
      } catch {
        fail("invalidJson", details)
      }
      rows.push(normalize(row, details))
    }
    return rows
  }

  function parseCsv(text) {
    const cell = /(?:"((?:[^"]|"")*)"|([^",\r\n]*))(,|\r\n|\r|\n|$)/gy
    const records = []
    let row = []
    let position = 0
    while (position < text.length || row.length) {
      const match = cell.exec(text)
      if (!match) fail("invalidCsv", { position: records.length + 1, format: "csv" })
      const [, quoted, plain, separator] = match
      row.push(quoted == null ? plain : quoted.replace(/""/g, '"'))
      position = cell.lastIndex
      if (separator !== ",") {
        if (row.length > 1 || row[0] !== "" || quoted != null) records.push(row)
        row = []
      }
    }
    if (!records.length) return []
    const headers = records[0].map((field) => field.trim())
    if (!headers.includes("source") || new Set(headers).size !== headers.length) fail("invalidHeader")
    const targets = headers.map((field, index) => ({ field, index }))
      .filter(({ field }) => field.startsWith("target:"))
    const details = { position: 1, format: "csv" }
    const locales = targets.map(({ field }) => localeTag(field.slice("target:".length), details))
    if (new Set(locales).size !== locales.length) fail("duplicateTarget", details)
    if (locales.length && headers.includes("target")) fail("mixedTargets", details)
    return records.slice(1).map((cells, index) => {
      const details = { position: index + 2, format: "csv" }
      if (cells.length !== headers.length) fail("invalidColumnCount", details)
      const row = Object.fromEntries([...baseFields, "source_locale", "target"]
        .map((field) => [field, cells[headers.indexOf(field)]]))
      if (locales.length) {
        row.translations = Object.fromEntries(targets.map(({ index }, i) => [locales[i], cells[index]]))
      }
      return normalize(row, details)
    })
  }

  function parse(input, filename) {
    const text = input.replace(/^\uFEFF/, "")
    const rows = filename.toLowerCase().endsWith(".csv") ? parseCsv(text) : parseJsonl(text)
    if (!rows.length) fail("emptyFile")
    return rows
  }

  function namedTargets(rows) {
    return [...new Set(rows.flatMap((row) => Object.keys(row.translations ?? {})))]
  }

  function open(rows) {
    const sources = [...new Set(rows.map((row) => row.source_locale).filter(Boolean))]
    if (sources.length > 1) fail("mixedSources")
    const names = namedTargets(rows)
    if (names.length && rows.some((row) => row.target?.trim())) fail("mixedTargets")
    const targetLocales = names.length ? names : [""]
    const entries = rows.map(({ id, context, source, target, translations }) => {
      const values = new Map(targetLocales.map((name) => [name, name ? translations?.[name] ?? "" : target ?? ""]))
      return { id, context, source, translations: values, originalTranslations: new Map(values) }
    })
    return { sourceLocale: sources[0] ?? "", targetLocales, entries }
  }

  function addTarget(workspace, value) {
    const name = localeTag(value)
    if (workspace.targetLocales.includes(name)) return name
    if (workspace.targetLocales[0] === "") {
      workspace.targetLocales[0] = name
      for (const entry of workspace.entries) {
        for (const values of [entry.translations, entry.originalTranslations]) {
          values.set(name, values.get(""))
          values.delete("")
        }
      }
    } else {
      workspace.targetLocales.push(name)
    }
    return name
  }

  function toRows({ sourceLocale, targetLocales, entries }) {
    return entries.map(({ id, context, source, translations }) => {
      const record = { id, context, source }
      if (sourceLocale) record.source_locale = sourceLocale
      if (targetLocales[0] === "") return { ...record, target: translations.get("") ?? "" }
      return { ...record, translations: Object.fromEntries(
        targetLocales.map((name) => [name, translations.get(name) ?? ""]),
      ) }
    })
  }

  function csvCell(value) {
    const text = /^[\u0000-\u0020]*[=+\-@]/.test(value) ? "'" + value : value
    return '"' + text.replace(/"/g, '""') + '"'
  }

  function serialize(rows, format) {
    if (format === "jsonl") return rows.map((row) => JSON.stringify(row)).join("\n") + "\n"
    const locales = namedTargets(rows)
    const fields = rows.some((row) => row.source_locale) ? [...baseFields, "source_locale"] : baseFields
    const headers = [...fields, ...(locales.length ? locales.map((name) => "target:" + name) : ["target"])]
    const records = rows.map((row) => [
      ...fields.map((field) => row[field] ?? ""),
      ...(locales.length ? locales.map((name) => row.translations?.[name] ?? "") : [row.target ?? ""]),
    ].map(csvCell).join(","))
    return "\uFEFF" + [headers.join(","), ...records].join("\r\n") + "\r\n"
  }

  function placeholderSignature(text) {
    const tokens = text.match(placeholders) ?? []
    const unnumbered = tokens.filter((token) => /^%[sdif]$/.test(token))
    return JSON.stringify([tokens.sort(), unnumbered])
  }

  function issues({ source, target }) {
    if (!target.trim()) return ["missingTranslation"]
    const result = []
    if (placeholderSignature(source) !== placeholderSignature(target)) result.push("placeholderMismatch")
    if (JSON.stringify(source.match(tags)) !== JSON.stringify(target.match(tags))) result.push("markupMismatch")
    return result
  }

  return { parse, serialize, issues, open, addTarget, toRows, localeTag }
})()

if (typeof module === "object") module.exports = Corpus
