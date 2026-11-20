const ia = require("./ia");

if (!ia.disponivel()) {
  console.log("IA_API_KEY está vazia no arquivo .env.");
  console.log("Crie uma chave grátis em https://aistudio.google.com/apikey e cole depois de IA_API_KEY=");
  process.exit(1);
}

console.log("Testando " + ia.MODELO + "...");
ia.responder("Em uma frase: qual é a notícia mais importante?", [
  { id: 1, t: "Prazo para cancelar a opção pelo Simples termina em 20/12", x: "", s: "CFC", d: "20/11/2026" }
])
  .then((r) => {
    console.log("Funcionou! Resposta da IA:");
    console.log(r.resposta);
  })
  .catch((e) => {
    console.log("Falhou: " + e.message);
    if (e.status === 404) console.log("O modelo não foi encontrado. Troque IA_MODELO no .env (ex.: gemini-3.5-flash-lite).");
    if (e.status === 400 || e.status === 401 || e.status === 403) console.log("Confira se a chave foi colada inteira e sem espaços.");
    process.exit(1);
  });
