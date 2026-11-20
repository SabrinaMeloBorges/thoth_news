const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const TTL = 15 * 60 * 1000;
const MAX_POR_FONTE = 12;
const MAX_TOTAL = 60;

const google = (q) =>
  "https://news.google.com/rss/search?q=" + encodeURIComponent(q + " when:14d") + "&hl=pt-BR&gl=BR&ceid=BR:pt-419";

const FONTES = [
  { nome: "Google Notícias", url: google('"reforma tributária" alíquota OR senado'), k: "Alíquotas e política" },
  { nome: "Google Notícias", url: google("IBS CBS regulamentação OR \"lei complementar\""), k: "Regulamentação" },
  { nome: "Google Notícias", url: google("CBS IBS piloto OR \"split payment\" OR apuração"), k: "Transição e sistemas" },
  { nome: "Google Notícias", url: google('"simples nacional"'), k: "Simples Nacional" },
  { nome: "Google Notícias", url: google("CFC contabilidade NBC OR contador"), k: "Normas e profissão" },
  { nome: "Portal Contábeis", url: "https://www.contabeis.com.br/rss/noticias/", k: null },
  { nome: "Jornal Contábil", url: "https://www.jornalcontabil.com.br/feed/", k: null },
  { nome: "CFC", url: "https://cfc.org.br/feed/", k: "Normas e profissão" }
];

const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodificar(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n.toLowerCase()] ?? m);
}

function limpar(s) {
  if (!s) return "";
  s = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  s = decodificar(s);
  return decodificar(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function tag(item, nome) {
  const m = item.match(new RegExp("<" + nome + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + nome + ">", "i"));
  return m ? m[1] : "";
}

function resumir(texto, max = 220) {
  texto = texto.replace(/\s*(Continuar Lendo|Read more)\s*$/i, "").replace(/\s+(Leia mais em|O post )[\s\S]*$/, "").replace(/^Foto:[^·]*·[^A-Z]*Licença \S+\s*/, "").replace(/\s*\[…\]|\s*\[\.\.\.\]/g, "").trim();
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max);
  return corte.slice(0, corte.lastIndexOf(" ")) + "…";
}

function parse(xml, fonte) {
  const itens = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  return itens.slice(0, MAX_POR_FONTE).map((it) => {
    let titulo = limpar(tag(it, "title"));
    let origem = limpar(tag(it, "source")) || fonte.nome;
    if (fonte.nome === "Google Notícias") {
      const sufixo = " - " + origem;
      if (titulo.endsWith(sufixo)) titulo = titulo.slice(0, -sufixo.length);
    }
    const desc = limpar(tag(it, "description"));
    const data = new Date(limpar(tag(it, "pubDate")));
    return {
      t: titulo,
      s: origem,
      u: limpar(tag(it, "link")),
      x: fonte.nome === "Google Notícias" || desc.startsWith(titulo) ? "" : resumir(desc),
      ts: isNaN(data) ? 0 : data.getTime(),
      k: fonte.k,
      via: fonte.nome
    };
  }).filter((n) => n.t && /^https?:\/\//.test(n.u));
}

async function baixar(fonte) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(fonte.url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml" }, signal: ctrl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const xml = await r.text();
    if (!/<rss|<feed/i.test(xml)) throw new Error("resposta não é RSS");
    return parse(xml, fonte);
  } finally {
    clearTimeout(timer);
  }
}

function chave(t) {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80);
}

let cache = { em: 0, dados: null };

async function coletar(forcar = false) {
  if (!forcar && cache.dados && Date.now() - cache.em < TTL) return cache.dados;
  const resultados = await Promise.allSettled(FONTES.map(baixar));
  const vistos = new Set();
  const erros = [];
  let todas = [];
  resultados.forEach((r, i) => {
    if (r.status === "fulfilled") todas = todas.concat(r.value);
    else erros.push(FONTES[i].nome + ": " + r.reason.message);
  });
  todas = todas
    .sort((a, b) => b.ts - a.ts)
    .filter((n) => {
      const c = chave(n.t);
      if (vistos.has(c)) return false;
      vistos.add(c);
      return true;
    })
    .slice(0, MAX_TOTAL)
    .map((n, i) => ({
      id: i + 1,
      t: n.t,
      s: n.s,
      d: n.ts ? new Date(n.ts).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
      u: n.u,
      x: n.x,
      k: n.k,
      via: n.via
    }));
  const dados = { atualizado: new Date().toISOString(), total: todas.length, erros, noticias: todas };
  if (todas.length) cache = { em: Date.now(), dados };
  return dados;
}

module.exports = { coletar, FONTES };
