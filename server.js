const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname);
const port = Number(process.env.PORT || 8000);
const host = "127.0.0.1";
const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
]);

function cleanFilename(name) {
  const cleaned = String(name || "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/\.+$/g, "");
  if (!cleaned) return "";
  return cleaned.toLowerCase().endsWith(".md") ? cleaned : cleaned + ".md";
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function handleSave(request, response) {
  try {
    const body = JSON.parse(await readBody(request));
    const filename = cleanFilename(body.filename);
    const markdown = String(body.markdown || "");
    if (!filename || !markdown) {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "Filename and markdown are required." }));
      return;
    }

    const filePath = path.resolve(root, filename);
    if (path.dirname(filePath) !== root) {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "Invalid filename." }));
      return;
    }

    await fs.writeFile(filePath, markdown, "utf8");
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ filename }));
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Could not save records." }));
  }
}

async function handleStatic(request, response) {
  try {
    const url = new URL(request.url || "/", "http://localhost");
    const requested = url.pathname === "/" ? "/index.html" : url.pathname;
    const normalized = path.normalize(decodeURIComponent(requested)).replace(/^[/\\]+/, "");
    const filePath = path.resolve(root, normalized);

    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const data = await fs.readFile(filePath);
    response.writeHead(200, { "Content-Type": mime.get(path.extname(filePath)) || "application/octet-stream" });
    response.end(data);
  } catch (error) {
    response.writeHead(404);
    response.end("Not found");
  }
}

const server = http.createServer((request, response) => {
  if (request.method === "POST" && request.url === "/save-records") {
    handleSave(request, response);
    return;
  }
  handleStatic(request, response);
});

server.listen(port, host, () => {
  console.log(`Reaction game running at http://${host}:${port}/index.html`);
});
