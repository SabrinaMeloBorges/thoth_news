(function () {
  "use strict";

  var SERVIDOR = location.protocol.indexOf("http") === 0;
  var POR_SECAO = 5;
  var PARADAS = ["para", "como", "pode", "sobre", "mais", "entre", "após", "apos", "pela", "pelo", "com", "dos", "das", "nos", "nas", "que", "uma", "seus", "suas", "veja", "entenda", "novo", "nova", "novas", "novos", "muda", "mudar", "2026", "2027", "reforma", "tributaria", "simples", "nacional", "receita", "federal", "contabil", "contabilidade", "contador", "contadores", "empresas", "senado"];

  var estado = { topico: "Todas", termo: "", ia: false, briefing: null, carregado: false };
  var $ = function (id) { return document.getElementById(id); };

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  function link(n) {
    return /^https?:\/\//.test(n.u) ? esc(n.u) : "#";
  }
  function porId(id) {
    for (var i = 0; i < NOTICIAS.length; i++) if (NOTICIAS[i].id === id) return NOTICIAS[i];
    return null;
  }

  function palavras(t) {
    return norm(t).split(/[^a-z0-9]+/).filter(function (w) { return w.length >= 4 && PARADAS.indexOf(w) < 0; });
  }

  function calcularCobertura() {
    var chaves = NOTICIAS.map(function (n) { return palavras(n.t); });
    NOTICIAS.forEach(function (n, i) {
      var c = 0;
      chaves.forEach(function (outra, j) {
        if (i === j) return;
        var comuns = chaves[i].filter(function (w) { return outra.indexOf(w) > -1; }).length;
        if (comuns >= 2) c++;
      });
      n.cob = c;
      n.ordem = i;
    });
  }

  function classificarPorPalavras() {
    NOTICIAS.forEach(function (n) {
      if (n.k && TOPICOS.indexOf(n.k) > -1) return;
      var s = norm(n.t + " " + n.x), melhor = TOPICOS[TOPICOS.length - 1], max = 0;
      TOPICOS.forEach(function (t) {
        var c = PALAVRAS[t].filter(function (w) { return s.indexOf(norm(w)) > -1; }).length;
        if (c > max) { max = c; melhor = t; }
      });
      n.k = melhor;
    });
  }

  function aplicarBriefing(b) {
    estado.briefing = b;
    var mapa = {};
    b.itens.forEach(function (i) { mapa[i.id] = i; });
    NOTICIAS.forEach(function (n) {
      var i = mapa[n.id];
      if (!i) return;
      n.k = i.topico;
      n.oque = i.oque;
      n.porque = i.porque;
      n.rel = i.relevancia;
    });
  }

  function pontuacao(n) {
    var rel = n.rel || 3;
    return rel * 2 + Math.min(n.cob || 0, 4) - (n.ordem || 0) * 0.03;
  }

  function filtradas() {
    var q = norm(estado.termo.trim());
    return NOTICIAS.filter(function (n) {
      var okTopico = estado.topico === "Todas" || n.k === estado.topico;
      var okBusca = !q || norm(n.t + " " + n.x + " " + n.s + " " + (n.porque || "")).indexOf(q) > -1;
      return okTopico && okBusca;
    }).sort(function (a, b) { return pontuacao(b) - pontuacao(a); });
  }

  function meta(n) {
    var extra = n.cob ? ' · <strong>+' + n.cob + (n.cob === 1 ? " fonte" : " fontes") + "</strong>" : "";
    return '<span class="meta">' + esc(n.s) + " · " + esc(n.d) + extra + "</span>";
  }

  function blocoPorque(n, mini) {
    if (!n.porque) return "";
    return '<div class="porque' + (mini ? " mini" : "") + '">' +
      (mini ? "" : "<p><strong>O que aconteceu:</strong> " + esc(n.oque) + "</p>") +
      "<p><strong>Por que importa para o contador:</strong> " + esc(n.porque) + "</p></div>";
  }

  function destaque(n) {
    return '<article class="destaque">' +
      '<div class="capa" aria-hidden="true"><svg width="40" height="40" viewBox="0 0 36 36"><path d="M24 9a10 10 0 1 0 0 18a8 8 0 1 1 0-18z" fill="#F2B632"/></svg><span>' + esc(n.k) + "</span></div>" +
      '<div class="corpo"><span class="rotulo">DESTAQUE</span>' +
      '<h1><a href="' + link(n) + '" target="_blank" rel="noopener">' + esc(n.t) + "</a></h1>" +
      (n.x && !n.porque ? "<p>" + esc(n.x) + "</p>" : "") +
      meta(n) + blocoPorque(n, false) +
      '<div class="acoes"><a class="btn primario" href="' + link(n) + '" target="_blank" rel="noopener">Ler na fonte</a>' +
      '<button class="btn" type="button" data-copiar="' + link(n) + '">Copiar link</button></div>' +
      "</div></article>";
  }

  function cartao(n) {
    return '<article class="cartao"><span class="tag">' + esc(n.k) + "</span>" +
      '<h2><a href="' + link(n) + '" target="_blank" rel="noopener">' + esc(n.t) + "</a></h2>" +
      (n.porque ? blocoPorque(n, true) : n.x ? "<p>" + esc(n.x) + "</p>" : "") +
      meta(n) + "</article>";
  }

  function linha(n) {
    return '<div class="linha"><div class="cab"><a href="' + link(n) + '" target="_blank" rel="noopener">' + esc(n.t) + "</a>" +
      '<span class="meta">' + esc(n.s) + " · " + esc(n.d) + "</span></div>" +
      (n.porque ? '<p class="pq"><strong>Por que importa:</strong> ' + esc(n.porque) + "</p>" : "") + "</div>";
  }

  function secao(titulo, itens, botao) {
    return '<section class="secao" aria-label="' + esc(titulo) + '"><h3>' + esc(titulo) + "</h3>" +
      itens.map(linha).join("") +
      (botao ? '<button class="btn mais" type="button" data-t="' + esc(botao) + '">Ver todas de ' + esc(botao) + "</button>" : "") +
      "</section>";
  }

  function esqueleto() {
    $("principal").innerHTML =
      '<div class="esqueleto" style="height:260px"></div>' +
      '<div class="dupla"><div class="esqueleto" style="height:150px"></div><div class="esqueleto" style="height:150px"></div></div>' +
      '<div class="esqueleto" style="height:22px;width:40%"></div><div class="esqueleto" style="height:180px"></div>';
  }

  function renderMenu() {
    $("menu").innerHTML = ["Todas"].concat(TOPICOS).map(function (t) {
      var qtd = t === "Todas" ? NOTICIAS.length : NOTICIAS.filter(function (n) { return n.k === t; }).length;
      return '<button type="button" data-t="' + esc(t) + '" aria-current="' + (t === estado.topico) + '">' + esc(t) + "<em>" + qtd + "</em></button>";
    }).join("");
  }

  function renderPrincipal() {
    var L = filtradas();
    $("principal").setAttribute("aria-busy", "false");
    if (!L.length) {
      $("principal").innerHTML = '<div class="vazio">Nenhuma notícia encontrada' +
        (estado.termo ? ' para “' + esc(estado.termo) + '”' : "") + ". Tente outro termo ou tópico.</div>";
      return;
    }
    var h = destaque(L[0]);
    if (L.length > 1) h += '<div class="dupla">' + L.slice(1, 3).map(cartao).join("") + "</div>";
    var resto = L.slice(3);
    if (resto.length) {
      if (estado.topico === "Todas" && !estado.termo) {
        TOPICOS.forEach(function (t) {
          var g = resto.filter(function (n) { return n.k === t; });
          if (g.length) h += secao(t, g.slice(0, POR_SECAO), g.length > POR_SECAO ? t : "");
        });
      } else {
        h += secao(estado.termo ? "Resultados da busca" : "Mais em " + estado.topico, resto, "");
      }
    }
    $("principal").innerHTML = h;
  }

  function renderLateral() {
    var alta = NOTICIAS.slice().sort(function (a, b) { return (b.cob || 0) - (a.cob || 0) || a.ordem - b.ordem; }).slice(0, 5);
    $("em-alta").innerHTML = alta.map(function (n) {
      return '<li><a href="' + link(n) + '" target="_blank" rel="noopener">' + esc(n.t) + "</a></li>";
    }).join("");
    $("prazos").innerHTML = PRAZOS.map(function (p) {
      return '<div class="prazo"><b>' + esc(p[0]) + "</b><span>" + esc(p[1]) + "</span></div>";
    }).join("");
  }

  function renderBriefing(status, erro) {
    var b = estado.briefing;
    if (b && b.resumo.length) {
      $("resumo").innerHTML = b.resumo.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("");
    }
    var msg = {
      pronto: "Gerado às " + (b ? new Date(b.geradoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "") + ". Pode conter erros: confira a fonte.",
      gerando: "A IA está lendo as notícias de hoje…",
      indisponivel: "IA não configurada. Adicione IA_API_KEY no arquivo .env e reinicie o servidor.",
      offline: "Abra pelo servidor (npm start) para usar a IA.",
      "estatico-sem-ia": "IA não configurada no GitHub: adicione o secret IA_API_KEY no repositório.",
      "estatico-erro": "Não foi possível gerar o briefing agora" + (erro ? " (" + esc(erro) + ")" : "") + ". Uma nova tentativa acontece na próxima atualização.",
      erro: "Não foi possível gerar o briefing" + (erro ? " (" + esc(erro) + ")" : "") + '. <button type="button" id="tentar-ia">Tentar de novo</button>'
    }[status] || "";
    $("status-ia").innerHTML = msg;
    if (!b && status !== "gerando") $("resumo").innerHTML = "";
    if (status === "gerando" && !b) {
      $("resumo").innerHTML = '<li class="esqueleto" style="height:16px;list-style:none"></li><li class="esqueleto" style="height:16px;list-style:none"></li><li class="esqueleto" style="height:16px;width:70%;list-style:none"></li>';
    }
  }

  function renderTudo() {
    renderMenu();
    renderPrincipal();
    renderLateral();
  }

  var idx = 0;
  function girar() {
    if (!NOTICIAS.length) return;
    var n = NOTICIAS[idx % NOTICIAS.length];
    $("ultima").textContent = n.t;
    $("ultima").href = link(n);
    idx++;
  }

  function prepararDados() {
    classificarPorPalavras();
    calcularCobertura();
  }

  var tentativas = 0;
  async function acompanharBriefing(tentar) {
    try {
      var r = await fetch("api/briefing" + (tentar ? "?tentar=1" : ""));
      var d = await r.json();
      if (d.briefing) {
        aplicarBriefing(d.briefing);
        renderTudo();
      }
      renderBriefing(d.status, d.erro);
      if (d.status === "gerando" && tentativas++ < 60) setTimeout(acompanharBriefing, 4000);
    } catch (e) {
      renderBriefing("erro", "sem conexão com o servidor");
    }
  }

  async function json(url) {
    var r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  async function detectarModo() {
    if (!SERVIDOR) return "offline";
    try {
      var st = await json("api/status");
      estado.ia = st.ia;
      return "servidor";
    } catch (e) {
      return "estatico";
    }
  }

  async function carregarBriefingEstatico() {
    try {
      var b = await json("data/briefing.json");
      if (b.briefing) {
        aplicarBriefing(b.briefing);
        renderTudo();
      }
      renderBriefing(b.status === "indisponivel" ? "estatico-sem-ia" : b.status === "erro" ? "estatico-erro" : b.status, b.erro);
    } catch (e) {
      renderBriefing("estatico-sem-ia");
    }
  }

  async function carregar() {
    esqueleto();
    estado.modo = await detectarModo();
    if (estado.modo !== "servidor") $("caixa-pergunte").hidden = true;
    if (estado.modo === "offline") {
      prepararDados();
      renderTudo();
      renderBriefing("offline");
      return;
    }
    try {
      var d = await json(estado.modo === "servidor" ? "api/noticias" : "data/noticias.json");
      if (!d.noticias || !d.noticias.length) throw new Error("vazio");
      NOTICIAS.length = 0;
      Array.prototype.push.apply(NOTICIAS, d.noticias);
      var fontes = {};
      NOTICIAS.forEach(function (n) { fontes[n.s] = 1; });
      $("fontes-info").textContent = NOTICIAS.length + " notícias de " + Object.keys(fontes).length + " fontes, atualizadas às " +
        new Date(d.atualizado).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + ".";
    } catch (e) {
      $("fontes-info").textContent = "Fontes indisponíveis agora: exibindo a edição salva.";
    }
    prepararDados();
    renderTudo();
    idx = 0;
    girar();
    if (estado.modo === "estatico") {
      carregarBriefingEstatico();
    } else if (estado.ia) {
      renderBriefing("gerando");
      acompanharBriefing();
    } else {
      renderBriefing("indisponivel");
    }
  }

  async function perguntar(e) {
    e.preventDefault();
    var campo = $("campo-pergunta"), btn = $("btn-pergunta"), out = $("resposta");
    var q = campo.value.trim();
    if (q.length < 3) { campo.focus(); return; }
    if (!SERVIDOR || !estado.ia) {
      out.innerHTML = '<p class="erro">A IA não está configurada. Adicione IA_API_KEY no arquivo .env.</p>';
      return;
    }
    btn.disabled = true;
    btn.textContent = "Pensando…";
    out.innerHTML = '<div class="esqueleto" style="height:60px"></div>';
    try {
      var r = await fetch("api/perguntar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pergunta: q }) });
      var d = await r.json();
      if (!r.ok) throw new Error(d.error || "Falha ao consultar a IA");
      var texto = esc(d.resposta).replace(/\[(\d+)\]/g, function (m, id) {
        var n = porId(Number(id));
        return n ? '<a href="' + link(n) + '" target="_blank" rel="noopener" title="' + esc(n.s) + '">[' + id + "]</a>" : m;
      });
      out.innerHTML = "<p>" + texto + "</p>" + (d.fontes.length ? "<ul>" + d.fontes.map(function (f) {
        return '<li><a href="' + esc(f.u) + '" target="_blank" rel="noopener">[' + f.id + "] " + esc(f.t) + "</a> · " + esc(f.s) + "</li>";
      }).join("") + "</ul>" : "");
    } catch (err) {
      out.innerHTML = '<p class="erro">' + esc(err.message) + "</p>";
    }
    btn.disabled = false;
    btn.textContent = "Perguntar";
  }

  function trocarTopico(t) {
    estado.topico = t;
    renderMenu();
    renderPrincipal();
    window.scrollTo({ top: 0 });
  }

  $("menu").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (b) trocarTopico(b.getAttribute("data-t"));
  });
  $("principal").addEventListener("click", function (e) {
    var mais = e.target.closest("button[data-t]");
    if (mais) return trocarTopico(mais.getAttribute("data-t"));
    var copiar = e.target.closest("button[data-copiar]");
    if (copiar && navigator.clipboard) {
      navigator.clipboard.writeText(copiar.getAttribute("data-copiar")).then(function () {
        copiar.textContent = "Link copiado";
        setTimeout(function () { copiar.textContent = "Copiar link"; }, 2000);
      });
    }
  });
  $("status-ia").addEventListener("click", function (e) {
    if (e.target.id === "tentar-ia") {
      tentativas = 0;
      renderBriefing("gerando");
      acompanharBriefing(true);
    }
  });
  var espera;
  $("form-busca").addEventListener("submit", function (e) { e.preventDefault(); estado.termo = $("campo-busca").value; renderPrincipal(); });
  $("campo-busca").addEventListener("input", function (e) {
    clearTimeout(espera);
    espera = setTimeout(function () { estado.termo = e.target.value; renderPrincipal(); }, 150);
  });
  $("form-pergunta").addEventListener("submit", perguntar);
  $("campo-pergunta").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("form-pergunta").requestSubmit(); }
  });
  var topoBtn = $("topo-btn");
  window.addEventListener("scroll", function () { topoBtn.classList.toggle("on", window.scrollY > 600); }, { passive: true });
  topoBtn.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });

  var hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  $("data").textContent = hoje.charAt(0).toUpperCase() + hoje.slice(1);
  carregar();
  setInterval(girar, 6000);
})();
