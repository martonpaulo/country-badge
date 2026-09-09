// The app must be served under the GitHub Pages repository subpath so relative asset and module
// URLs stay covered. Serving the checkout's parent directory would make that subpath depend on the
// checkout directory's own name, which breaks in a Git worktree. Instead, a temporary directory
// holds a symlink with the required name, and the port is chosen at run time so several checkouts
// can run the suite concurrently.
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const SITE_PATH_SEGMENT = "country-badge-generator";

const SERVE_ROOT_ENV = "CBG_SERVE_ROOT";
const SERVE_PORT_ENV = "CBG_SERVE_PORT";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

function createServeRoot() {
  const serveRoot = mkdtempSync(join(tmpdir(), "country-badge-generator-serve-"));
  symlinkSync(repositoryRoot, join(serveRoot, SITE_PATH_SEGMENT), "dir");
  return serveRoot;
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

// Playwright loads this configuration once per process, including every worker. The environment is
// inherited by workers, so the first resolution is reused instead of allocating another root/port.
export async function resolveServeTarget() {
  if (!process.env[SERVE_ROOT_ENV]) {
    process.env[SERVE_ROOT_ENV] = createServeRoot();
  }

  if (!process.env[SERVE_PORT_ENV]) {
    process.env[SERVE_PORT_ENV] = String(await findFreePort());
  }

  const serveRoot = process.env[SERVE_ROOT_ENV];
  const port = Number(process.env[SERVE_PORT_ENV]);

  return {
    serveRoot,
    port,
    command: `python3 -m http.server ${port} --directory "${serveRoot}"`,
    baseURL: `http://127.0.0.1:${port}/${SITE_PATH_SEGMENT}/`
  };
}

export function removeServeRoot() {
  const serveRoot = process.env[SERVE_ROOT_ENV];

  if (serveRoot) {
    rmSync(serveRoot, { recursive: true, force: true });
  }
}
