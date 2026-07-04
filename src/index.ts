import { readFileSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { createCli } from "./cli.js";

try {
  const pkg = JSON.parse(
    readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
  ) as { version: string };

  const cli = createCli();
  cli.version(pkg.version);
  cli.parse();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(pc.red(`Failed to start Workit: ${message}`));
  process.exit(1);
}
