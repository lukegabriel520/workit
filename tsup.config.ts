import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  minify: true,
  clean: true,
  target: "node18",
  shims: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
