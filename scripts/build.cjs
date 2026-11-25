const { readFileSync, writeFileSync } = require("node:fs")
const { createRequire } = require("node:module")
const { dirname, resolve } = require("node:path")
const { buildSync } = require("esbuild")

const project = resolve(__dirname, "..")
const read = (name) => readFileSync(resolve(project, name), "utf8").replace(/\r\n/g, "\n")

const react = require.resolve("react/package.json")
const reactDom = require.resolve("react-dom/package.json")
const scheduler = createRequire(reactDom).resolve("scheduler/package.json")
const licenses = [react, reactDom, scheduler].map((path) => {
  const { name, version } = require(path)
  const notice = read(resolve(dirname(path), "LICENSE")).trim()
  return name + " " + version + "\n" + notice
})

const examples = Object.fromEntries(
  ["app-ui-demo.csv", "bga-style-demo.jsonl", "multilingual-demo.jsonl"]
    .map((name) => [name, read("examples/" + name)]),
)

const { outputFiles } = buildSync({
  absWorkingDir: project,
  entryPoints: ["src/viewer.jsx"],
  bundle: true,
  write: false,
  format: "iife",
  jsx: "automatic",
  platform: "browser",
  target: "es2020",
  minify: true,
  legalComments: "inline",
  define: {
    "process.env.NODE_ENV": '"production"',
    __VIEWER_EXAMPLES__: JSON.stringify(examples),
  },
})

const script = ("/*! Bundled third-party notices\n\n" + licenses.join("\n\n") + "\n*/\n" + outputFiles[0].text)
  .replace(/<\/script/gi, "<\\/script")
const html = read("src/page.html")
  .replace("__VIEWER_STYLE__", () => "\n" + read("styles.css"))
  .replace("__VIEWER_SCRIPT__", () => "\n" + script)
const output = resolve(project, "index.html")

if (process.argv.includes("--check")) {
  if (read(output) !== html) {
    console.error("index.html is stale. Run pnpm build.")
    process.exitCode = 1
  }
} else {
  writeFileSync(output, html, "utf8")
}
