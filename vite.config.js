import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { promisify } from "node:util";

const gzip = promisify(zlib.gzip);
const brotliCompress = promisify(zlib.brotliCompress);

const COMPRESS_EXT =
  /\.(glb|gltf|js|mjs|cjs|css|html|json|svg|txt|xml|wasm|map)$/i;

const MIME = {
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".cjs": "text/javascript",
  ".css": "text/css",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".wasm": "application/wasm",
  ".map": "application/json",
};

function pickEncoding(accept) {
  const header = accept || "";
  if (/\bbr\b/.test(header)) {
    return "br";
  }
  if (/\bgzip\b/.test(header)) {
    return "gzip";
  }
  return null;
}

function isInside(root, file) {
  const rel = path.relative(root, file);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function staticEncoding() {
  const cache = new Map();
  const pending = new Map();

  async function compressFile(file, encoding, mtime) {
    const key = `${file}|${mtime}|${encoding}`;
    if (cache.has(key)) {
      return cache.get(key);
    }
    if (pending.has(key)) {
      return pending.get(key);
    }
    const job = (async () => {
      const raw = await fs.promises.readFile(file);
      const packed =
        encoding === "br"
          ? await brotliCompress(raw, {
              params: {
                [zlib.constants.BROTLI_PARAM_QUALITY]: 5,
                [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
              },
            })
          : await gzip(raw, { level: 6 });
      const result = packed.length < raw.length ? packed : null;
      cache.set(key, result);
      return result;
    })().finally(() => pending.delete(key));
    pending.set(key, job);
    return job;
  }

  function middleware(rootDir) {
    const root = path.resolve(rootDir);
    return async (req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        return next();
      }
      if (req.headers.range) {
        return next();
      }
      const encoding = pickEncoding(req.headers["accept-encoding"]);
      if (!encoding) {
        return next();
      }
      const urlPath = decodeURIComponent((req.url || "").split("?")[0]);
      if (!COMPRESS_EXT.test(urlPath)) {
        return next();
      }
      const file = path.resolve(root, urlPath.replace(/^\/+/, ""));
      if (!isInside(root, file)) {
        return next();
      }
      let stat;
      try {
        stat = await fs.promises.stat(file);
      } catch {
        return next();
      }
      if (!stat.isFile() || stat.size < 1024) {
        return next();
      }
      try {
        const body = await compressFile(file, encoding, stat.mtimeMs);
        if (!body) {
          return next();
        }
        const ext = path.extname(file).toLowerCase();
        res.setHeader(
          "Content-Type",
          MIME[ext] || "application/octet-stream"
        );
        res.setHeader("Content-Encoding", encoding);
        res.setHeader("Vary", "Accept-Encoding");
        res.setHeader("Content-Length", body.length);
        if (req.method === "HEAD") {
          return res.end();
        }
        res.end(body);
      } catch {
        next();
      }
    };
  }

  async function warmHuman(rootDir) {
    const dir = path.join(rootDir, "models", "human");
    let names;
    try {
      names = await fs.promises.readdir(dir);
    } catch {
      return;
    }
    await Promise.all(
      names
        .filter((name) => name.endsWith(".glb"))
        .map(async (name) => {
          const file = path.join(dir, name);
          const stat = await fs.promises.stat(file);
          await compressFile(file, "br", stat.mtimeMs);
        })
    );
  }

  return {
    name: "static-encoding",
    configureServer(server) {
      const dir = server.config.publicDir;
      if (!dir) {
        return;
      }
      server.middlewares.use(middleware(dir));
      warmHuman(dir).catch(() => {});
    },
    configurePreviewServer(server) {
      const dir = path.resolve(
        server.config.root,
        server.config.build.outDir
      );
      server.middlewares.use(middleware(dir));
    },
  };
}

export default defineConfig({
  plugins: [react(), staticEncoding()],
});
