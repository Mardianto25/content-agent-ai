import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { handleAgentRequest } from "./api/agent.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicRoot = resolve(root, "public");
const toolsRoot = resolve(root, "tools");
const generatedRoot = resolve(root, "generated");
const port = Number(process.env.PORT) || 3000;
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

try {
  process.loadEnvFile?.();
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const server = createServer(async (request, response) => {
  let pathname;
  try {
    pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  } catch {
    response.writeHead(400);
    response.end("Bad Request");
    return;
  }

  if (pathname.startsWith("/api/")) {
    await handleAgentRequest(request, response);
    return;
  }

  let baseDir = publicRoot;
  let relativePath = pathname === "/" ? "/index.html" : pathname;
  let contentType = contentTypes[extname(relativePath)] || "application/octet-stream";

  if (pathname.startsWith("/tools/")) {
    baseDir = toolsRoot;
    relativePath = pathname.slice("/tools".length);
  } else if (pathname.startsWith("/generated/")) {
    baseDir = generatedRoot;
    relativePath = pathname.slice("/generated".length);
    contentType = extname(relativePath) === ".mp4" ? "video/mp4" : contentType;
  }

  const filePath = resolve(baseDir, `.${relativePath}`);
  if (filePath !== baseDir && !filePath.startsWith(`${baseDir}${sep}`)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, { "Content-Type": contentType });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not Found");
  }
});

server.listen(port, () => {
  console.log(`Content Agent berjalan di http://localhost:${port}`);
});