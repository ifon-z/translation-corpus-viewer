const $ = (id) => document.getElementById(id)
const fileInput = $("import")
const search = $("search")
const filter = $("filter")
const status = $("status")
const editor = $("editor")
const target = $("edit-target")
let entries = []
let filename = "corpus"
let current
let pendingExport = false

function visible(entry) {
  const { row, originalTarget, issues } = entry
  const query = search.value.trim().toLowerCase()
  if (!Object.values(row).some((text) => text.toLowerCase().includes(query))) return false
  switch (filter.value) {
    case "issues": return issues.length > 0
    case "untranslated": return !row.target.trim()
    case "edited": return row.target !== originalTarget
    default: return true
  }
}

function cell(content, className) {
  const td = document.createElement("td")
  td.textContent = content
  if (className) td.className = className
  return td
}

function render() {
  const shown = entries.filter(visible)
  $("count").textContent = "显示 " + shown.length + " / " + entries.length + " 条"
  $("empty").textContent = "没有符合筛选条件的词条。"
  $("empty").hidden = shown.length > 0
  $("table-scroll").hidden = shown.length === 0

  const body = document.createDocumentFragment()
  for (const entry of shown) {
    const { row, originalTarget, issues } = entry
    const tr = document.createElement("tr")
    const meta = [row.id, row.context].filter(Boolean).join("\n")
    const note = issues.join("\n") || "通过"
    const edit = document.createElement("button")
    edit.type = "button"
    edit.textContent = "编辑译文"
    edit.addEventListener("click", () => {
      current = entry
      $("edit-source").textContent = row.source
      target.value = row.target
      editor.showModal()
    })
    const actions = cell("", "actions")
    actions.append(edit)
    tr.append(
      cell(meta || "—", "metadata"),
      cell(row.source),
      cell(row.target || "—", row.target !== originalTarget ? "edited" : ""),
      cell(note, issues.length ? "issue" : "passed"),
      actions,
    )
    body.append(tr)
  }
  $("rows").replaceChildren(body)
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0]
  if (!file) return
  fileInput.disabled = true
  try {
    if (!/\.(jsonl|csv)$/i.test(file.name)) throw new Error("请选择 JSONL 或 CSV 文件")
    const rows = Corpus.parse(await file.text(), file.name)
    if (pendingExport && !window.confirm("当前编辑尚未导出。要打开新文件吗？")) return
    entries = rows.map((row) => ({ row, originalTarget: row.target, issues: Corpus.issues(row) }))
    pendingExport = false
    filename = file.name.replace(/\.[^.]+$/, "")
    status.textContent = "已导入 " + file.name
    search.value = ""
    filter.value = "all"
    for (const control of [search, filter, $("jsonl"), $("csv")]) control.disabled = false
    render()
  } catch (error) {
    status.textContent = "导入失败。 " + error.message
  } finally {
    fileInput.value = ""
    fileInput.disabled = false
  }
})

search.addEventListener("input", render)
filter.addEventListener("change", render)
$("cancel").addEventListener("click", () => editor.close())
$("edit-form").addEventListener("submit", (event) => {
  event.preventDefault()
  if (current.row.target !== target.value) {
    current.row.target = target.value
    current.issues = Corpus.issues(current.row)
    pendingExport = true
    status.textContent = "译文已更新。导出文件以保留修改。"
    render()
  }
  editor.close()
})

for (const [format, type] of [["jsonl", "application/x-ndjson"], ["csv", "text/csv"]]) {
  $(format).addEventListener("click", () => {
    const content = Corpus.serialize(entries.map((entry) => entry.row), format)
    const url = URL.createObjectURL(new Blob([content], { type: type + ";charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = filename + "-edited." + format
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    pendingExport = false
    status.textContent = "已发起 " + format.toUpperCase() + " 下载。"
  })
}

window.addEventListener("beforeunload", (event) => {
  if (!pendingExport) return
  event.preventDefault()
  event.returnValue = ""
})
