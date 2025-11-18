import { build, context } from "esbuild";
import path from "path";

const entryPoints = [
  "src/background/background.ts",
  "src/content/contentScript.ts",
  "src/content/overlay.ts",
  "src/popup/popup.ts"
];

const buildOptions = {
  bundle: true,
  format: "esm",
  minify: true,
  platform: "browser",
  target: "es2020",
  entryPoints,
  outbase: "src",
  outdir: "dist",
  sourcemap: false,
  logLevel: "info"
};

async function run() {
  const watchMode = process.argv.includes("--watch");

  if (watchMode) {
    const ctx = await context(buildOptions);
    await ctx.watch();
    console.log("Refine build: watching for changes...");
  } else {
    await build(buildOptions);
    console.log("Refine build: completed bundling.");
  }
}

run().catch((error) => {
  console.error("Refine build failed", error);
  process.exit(1);
});
