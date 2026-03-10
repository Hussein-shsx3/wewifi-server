const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");

const copyDir = (source, target) => {
  if (!fs.existsSync(source)) {
    throw new Error(`Source not found: ${source}`);
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true, force: true });
};

const removeIfExists = (target) => {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
};

try {
  const publicSource = path.join(projectRoot, "src", "public");
  const viewsSource = path.join(projectRoot, "src", "views");
  const publicTarget = path.join(distDir, "public");
  const viewsTarget = path.join(distDir, "views");

  removeIfExists(publicTarget);
  removeIfExists(viewsTarget);

  copyDir(publicSource, publicTarget);
  copyDir(viewsSource, viewsTarget);

  console.log("Copied assets: src/public -> dist/public");
  console.log("Copied assets: src/views -> dist/views");
} catch (error) {
  console.error("Asset copy failed:", error.message);
  process.exit(1);
}
