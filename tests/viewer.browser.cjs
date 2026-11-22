const assert = require("node:assert/strict")
const { copyFileSync, mkdtempSync, readdirSync, rmSync, rmdirSync } = require("node:fs")
const { tmpdir } = require("node:os")
const { join, resolve } = require("node:path")
const { pathToFileURL } = require("node:url")
const { chromium } = require("playwright-core")
const Corpus = require("../corpus.js")

async function exportFile(page, label) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: label, exact: true }).click(),
  ])
  const chunks = []
  for await (const chunk of await download.createReadStream()) chunks.push(chunk)
  return Buffer.concat(chunks).toString("utf8")
}

async function verify() {
  const isolated = mkdtempSync(join(tmpdir(), "standalone-corpus-"))
  const html = join(isolated, "index.html")
  let browser
  try {
    copyFileSync(resolve(__dirname, "../index.html"), html)
    assert.deepEqual(readdirSync(isolated), ["index.html"])
    browser = await chromium.launch(process.env.BROWSER_PATH
      ? { executablePath: process.env.BROWSER_PATH } : { channel: "msedge" })
    const context = await browser.newContext({ acceptDownloads: true, offline: true,
      viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    const requests = []
    const errors = []
    page.setDefaultTimeout(7000)
    page.on("request", (request) => { if (/^https?:/.test(request.url())) requests.push(request.url()) })
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(pathToFileURL(html).href)
    await page.getByRole("heading", { name: "Translation Workspace" }).waitFor()
    await page.getByRole("button", { name: /Multilingual field guide/ }).click()
    await page.getByText("Showing 3 of 3", { exact: true }).waitFor()
    const toEnglish = page.getByRole("tab", { name: /^English/ })
    await toEnglish.focus()
    await toEnglish.press("ArrowRight")
    const toChinese = page.getByRole("tab", { name: /^Chinese/ })
    assert.equal(await toChinese.getAttribute("aria-selected"), "true")
    assert.equal(await toChinese.evaluate((element) => element === document.activeElement), true)
    await toChinese.press("End")
    const toArabic = page.getByRole("tab", { name: /^Arabic/ })
    assert.equal(await toArabic.getAttribute("aria-selected"), "true")
    assert.equal(await page.getByRole("tabpanel").getAttribute("aria-labelledby"), await toArabic.getAttribute("id"))
    const rtl = page.getByText("ضع البوصلة في الحافظة القماشية.", { exact: true })
    assert.equal(await rtl.getAttribute("lang"), "ar")
    assert.equal(await rtl.evaluate((element) => getComputedStyle(element).direction), "rtl")

    await page.getByRole("searchbox", { name: "Search" }).fill("Look for the mist gate")
    await page.getByRole("heading", { name: "No matching entries" }).waitFor()
    await page.getByText("No entries match the current filters for Arabic.").waitFor()
    await page.getByRole("button", { name: "简体中文", exact: true }).click()
    await page.getByRole("heading", { name: "翻译工作台" }).waitFor()
    assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN")
    assert.equal(await page.getByRole("searchbox", { name: "搜索" }).inputValue(), "Look for the mist gate")
    assert.equal(await page.getByRole("tab", { name: /^阿拉伯语/ }).getAttribute("aria-selected"), "true")
    assert.equal(await page.getByRole("button", { name: "简体中文", exact: true }).getAttribute("aria-pressed"), "true")
    await page.getByRole("button", { name: "清除搜索和筛选" }).click()
    await page.getByText("显示 3 / 3 条").waitFor()
    assert.equal(await page.getByRole("searchbox", { name: "搜索" }).evaluate((element) => element === document.activeElement), true)

    await page.getByRole("row").filter({ hasText: "guide-demo-02" }).getByRole("button", { name: "编辑译文" }).click()
    const arabic = "ابحث عن بوابة الضباب."
    await page.getByRole("dialog").getByLabel("译文", { exact: true }).fill(arabic)
    await page.getByRole("button", { name: "保存译文" }).click()
    await page.getByText(arabic, { exact: true }).waitFor()
    await page.getByRole("button", { name: "添加目标语言" }).click()
    await page.getByLabel("语言标签", { exact: true }).fill("DE-de")
    await page.getByRole("button", { name: "保存语言" }).click()
    assert.equal(await page.getByRole("tab", { name: /^德语/ }).getAttribute("aria-selected"), "true")
    const json = Corpus.parse(await exportFile(page, "导出 JSONL"), "output.jsonl")
    const csv = Corpus.parse(await exportFile(page, "导出 CSV"), "output.csv")
    assert.deepEqual(csv, json)
    assert.deepEqual(json[1].translations, {
      en: "Look for the mist gate.", "zh-CN": "寻找迷雾之门。", ar: arabic, "de-DE": "",
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole("tab", { selected: true }).press("Home")
    assert.equal(await page.getByRole("tab", { name: /^英语/ }).getAttribute("aria-selected"), "true")
    await page.getByRole("tab", { selected: true }).press("End")
    const tabLayout = await page.getByRole("tab", { selected: true }).evaluate((tab) => {
      const active = tab.getBoundingClientRect()
      const strip = tab.parentElement.getBoundingClientRect()
      return { widthFits: document.documentElement.scrollWidth === window.innerWidth,
        visible: active.left >= strip.left - 1 && active.right <= strip.right + 1 }
    })
    assert.deepEqual(tabLayout, { widthFits: true, visible: true })
    await page.getByRole("button", { name: "English", exact: true }).click()
    await page.getByRole("button", { name: /Application UI copy/ }).click()
    await page.getByRole("button", { name: "Name target language" }).click()
    await page.getByLabel("Language tag", { exact: true }).fill("zh-CN")
    await page.getByRole("button", { name: "Save language" }).click()
    await page.getByText("打开已保存的草稿", { exact: true }).waitFor()
    await page.getByRole("button", { name: /Change source language/ }).click()
    await page.getByLabel("Language tag", { exact: true }).fill("en")
    await page.getByRole("button", { name: "Save language" }).click()
    const legacy = Corpus.parse(await exportFile(page, "Export JSONL"), "legacy.jsonl")
    assert.equal(legacy[0].source_locale, "en")
    assert.equal(legacy[0].translations["zh-CN"], "打开已保存的草稿")

    await page.evaluate(() => {
      const read = File.prototype.text
      File.prototype.text = async function () {
        const text = await read.call(this)
        return new Promise((resolve) => { window.finishTestImport = () => resolve(text) })
      }
    })
    await page.getByLabel("Import JSONL or CSV").setInputFiles({
      name: "slow.jsonl", mimeType: "application/x-ndjson",
      buffer: Buffer.from('{"source_locale":"fr","source":"Fictional draft","target":"Draft"}'),
    })
    await page.waitForFunction(() => typeof window.finishTestImport === "function")
    await page.getByRole("row").filter({ hasText: "ui-demo-01" }).getByRole("button", { name: "Edit translation" }).click()
    await page.getByRole("dialog").getByLabel("Translation", { exact: true }).fill("打开草稿")
    await page.evaluate(() => window.finishTestImport())
    await page.waitForFunction(() => !document.getElementById("import").disabled)
    await page.getByRole("button", { name: "Save translation" }).click()
    const edited = Corpus.parse(await exportFile(page, "Export JSONL"), "edit.jsonl")
    assert.equal(edited[0].source_locale, "en")
    assert.equal(edited[0].translations["zh-CN"], "打开草稿")

    await page.getByRole("button", { name: "Add target language" }).click()
    await page.getByLabel("Language tag", { exact: true }).fill("en-US-u-ca-gregory")
    await page.getByRole("button", { name: "Save language" }).click()
    const extended = page.getByRole("tab", { name: /en-US-u-ca-gregory/ })
    assert.equal(await extended.getAttribute("aria-selected"), "true")
    const extendedExport = Corpus.parse(await exportFile(page, "Export JSONL"), "extended.jsonl")
    assert.equal(extendedExport[0].translations["en-US-u-ca-gregory"], "")
    assert.deepEqual(errors, [])
    assert.deepEqual(requests, [])
    if (process.env.VIEWER_SCREENSHOT) {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.getByRole("button", { name: /Multilingual field guide/ }).click()
      await page.getByRole("tab", { name: /^Arabic/ }).click()
      await page.screenshot({ path: process.env.VIEWER_SCREENSHOT, fullPage: true })
    }
    console.log("Checked the standalone HTML in offline Edge: keyboard tabs, bilingual state, mobile scrolling, editing, JSONL/CSV exports, and delayed import.")
  } finally {
    await browser?.close()
    rmSync(html, { force: true })
    rmdirSync(isolated)
  }
}

verify().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
