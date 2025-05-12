const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: ["extension/src/content.js", "extension/popup/popup.js"],
    bundle: true,
    outdir: "extension/dist",
    format: "iife",
    sourcemap: false,
    target: ["chrome58"],
  })
  .catch(() => process.exit(1));
