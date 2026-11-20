const http = require("http");
const fs = require("fs");
const path = require("path");
const { coletar } = require("./fontes");
const ia = require("./ia");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const PUBLIC = new Set(["/index.html", "/css/style.css", "/js/app.js", "/js/dados.js", "/favicon.svg"]);

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml"
};

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function lerCorpo(req, limite = 10000) {
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

const briefing = { chave: "", status: "ocioso", dados: null, erro: "" };

function chaveDe(noticias) {
  return noticias.map((n) => n.t).join("|");
}

function gerarBriefing(noticias) {
  const chave = chaveDe(noticias);
  if (briefing.chave === chave && briefing.status !== "erro") return;
  briefing.chave = chave;
  briefing.status = "gerando";
  briefing.erro = "";
  ia.gerarBriefing(noticias)
    .then((dados) => {
      if (briefing.chave !== chave) return;
      briefing.dados = dados;
      briefing.status = "pronto";
      console.log(`Briefing gerado (${dados.itens.length} itens, ${dados.modelo})`);
    })
    .catch((e) => {
      if (briefing.chave !== chave) return;
      briefing.status = "erro";
      briefing.erro = e.message;
      console.error("Falha no briefing:", e.message);
    });
}

async function rotaNoticias(req, res) {
  const forcar = new URL(req.url, "http://x").searchParams.has("atualizar");
  const dados = await coletar(forcar);
  if (ia.disponivel() && dados.noticias.length) gerarBriefing(dados.noticias);
  json(res, 200, dados);
}

async function rotaBriefing(req, res) {
  if (!ia.disponivel()) return json(res, 200, { status: "indisponivel" });
  const dados = await coletar();
  if (dados.noticias.length) gerarBriefing(dados.noticias);
  if (briefing.status === "erro") {
    const erro = briefing.erro;
    if (new URL(req.url, "http://x").searchParams.has("tentar")) {
      briefing.chave = "";
      gerarBriefing(dados.noticias);
    }
    return json(res, 200, { status: "erro", erro });
  }
  json(res, 200, { status: briefing.status, briefing: briefing.dados });
}

const limites = new Map();

function permitido(ip) {
  const agora = Date.now();
  const janela = (limites.get(ip) || []).filter((t) => agora - t < 10 * 60 * 1000);
  if (janela.length >= 20) return false;
  janela.push(agora);
  limites.set(ip, janela);
  return true;
}

async function rotaPerguntar(req, res) {
  if (!ia.disponivel()) return json(res, 503, { error: "IA não configurada no servidor" });
  if (!permitido(req.socket.remoteAddress)) return json(res, 429, { error: "Muitas perguntas seguidas. Aguarde alguns minutos." });
  let pergunta;
  try {
    pergunta = String(JSON.parse(await lerCorpo(req)).pergunta || "").trim();
  } catch {
    return json(res, 400, { error: "Pedido inválido" });
  }
  if (pergunta.length < 3) return json(res, 400, { error: "Escreva uma pergunta" });
  if (pergunta.length > 500) return json(res, 400, { error: "Pergunta muito longa (máx. 500 caracteres)" });
  const { noticias } = await coletar();
  const r = await ia.responder(pergunta, noticias);
  const porId = new Map(noticias.map((n) => [n.id, n]));
  const fontes = r.citados.filter((id) => porId.has(id)).map((id) => ({ id, t: porId.get(id).t, u: porId.get(id).u, s: porId.get(id).s }));
  json(res, 200, { resposta: r.resposta, fontes });
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
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(arquivo)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(conteudo);
  });
}

const rotas = {
  "GET /api/status": (req, res) => json(res, 200, { ia: ia.disponivel(), modelo: ia.disponivel() ? ia.MODELO : null }),
  "GET /api/noticias": rotaNoticias,
  "GET /api/briefing": rotaBriefing,
  "POST /api/perguntar": rotaPerguntar
};

http
  .createServer(async (req, res) => {
    const rota = rotas[req.method + " " + new URL(req.url, "http://x").pathname];
    try {
      if (rota) return await rota(req, res);
      if (req.method === "GET" || req.method === "HEAD") return estatico(req, res);
      res.writeHead(405);
      res.end();
    } catch (e) {
      console.error(e);
      if (!res.headersSent) json(res, 500, { error: e.message });
    }
  })
  .listen(PORT, () => {
    console.log(`Thoth News rodando em http://localhost:${PORT}`);
    console.log(ia.disponivel() ? `IA ativa (${ia.MODELO})` : "IA desativada: defina ANTHROPIC_API_KEY no arquivo .env");
  });
