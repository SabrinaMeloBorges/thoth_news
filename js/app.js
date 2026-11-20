/* Radar Contábil — lógica da página. Depende de dados.js (NOTICIAS, TOPICOS, PALAVRAS, MAIS_LIDAS, PRAZOS). */
(function () {
  "use strict";

  /* Se você tiver um servidor que chama a API do Claude, informe aqui (ex.: "/api/classificar"). */
  var AI_ENDPOINT = location.protocol.indexOf("http") === 0 ? "/api/classificar" : "";

  var topicoAtual = "Todas";
  var termo = "";
  var $ = function (id) { return document.getElementById(id); };

  function esc(v) {
    var e = document.createElement("div");
    e.textContent = v;
    return e.innerHTML;
  }
  function norm(s) {
    return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function porId(id) {
    return NOTICIAS.filter(function (n) { return n.id === id; })[0];
  }

  /* ---------- Filtro ---------- */
  function filtradas() {
    var q = norm(termo.trim());
    return NOTICIAS.filter(function (n) {
      var okTopico = topicoAtual === "Todas" || n.k === topicoAtual;
      var okBusca = !q || norm(n.t + " " + n.x + " " + n.s).indexOf(q) > -1;
      return okTopico && okBusca;
    });
  }

  /* ---------- Componentes ---------- */
  function cartao(n, classe) {
    return '<a class="cartao ' + (classe || "") + '" href="' + n.u + '" target="_blank" rel="noopener">' +
      '<span class="tag">' + esc(n.k) + '</span><h3>' + esc(n.t) + '</h3><p>' + esc(n.x) + '</p>' +
      '<span class="meta">' + esc(n.s) + ' · ' + esc(n.d) + '</span></a>';
  }

  function secao(titulo, itens) {
    return '<section class="secao"><h4>' + esc(titulo) + '</h4><div class="lista">' +
      itens.map(function (n) { return cartao(n); }).join("") + '</div></section>';
  }

  /* ---------- Renderização ---------- */
  function renderMenu() {
    var h = ["Todas"].concat(TOPICOS).map(function (t) {
      var qtd = t === "Todas" ? NOTICIAS.length : NOTICIAS.filter(function (n) { return n.k === t; }).length;
      return '<button data-t="' + esc(t) + '" aria-current="' + (t === topicoAtual) + '">' + esc(t) + '<em>' + qtd + '</em></button>';
    }).join("");
    $("menu").innerHTML = h;
  }

  function renderPrincipal() {
    var L = filtradas();
    if (!L.length) {
      $("principal").innerHTML = '<div class="vazio">Nenhuma notícia encontrada. Tente outro termo ou tópico.</div>';
      return;
    }
    var f = L[0], h = "";
    h += '<a class="destaque" href="' + f.u + '" target="_blank" rel="noopener">' +
      '<div class="capa">' + esc(f.k) + '</div><div class="corpo"><span class="tag">Destaque</span>' +
      '<h2>' + esc(f.t) + '</h2><p>' + esc(f.x) + '</p><span class="meta">' + esc(f.s) + ' · ' + esc(f.d) + '</span></div></a>';
    if (L.length > 1) {
      h += '<div class="dupla">' + L.slice(1, 3).map(function (n) { return cartao(n); }).join("") + '</div>';
    }
    var resto = L.slice(3);
    if (resto.length) {
      if (topicoAtual === "Todas") {
        TOPICOS.forEach(function (t) {
          var g = resto.filter(function (n) { return n.k === t; });
          if (g.length) h += secao(t, g);
        });
      } else {
        h += secao("Mais em " + topicoAtual, resto);
      }
    }
    $("principal").innerHTML = h;
  }

  function renderLateral() {
    $("mais-lidas").innerHTML = MAIS_LIDAS.map(function (id) {
      var n = porId(id);
      return n ? '<li><a href="' + n.u + '" target="_blank" rel="noopener">' + esc(n.t) + '</a></li>' : "";
    }).join("");
    $("prazos").innerHTML = PRAZOS.map(function (p) {
      return '<div class="prazo"><b>' + esc(p[0]) + '</b><span>' + esc(p[1]) + '</span></div>';
    }).join("");
  }

  function renderTudo() { renderMenu(); renderPrincipal(); }

  /* ---------- Últimas (manchete rotativa) ---------- */
  var idx = 0;
  function girar() {
    var n = NOTICIAS[idx % NOTICIAS.length];
    $("ultima").textContent = n.t;
    $("ultima").href = n.u;
    idx++;
  }

  /* ---------- Classificação por IA ---------- */
  function porPalavras() {
    NOTICIAS.forEach(function (n) {
      var s = norm(n.t + " " + n.x), melhor = n.k, max = 0;
      TOPICOS.forEach(function (t) {
        var c = PALAVRAS[t].filter(function (w) { return s.indexOf(norm(w)) > -1; }).length;
        if (c > max) { max = c; melhor = t; }
      });
      n.k = melhor;
    });
  }

  async function chamarIA() {
    var prompt = "Você é editor de um portal de contabilidade no Brasil. Classifique cada notícia em exatamente um destes tópicos: " +
      JSON.stringify(TOPICOS) + ". Escreva também 3 frases curtas (resumo do dia) sobre o que mais importa a um contador, usando só as notícias abaixo. " +
      'Responda apenas JSON: {"items":{"1":"tópico"},"briefing":["...","...","..."]}.\nNotícias: ' +
      JSON.stringify(NOTICIAS.map(function (n) { return { id: n.id, titulo: n.t, resumo: n.x }; }));
    if (AI_ENDPOINT) {
      var r = await fetch(AI_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: prompt }) });
      return await r.json();
    }
    if (window.claude && window.claude.use) {
      var sm = await window.claude.use("sample");
      if (sm) return await sm.json(prompt);
    }
    return null;
  }

  async function classificar() {
    var b = $("btn-ia");
    b.disabled = true;
    $("status").textContent = "Classificando…";
    try {
      var r = await chamarIA(), ok = 0;
      if (r && r.items) {
        NOTICIAS.forEach(function (n) {
          var t = r.items[n.id];
          if (TOPICOS.indexOf(t) > -1) { n.k = t; ok++; }
        });
        if (r.briefing) {
          $("resumo").innerHTML = r.briefing.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("");
        }
        $("status").textContent = ok + " notícias classificadas pela IA.";
      } else {
        porPalavras();
        $("status").textContent = "IA não configurada: usei regras de palavras-chave.";
      }
      renderTudo();
    } catch (e) {
      $("status").textContent = "Falha ao usar a IA; tópicos mantidos.";
    }
    b.disabled = false;
  }

  /* ---------- Eventos ---------- */
  $("menu").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    topicoAtual = b.getAttribute("data-t");
    renderTudo();
    window.scrollTo({ top: 0 });
  });
  $("form-busca").addEventListener("submit", function (e) { e.preventDefault(); });
  $("campo-busca").addEventListener("input", function (e) { termo = e.target.value; renderPrincipal(); });
  $("btn-ia").addEventListener("click", classificar);
  var topoBtn = $("topo-btn");
  window.addEventListener("scroll", function () { topoBtn.classList.toggle("on", window.scrollY > 500); });
  topoBtn.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });

  /* ---------- Início ---------- */
  $("data").textContent = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  renderLateral();
  renderTudo();
  girar();
  setInterval(girar, 5000);
})();
