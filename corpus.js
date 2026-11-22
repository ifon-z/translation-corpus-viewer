const Corpus = (() => {
  const fields = ["id", "context", "source", "target"]
  const placeholders = /\$?\{[A-Za-z_][\w.-]*\}|%[A-Za-z_]\w*%|%(?:\d+\$)?[sdif]/g
  const tags = /\[\/?[A-Za-z][\w-]*(?:=[^\]\r\n]*)?\]|<\/?[A-Za-z][\w-]*(?:\s[^<>]*)?\/?>/g

  function normalize(row, location) {
    if (!row || typeof row.source !== "string" || !row.source.trim()) {
      throw new Error(location + "缺少有效的 source 原文")
    }
    if (row.id != null && typeof row.id !== "string" && !Number.isFinite(row.id)) {
      throw new Error(location + "的 id 必须是字符串或数字")
    }
    for (const field of ["context", "target"]) {
      if (row[field] != null && typeof row[field] !== "string") {
        throw new Error(location + "的 " + field + " 必须是字符串")
      }
    }
    return {
      id: String(row.id ?? ""),
      context: row.context ?? "",
      source: row.source,
      target: row.target ?? "",
    }
  }

  function parseJsonl(text) {
    const rows = []
    for (const [index, line] of text.split(/\r\n|\n|\r/).entries()) {
      if (!line.trim()) continue
      const location = "第 " + (index + 1) + " 行"
      let row
      try {
        row = JSON.parse(line)
      } catch {
        throw new Error(location + "不是有效的 JSON")
      }
      rows.push(normalize(row, location))
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
      if (!match) throw new Error("CSV 第 " + (records.length + 1) + " 条记录格式错误")
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
    if (!headers.includes("source") || new Set(headers).size !== headers.length) {
      throw new Error("CSV 列名需要包含 source，且不能重复")
    }
    return records.slice(1).map((cells, index) => {
      const location = "CSV 第 " + (index + 2) + " 条记录"
      if (cells.length !== headers.length) throw new Error(location + "的列数不符")
      const row = Object.fromEntries(fields.map((field) => [field, cells[headers.indexOf(field)]]))
      return normalize(row, location)
    })
  }

  function parse(input, filename) {
    const text = input.replace(/^\uFEFF/, "")
    const rows = filename.toLowerCase().endsWith(".csv") ? parseCsv(text) : parseJsonl(text)
    if (!rows.length) throw new Error("文件中没有词条")
    return rows
  }

  function csvCell(value) {
    const text = /^[\u0000-\u0020]*[=+\-@]/.test(value) ? "'" + value : value
    return '"' + text.replace(/"/g, '""') + '"'
  }

  function serialize(rows, format) {
    if (format === "jsonl") return rows.map((row) => JSON.stringify(row)).join("\n") + "\n"
    const records = rows.map((row) => fields.map((field) => csvCell(row[field])).join(","))
    return "\uFEFF" + [fields.join(","), ...records].join("\r\n") + "\r\n"
  }

  function placeholderSignature(text) {
    const tokens = text.match(placeholders) ?? []
    const unnumbered = tokens.filter((token) => /^%[sdif]$/.test(token))
    return JSON.stringify([tokens.sort(), unnumbered])
  }

  function issues({ source, target }) {
    if (!target.trim()) return ["译文为空"]
    const result = []
    if (placeholderSignature(source) !== placeholderSignature(target)) result.push("占位符不一致")
    if (JSON.stringify(source.match(tags)) !== JSON.stringify(target.match(tags))) {
      result.push("标记不一致")
    }
    return result
  }

  return { parse, serialize, issues }
})()

if (typeof module === "object") module.exports = Corpus
