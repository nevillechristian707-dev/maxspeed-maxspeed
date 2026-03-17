import { execSync } from "child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync, readdirSync, statSync } from "fs";
import { resolve, dirname, relative } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cwd = process.cwd();

console.log("[vercel-build] cwd:", cwd);
console.log("[vercel-build] workspace root:", root);

// 1. Build API server (esbuild → artifacts/api-server/dist/index.js)
console.log("Building API server...");
execSync("pnpm --filter @workspace/api-server build", {
  cwd: root,
  stdio: "inherit",
});

// 2. Build frontend (Vite → artifacts/racing-shop/dist/public/)
console.log("Building frontend...");
execSync("pnpm --filter @workspace/racing-shop build", {
  cwd: root,
  stdio: "inherit",
});

// 3. Create Build Output API structure at cwd (= Root Directory on Vercel)
console.log("Creating Build Output API structure...");
const out = resolve(cwd, ".vercel", "output");
rmSync(out, { recursive: true, force: true });

// Static files (frontend)
const staticDir = resolve(out, "static");
mkdirSync(staticDir, { recursive: true });
cpSync(
  resolve(root, "artifacts", "racing-shop", "dist", "public"),
  staticDir,
  { recursive: true },
);

// Serverless function (catch-all for /api/*)
const funcDir = resolve(out, "functions", "api", "[...path].func");
mkdirSync(funcDir, { recursive: true });
cpSync(
  resolve(root, "artifacts", "api-server", "dist", "index.js"),
  resolve(funcDir, "index.mjs"),
);
writeFileSync(
  resolve(funcDir, ".vc-config.json"),
  JSON.stringify({
    runtime: "nodejs20.x",
    handler: "index.mjs",
    launcherType: "Nodejs",
  }),
);

// Routing config
writeFileSync(
  resolve(out, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: "filesystem" },
        { src: "/(.*)", dest: "/index.html", status: 200 },
      ],
    },
    null,
    2,
  ),
);

// Debug: list all files in output directory
function listFiles(dir, prefix = "") {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(full).isDirectory()) {
      listFiles(full, rel);
    } else {
      console.log(`  ${rel} (${statSync(full).size} bytes)`);
    }
  }
}
console.log("Build Output API structure created at:", out);
listFiles(out);
