const fs = require("fs");
const path = require("path");
const { coletar } = require("../fontes");
const ia = require("../ia");

const RAIZ = path.join(__dirname, "..");
const SAIDA = path.join(RAIZ, "data");
const CACHE = path.join(RAIZ, ".cache", "briefing.json");

function lerCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE, "utf8"));
  } catch {
    return null;
  }
}

function salvar(arquivo, dados) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify(dados));
}

async function main() {
  const noticias = await coletar(true);
  if (noticias.erros.length) console.log("Fontes com erro:", noticias.erros.join("; "));
  console.log(`${noticias.total} notícias coletadas`);
  salvar(path.join(SAIDA, "noticias.json"), noticias);

  if (!ia.disponivel()) {
    console.log("IA_API_KEY não definida: briefing não gerado");
    salvar(path.join(SAIDA, "briefing.json"), { status: "indisponivel" });
    return;
  }

  const chave = noticias.noticias.map((n) => n.t).join("|");
  const anterior = lerCache();
  if (anterior && anterior.chave === chave) {
    console.log("Notícias iguais à última execução: reaproveitando briefing");
    salvar(path.join(SAIDA, "briefing.json"), { status: "pronto", briefing: anterior.briefing });
    return;
  }

  try {
    const briefing = await ia.gerarBriefing(noticias.noticias);
    console.log(`Briefing gerado (${briefing.itens.length} itens, ${briefing.modelo})`);
    salvar(CACHE, { chave, briefing });
    salvar(path.join(SAIDA, "briefing.json"), { status: "pronto", briefing });
  } catch (e) {
    console.log("Falha no briefing:", e.message);
    if (anterior && anterior.briefing) {
      salvar(path.join(SAIDA, "briefing.json"), { status: "pronto", briefing: { ...anterior.briefing, itens: [] } });
    } else {
      salvar(path.join(SAIDA, "briefing.json"), { status: "erro", erro: e.message });
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
