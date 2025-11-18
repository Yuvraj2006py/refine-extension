import { rm } from "fs/promises";

async function clean() {
  await rm("dist", { recursive: true, force: true });
  console.log("Cleaned dist/");
}

clean().catch((error) => {
  console.error("Failed to clean dist", error);
  process.exit(1);
});
