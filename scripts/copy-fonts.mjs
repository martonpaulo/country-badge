// Writes fonts/ from the Fontsource packages in devDependencies.
//
//   npm run fonts
//
// The woff2 files under fonts/ are committed — this site has no build step and
// GitHub Pages serves the repository as it stands — but they are the output of
// this script, not hand-placed assets. To change a face or a weight, change the
// list below and run it again; never edit or drop a file in fonts/ by hand.
// `npm install` runs this through `prepare`, so an updated package updates the
// site. Licences travel with the files, from the same packages.

import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODULES = join(ROOT, "node_modules", "@fontsource");
const OUT = join(ROOT, "fonts");

// The three faces the typography standard ships, latin subset only:
// skill-deck/docs/typography-standard.md. No monospace webfont, ever.
const FILES = [
  ["gabarito", "files/gabarito-latin-700-normal.woff2"],
  ["figtree", "files/figtree-latin-400-normal.woff2"],
  ["figtree", "files/figtree-latin-600-normal.woff2"],
  ["gabarito", "LICENSE"],
  ["figtree", "LICENSE"],
];

// The OFL text of a family, named for the family it licenses: two files called
// LICENSE in one folder would overwrite each other.
const nameOf = (pkg, file) =>
  file === "LICENSE"
    ? `${pkg[0].toUpperCase()}${pkg.slice(1)}-OFL.txt`
    : file.slice(file.lastIndexOf("/") + 1);

await mkdir(OUT, { recursive: true });

for (const [pkg, file] of FILES) {
  const name = nameOf(pkg, file);

  await copyFile(join(MODULES, pkg, file), join(OUT, name));

  console.log(`fonts/${name}`);
}
