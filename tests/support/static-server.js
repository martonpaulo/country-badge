// The app is served from the repository root, exactly like the published site, on a port chosen
// at run time so several checkouts can run the suite concurrently.
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const SERVE_PORT_ENV = "CBG_SERVE_PORT";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

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
// inherited by workers, so the first resolution is reused instead of allocating another port.
export async function resolveServeTarget() {
  if (!process.env[SERVE_PORT_ENV]) {
    process.env[SERVE_PORT_ENV] = String(await findFreePort());
  }

  const port = Number(process.env[SERVE_PORT_ENV]);

  return {
    serveRoot: repositoryRoot,
    port,
    command: `python3 -m http.server ${port} --directory "${repositoryRoot}"`,
    baseURL: `http://127.0.0.1:${port}/`
  };
}
