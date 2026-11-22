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
  td.setAttribute("role", "cell")
  td.textContent = content
  if (className) td.className = className
  return td
}

function render() {
  const shown = entries.filter(visible)
  $("total").textContent = entries.length
  $("untranslated-count").textContent = entries.filter(({ row }) => !row.target.trim()).length
  $("issue-count").textContent = entries.filter(({ issues }) => issues.length > 0).length
  $("count").textContent = "显示 " + shown.length + " / " + entries.length + " 条"
  $("empty-title").textContent = "没有符合条件的词条"
  $("empty-help").textContent = "调整搜索内容或切换筛选条件。"
  $("empty").hidden = shown.length > 0
  $("table-scroll").hidden = shown.length === 0

  const body = document.createDocumentFragment()
  for (const entry of shown) {
    const { row, originalTarget, issues } = entry
    const tr = document.createElement("tr")
    tr.setAttribute("role", "row")
    const meta = [row.id, row.context].filter(Boolean).join("\n")
    const badge = document.createElement("span")
    badge.className = issues.length ? "badge issue" : "badge passed"
    badge.textContent = issues.join("\n") || "通过"
    const validation = cell("")
    validation.append(badge)
    const edit = document.createElement("button")
    edit.type = "button"
    edit.className = "button row-button"
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
      validation,
      actions,
    )
    body.append(tr)
  }
  $("rows").replaceChildren(body)
}

function loadCorpus(text, name) {
  const rows = Corpus.parse(text, name)
  if (pendingExport && !window.confirm("当前编辑尚未导出。要打开新文件吗？")) return
  entries = rows.map((row) => ({ row, originalTarget: row.target, issues: Corpus.issues(row) }))
  pendingExport = false
  filename = name.replace(/\.[^.]+$/, "")
  status.textContent = "已导入 " + name
  search.value = ""
  filter.value = "all"
  for (const control of [search, filter, $("jsonl"), $("csv")]) control.disabled = false
  render()
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0]
  if (!file) return
  fileInput.disabled = true
  try {
    if (!/\.(jsonl|csv)$/i.test(file.name)) throw new Error("请选择 JSONL 或 CSV 文件")
    loadCorpus(await file.text(), file.name)
  } catch (error) {
    status.textContent = "导入失败。 " + error.message
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
