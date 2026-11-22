const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")
const { resolve } = require("node:path")
const test = require("node:test")

test("the committed HTML contains its scripts and styles and mounts the viewer", () => {
  const page = readFileSync(resolve(__dirname, "../index.html"), "utf8")
  const markup = page.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, "$1</script>")
  assert.doesNotMatch(markup, /<script\b[^>]*\bsrc=|<link\b[^>]*rel="stylesheet"/i)
  assert.match(page, /<script>/)
  assert.match(page, /<style>/)
  assert.match(page, /id="root"/)
})
