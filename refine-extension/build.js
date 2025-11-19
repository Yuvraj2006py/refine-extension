import { build, context } from "esbuild";
import path from "path";
import { config as loadEnv } from "dotenv";

const entryPoints = [
  "src/background/background.ts",
  "src/content/contentScript.ts",
  "src/content/overlay.ts",
  "src/popup/popup.ts"
];

const envPath = path.resolve(".env");
loadEnv({ path: envPath });

const REFINE_ENV = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  OPENAI_MODEL: process.env.OPENAI_MODEL ?? "gpt-5-nano"
};

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
  logLevel: "info",
  banner: {
    js: `globalThis.REFINE_ENV = Object.assign({}, globalThis.REFINE_ENV, ${JSON.stringify(
      REFINE_ENV
    )});`
  }
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
