/* ===========================================================================
   The page's scripts share one global scope: classic scripts, so the page
   opens from file://. Two of them declaring the same top-level const, let
   or class stop the second from loading at all, and only in the browser:
   the logic tests skip the view files (tests/load-app.js), so nothing else
   here would notice.

   The engine is the judge. A clash is a SyntaxError raised before any of
   the later script runs, so every script index.html loads is run here, in
   order, in one shared context. A view script then fails as soon as it
   touches the page, which is expected and ignored; its declarations are
   made all the same, so the next script that repeats one is caught.
   ========================================================================= */

import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function pageScripts() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const listed = [...html.matchAll(/<script\s+src="(js\/[^"]+)"/g)].map(m => m[1]);
  // The sculpture's model is written in by a small inline script, before the regions.
  const model = (html.match(/MALE_BODY_SRC\s*=\s*"(js\/[^"]+)"/) || [])[1];
  const at = listed.indexOf("js/anatomy-regions.js");
  if (model) listed.splice(at < 0 ? listed.length : at, 0, model);
  return listed;
}

describe("the page's global scope", () => {
  test("every page script parses, and no two declare the same top-level name", () => {
    const quiet = () => {};
    const context = vm.createContext({ console: { log: quiet, warn: quiet, error: quiet, info: quiet } });
    const problems = [];
    for (const file of pageScripts()) {
      const code = fs.readFileSync(path.join(ROOT, file), "utf8");
      try {
        vm.runInContext(code, context, { filename: file });
      } catch (e) {
        if (e && e.name === "SyntaxError") problems.push(file + ": " + e.message);
      }
    }
    expect(problems).toEqual([]);
  });
});
