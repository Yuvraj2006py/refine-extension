import { promises as fs } from "fs";
import path from "path";

const SRC_DIR = path.resolve("src");
const DIST_DIR = path.resolve("dist");
const STATIC_EXTENSIONS = new Set([".html", ".css"]);

async function collectStaticFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return collectStaticFiles(fullPath);
      }
      if (STATIC_EXTENSIONS.has(path.extname(entry.name))) {
        return [fullPath];
      }
      return [];
    })
  );

  return files.flat();
}

async function copyStaticFiles() {
  const files = await collectStaticFiles(SRC_DIR);
  await Promise.all(
    files.map(async (file) => {
      const relativePath = path.relative(SRC_DIR, file);
      const destination = path.join(DIST_DIR, relativePath);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(file, destination);
      console.log(`Copied ${relativePath}`);
    })
  );
}

copyStaticFiles().catch((error) => {
  console.error("Static asset copy failed", error);
  process.exit(1);
});
