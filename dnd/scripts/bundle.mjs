// bundle.mjs — inline styles.css and the four ES modules into one standalone
// HTML file, so the applet can be opened straight off disk (file://) or mailed
// to someone. There is no build step in normal use; this is a convenience.
//
//   node scripts/bundle.mjs [out.html] [--body-only]
//
// --body-only emits just the <style> + markup + <script>, for hosts that supply
// their own document skeleton.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const args = process.argv.slice(2);
const bodyOnly = args.includes("--body-only");
const out = resolve(process.cwd(), args.find((a) => !a.startsWith("--")) ?? resolve(root, "dist/dice-lab.html"));

// Concatenation order is the dependency order; each module is stripped of its
// relative imports and export keywords so the result is one flat module.
const MODULES = ["src/dice.js", "src/format.js", "src/chart.js", "src/app.js"];

const read = (p) => readFile(resolve(root, p), "utf8");

const flatten = (src) =>
  src
    .replace(/^import\s+[\s\S]*?from\s+"\.\/[^"]+";\s*$/gm, "")
    .replace(/^export\s+(?=(function|const|let|class))/gm, "")
    .trimStart();

const html = await read("index.html");
const css = await read("styles.css");
const js = (await Promise.all(MODULES.map(read))).map(flatten).join("\n");

const style = `<style>\n${css}\n</style>`;
const script = `<script type="module">\n${js}\n</script>`;

let body = html
  .replace(/\n\s*<link rel="stylesheet"[^>]*>/, "")
  .replace(/\n\s*<script type="module" src="[^"]*"><\/script>/, `\n    ${script}`)
  .replace("</head>", `  ${style}\n  </head>`);

if (bodyOnly) {
  const inner = body.slice(body.indexOf("<body>") + 6, body.lastIndexOf("</body>"));
  const head = body.slice(body.indexOf("<head>") + 6, body.indexOf("</head>"));
  const title = /<title>([\s\S]*?)<\/title>/.exec(head)?.[1] ?? "Dice Lab";
  body = `<title>${title}</title>\n${style}\n${inner.replace(script, script)}`;
}

await mkdir(dirname(out), { recursive: true });
await writeFile(out, body);
console.log(`wrote ${out} (${(body.length / 1024).toFixed(1)} kB)`);
