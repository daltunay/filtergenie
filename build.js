const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: {
      "content.bundle": "extension/src/content.js",
      "popup.bundle": "extension/popup/popup.js",
    },
    bundle: true,
    format: "iife",
    sourcemap: false,
    target: ["chrome58"],
    outdir: "extension/dist",
    entryNames: "[name]",
  })
  .catch(() => process.exit(1));
