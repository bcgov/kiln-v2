import http from "http";
import fs from "fs";
import path from "path";
import url from "url";

const port = Number(process.env.PORT) || 8080;
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const buildDir = path.join(__dirname, "build");
const clientPath = path.join(buildDir, "client");

// MIME types mapping
const mimeTypes = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

// Try to load SvelteKit's adapter-node handler at runtime (if built)
let svelteHandler = null;
const handlerPath = path.join(buildDir, "handler.js");
try {
  if (fs.existsSync(handlerPath)) {
    const mod = await import(url.pathToFileURL(handlerPath).href);
    svelteHandler = mod.handler;
  } else {
    console.warn(
      "SvelteKit handler not found at build/handler.js. Build with @sveltejs/adapter-node to enable SSR/endpoints."
    );
  }
} catch {
  console.error("Failed to load SvelteKit handler:", e);
}

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

  // Add CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // parse pathname robustly and decode it
  let pathname = "/";
  try {
    const parsed = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    pathname = decodeURIComponent(parsed.pathname || "/");
  } catch (e) {
    const parsedUrl = url.parse(req.url || "/");
    pathname = decodeURIComponent(parsedUrl.pathname || "/");
  }
  if (!pathname) pathname = "/";

  // Serve static assets from build/client
  if (pathname.match(/\.(js|css|png|jpg|gif|svg|ico|ttf|woff|woff2|map|json)$/)) {
    const relativePath = pathname.replace(/^\/+/, "");
    let filePath = path.join(clientPath, relativePath);

    // If file not found and the request is under /preview/, try again without the preview prefix
    if (!fs.existsSync(filePath) && pathname.startsWith("/preview/")) {
      const withoutPreview = relativePath.replace(/^preview\//, "");
      filePath = path.join(clientPath, withoutPreview);
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      const mimeType = mimeTypes[ext] || "application/octet-stream";

      res.setHeader("Content-Type", mimeType);
      res.setHeader("Cache-Control", "public, max-age=31536000");

      const fileStream = fs.createReadStream(filePath);
      fileStream.on("error", (err) => {
        console.error("Error serving file:", err);
        res.writeHead(500);
        res.end("Internal Server Error");
      });
      // stream file
      res.writeHead(200);
      fileStream.pipe(res);
      return;
    }
    // fall through to SvelteKit handler if not found
  }

  // Delegate all other requests (SSR pages and endpoints) to SvelteKit
  if (svelteHandler) {
    try {
      svelteHandler(req, res);
    } catch (err) {
      console.error("SvelteKit handler error:", err);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end("Internal Server Error");
      }
    }
  } else {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(
        "SvelteKit handler not found. Ensure you have @sveltejs/adapter-node configured and run the build.\n" +
          "Steps:\n" +
          "1) npm i -D @sveltejs/adapter-node\n" +
          "2) set adapter-node in svelte.config.js\n" +
          "3) npm run build"
      );
    }
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${port}/`);
  console.log(`Serving static from: ${clientPath}`);
});
