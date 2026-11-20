const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const API_KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const PUBLIC = new Set(["/index.html", "/css/style.css", "/js/app.js", "/js/dados.js"]);

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function lerCorpo(req, limite = 200000) {
  return new Promise((resolve, reject) => {
    let dados = "";
    req.on("data", (c) => {
      dados += c;
      if (dados.length > limite) {
        reject(new Error("Corpo muito grande"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(dados));
    req.on("error", reject);
  });
}

async function classificar(req, res) {
  if (!API_KEY) return json(res, 503, { error: "ANTHROPIC_API_KEY não configurada" });
  try {
    const { prompt } = JSON.parse(await lerCorpo(req));
    if (typeof prompt !== "string" || !prompt) return json(res, 400, { error: "prompt ausente" });
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const dados = await r.json();
    if (!r.ok) return json(res, 502, { error: dados.error?.message || "Erro na API" });
    const texto = (dados.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const inicio = texto.indexOf("{");
    const fim = texto.lastIndexOf("}");
    if (inicio < 0 || fim < inicio) return json(res, 502, { error: "Resposta sem JSON" });
    json(res, 200, JSON.parse(texto.slice(inicio, fim + 1)));
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}

function estatico(req, res) {
  let rota = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (rota === "/") rota = "/index.html";
  if (!PUBLIC.has(rota)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Não encontrado");
  }
  const arquivo = path.join(ROOT, rota);
  fs.readFile(arquivo, (err, conteudo) => {
    if (err) {
      res.writeHead(500);
      return res.end();
    }
    res.writeHead(200, {
      "Content-Type": TIPOS[path.extname(arquivo)] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(conteudo);
  });
}

http
  .createServer((req, res) => {
    if (req.method === "POST" && req.url === "/api/classificar") return classificar(req, res);
    if (req.method === "GET" || req.method === "HEAD") return estatico(req, res);
    res.writeHead(405);
    res.end();
  })
  .listen(PORT, () => {
    console.log(`Radar Contábil rodando em http://localhost:${PORT}`);
    console.log(API_KEY ? `IA ativa (${MODEL})` : "IA desativada: usando palavras-chave (defina ANTHROPIC_API_KEY no .env)");
  });
