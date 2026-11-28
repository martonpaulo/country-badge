import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../support/serve.py", import.meta.url));
const siteRoot = fileURLToPath(new URL("../../site/", import.meta.url));

// The browser suite's server takes the burst of module requests several browsers send at
// once. With the default listen backlog of 5 the kernel reset some of them, and the page
// then stayed unusable, so the backlog is pinned and a burst must all be answered.
test("the suite's static server keeps a listen backlog that takes a burst of requests", async () => {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const server = spawn("python3", [script, String(port), siteRoot], {
    stdio: "ignore",
  });

  try {
    let up = false;
    for (let attempt = 0; attempt < 50 && !up; attempt += 1) {
      try {
        up = (await fetch(`http://127.0.0.1:${port}/robots.txt`)).ok;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    assert.ok(up, "the server answers");

    const answers = await Promise.all(
      Array.from({ length: 150 }, () =>
        fetch(`http://127.0.0.1:${port}/js/app.js`).then((r) => r.status),
      ),
    );

    assert.deepEqual(new Set(answers), new Set([200]));
  } finally {
    server.kill();
    await once(server, "close");
  }
});
