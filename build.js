const esbuild = require("esbuild");
const { execSync } = require("child_process");

const isWatchMode = process.argv.includes("--watch");

const buildOptions = {
  entryPoints: {
    "content.bundle": "extension/src/content.js",
    "popup.bundle": "extension/popup/popup.js",
  },
  bundle: true,
  format: "iife",
  sourcemap: isWatchMode,
  target: ["chrome58"],
  outdir: "extension/dist",
  entryNames: "[name]",
};

async function processTailwind(watch = false) {
  console.log("Processing Tailwind CSS...");
  try {
    const command = `npx postcss extension/popup/styles/tailwind.css -o extension/dist/popup.css${watch ? " --watch" : ""}`;
    if (watch) {
      require("child_process").spawn("sh", ["-c", command], {
        stdio: "inherit",
        detached: true,
      });
      console.log("✓ Tailwind CSS watch started");
    } else {
      execSync(command, { stdio: "inherit" });
      console.log("✓ Tailwind CSS processed successfully");
    }
  } catch (error) {
    console.error("✗ Error processing Tailwind CSS:", error.message);
    process.exit(1);
  }
}

async function buildJavaScript() {
  console.log("Building JavaScript bundles...");

  try {
    if (isWatchMode) {
      const context = await esbuild.context(buildOptions);
      await context.watch();
      console.log("✓ JavaScript watch started");

      process.on("SIGINT", async () => {
        await context.dispose();
        process.exit(0);
      });
    } else {
      await esbuild.build(buildOptions);
      console.log("✓ JavaScript bundles built successfully");
    }
  } catch (error) {
    console.error("✗ Build failed:", error);
    process.exit(1);
  }
}

async function build() {
  await processTailwind(isWatchMode);
  await buildJavaScript();

  if (isWatchMode) {
    console.log("\n👀 Watching for changes...");
  }
}

build();
