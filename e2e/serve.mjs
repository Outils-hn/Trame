// Petit serveur statique avec repli SPA (comme GitHub Pages + 404.html), pour auditer la version de production.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const [,, dossier = ".output/public", port = "8080", base = "/"] = process.argv;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".webmanifest": "application/manifest+json" };
http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split("?")[0]);
  if (base !== "/" && u.startsWith(base)) u = "/" + u.slice(base.length);
  let f = path.join(dossier, u);
  if (!f.startsWith(path.resolve(dossier)) && !path.resolve(f).startsWith(path.resolve(dossier))) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f)) { f = path.join(dossier, "404.html"); res.statusCode = 200; }
  res.setHeader("content-type", types[path.extname(f)] || "application/octet-stream");
  fs.createReadStream(f).pipe(res);
}).listen(Number(port), "127.0.0.1");
