const esbuild = require("esbuild");
const globImport = require("esbuild-plugin-glob-import");
const { execSync } = require("child_process");

const isWatch = process.argv.includes("--watch");

const buildOptions = {
  entryPoints: {
    "content.bundle": "src/content.js",
    "popup.bundle": "popup/popup.js",
  },
  bundle: true,
  format: "esm",
  sourcemap: isWatch,
  target: ["chrome58"],
  outdir: "dist",
  entryNames: "[name]",
  plugins: [globImport.default()],
  supported: { "import-meta": true },
};

async function build() {
  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
  } else {
    await esbuild.build(buildOptions);
  }
}

build().catch(() => process.exit(1));

execSync(
  `npx postcss popup/styles/tailwind.css -o dist/popup.css${isWatch ? " --watch" : ""}`,
  { stdio: "inherit" },
);
