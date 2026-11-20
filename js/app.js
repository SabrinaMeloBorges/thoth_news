(function () {
  "use strict";

  var CONTA = window.ThothConta;
  var CONTATO = "contato.thothnews@gmail.com";
  var PARADAS = ["para", "como", "pode", "sobre", "mais", "entre", "após", "apos", "pela", "pelo", "com", "dos", "das", "nos", "nas", "que", "uma", "seus", "suas", "veja", "entenda", "novo", "nova", "novas", "novos", "muda", "mudar", "2026", "2027", "reforma", "tributaria", "simples", "nacional", "receita", "federal", "contabil", "contabilidade", "contador", "contadores", "empresas", "senado"];
  var VAZIAS = ["que", "qual", "quais", "como", "quando", "onde", "sobre", "para", "com", "uma", "uns", "das", "dos", "nas", "nos", "por", "mais", "tem", "teve", "esta", "isso", "essa", "esse", "voce", "pode", "sabe", "quero", "saber", "noticia", "noticias", "hoje", "algo", "alguma", "algum", "muda", "mudou", "mudar", "novidade", "novidades"];
  var SUGESTOES = ["O que mudou hoje?", "Novidades do Simples Nacional", "Próximos prazos", "Enviar uma sugestão"];
  var fmtDia = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });
  var fmtHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
  var fmtHoje = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  var fmtMes = new Intl.DateTimeFormat("pt-BR", { month: "short" });

  var estado = { modo: "", ia: false, briefing: null, briefingStatus: "", briefingErro: "", carregado: false, atualizado: null };
  var $ = function (id) { return document.getElementById(id); };

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  function ehUrl(u) {
    return /^https:\/\//.test(u || "");
  }
  function link(n) {
    return /^https?:\/\//.test(n.u) ? esc(n.u) : "#";
  }
  function porId(id) {
    for (var i = 0; i < NOTICIAS.length; i++) if (NOTICIAS[i].id === id) return NOTICIAS[i];
    return null;
  }
  function porLink(u) {
    for (var i = 0; i < NOTICIAS.length; i++) if (NOTICIAS[i].u === u) return NOTICIAS[i];
    var s = CONTA.salvos();
    for (var j = 0; j < s.length; j++) if (s[j].u === u) return s[j];
    return null;
  }
  function slug(t) {
    return norm(t).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  function topicoPorSlug(s) {
    for (var i = 0; i < TOPICOS.length; i++) if (slug(TOPICOS[i]) === s) return TOPICOS[i];
    return null;
  }

  function dataDe(d) {
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(d || "");
    if (!m) return null;
    var ano = Number(m[3]);
    return new Date(ano < 100 ? 2000 + ano : ano, Number(m[2]) - 1, Number(m[1]));
  }
  function diasAte(data) {
    var hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return Math.round((data - hoje) / 86400000);
  }
  function quando(n) {
    var dt = dataDe(n.d);
    if (!dt) return esc(n.d || "");
    var dias = diasAte(dt);
    if (dias === 0) return "hoje";
    if (dias === -1) return "ontem";
    return fmtDia.format(dt).replace(".", "");
  }

  function palavras(t) {
    return norm(t).split(/[^a-z0-9]+/).filter(function (w) { return w.length >= 4 && PARADAS.indexOf(w) < 0; });
  }

  function calcularCobertura() {
    var chaves = NOTICIAS.map(function (n) { return palavras(n.t); });
    NOTICIAS.forEach(function (n, i) {
      var c = 0, melhor = 0;
      n.imgRel = "";
      chaves.forEach(function (outra, j) {
        if (i === j) return;
        var comuns = chaves[i].filter(function (w) { return outra.indexOf(w) > -1; }).length;
        if (comuns >= 2) c++;
        if (comuns >= 2 && comuns > melhor && NOTICIAS[j].img) { melhor = comuns; n.imgRel = NOTICIAS[j].img; }
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
    return (n.rel || 3) * 2 + Math.min(n.cob || 0, 4) - (n.ordem || 0) * 0.03;
  }
  function ordenadas(lista) {
    return lista.slice().sort(function (a, b) { return pontuacao(b) - pontuacao(a); });
  }

  function rota() {
    var p = new URLSearchParams(location.search);
    if (p.has("salvos")) return { tipo: "salvos" };
    if (p.get("q")) return { tipo: "busca", valor: p.get("q") };
    var t = topicoPorSlug(p.get("editoria") || "");
    if (t) return { tipo: "editoria", valor: t };
    return { tipo: "capa" };
  }
  function urlDe(r) {
    if (r.tipo === "salvos") return "?salvos";
    if (r.tipo === "busca") return "?q=" + encodeURIComponent(r.valor);
    if (r.tipo === "editoria") return "?editoria=" + slug(r.valor);
    return location.pathname;
  }
  function navegar(r, substituir) {
    var url = urlDe(r);
    if (substituir) history.replaceState(null, "", url);
    else history.pushState(null, "", url);
    render();
    if (!substituir) window.scrollTo({ top: 0 });
  }

  var usadas;
  function escolherImagem(n, nivel) {
    var opcoes = [n.img];
    if (nivel >= 1) opcoes.push(n.imgRel);
    if (nivel >= 2) NOTICIAS.forEach(function (o) { if (o.k === n.k && o.img) opcoes.push(o.img); });
    for (var i = 0; i < opcoes.length; i++) {
      if (ehUrl(opcoes[i]) && !usadas[opcoes[i]]) {
        usadas[opcoes[i]] = 1;
        return opcoes[i];
      }
    }
    return "";
  }
  function foto(n, nivel, opts) {
    opts = opts || {};
    var src = escolherImagem(n, nivel);
    if (!src) {
      return opts.vazia ? '<div class="foto foto-vazia" aria-hidden="true"><span>' + esc(n.k) + "</span></div>" : "";
    }
    return '<div class="foto' + (opts.vazia ? " pode-vazia" : "") + '" data-rotulo="' + esc(n.k) + '"><img src="' + esc(src) + '" alt="" width="' + (opts.w || 640) + '" height="' + (opts.h || 400) + '"' +
      (opts.prioridade ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async" referrerpolicy="no-referrer"></div>';
  }

  function chapeu(n, comLink) {
    var imp = n.rel >= 5 ? '<span class="impacto">Alto impacto</span>' : "";
    var ed = comLink ? '<a href="' + urlDe({ tipo: "editoria", valor: n.k }) + '" data-editoria="' + esc(n.k) + '">' + esc(n.k) + "</a>" : "<span>" + esc(n.k) + "</span>";
    return '<div class="chapeu">' + imp + ed + "</div>";
  }
  function meta(n) {
    return '<div class="meta"><strong>' + esc(n.s) + "</strong><span>" + quando(n) + "</span>" +
      (n.cob ? '<span class="mais-fontes">+' + n.cob + (n.cob === 1 ? " fonte" : " fontes") + "</span>" : "") + "</div>";
  }
  function salvarMini(n) {
    var on = CONTA.estaSalvo(n.u);
    return '<button type="button" class="salvar-mini" data-salvar="' + link(n) + '" aria-pressed="' + on + '" aria-label="' + (on ? "Remover dos salvos: " : "Salvar: ") + esc(n.t) + '"><svg class="ic" aria-hidden="true"><use href="#i-marcador"/></svg></button>';
  }
  function titulo(n, tag) {
    return "<" + tag + '><a href="' + link(n) + '" target="_blank" rel="noopener">' + esc(n.t) + "</a></" + tag + ">";
  }
  function importa(n) {
    if (n.porque) {
      return '<div class="importa">' + (n.oque ? "<p><b>O que aconteceu.</b> " + esc(n.oque) + "</p>" : "") + "<p><b>Por que importa.</b> " + esc(n.porque) + "</p></div>";
    }
    return n.x ? '<p class="linha-fina">' + esc(n.x) + "</p>" : "";
  }

  function manchete(n) {
    var on = CONTA.estaSalvo(n.u);
    return '<article class="manchete">' +
      '<a href="' + link(n) + '" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">' + foto(n, 2, { vazia: true, prioridade: true, w: 1280, h: 720 }) + "</a>" +
      chapeu(n, true) + titulo(n, "h2") + importa(n) + meta(n) +
      '<div class="acoes"><a class="botao botao-cheio" href="' + link(n) + '" target="_blank" rel="noopener">Ler na fonte<svg class="ic" aria-hidden="true"><use href="#i-externo"/></svg></a>' +
      '<button type="button" class="acao-ic" data-salvar="' + link(n) + '" aria-pressed="' + on + '"><svg class="ic" aria-hidden="true"><use href="#i-marcador"/></svg>' + (on ? "Salva" : "Salvar") + "</button>" +
      '<button type="button" class="acao-ic" data-copiar="' + link(n) + '"><svg class="ic" aria-hidden="true"><use href="#i-link"/></svg>Copiar link</button></div>' +
      "</article>";
  }

  function secundaria(n, comFoto) {
    var texto = n.porque ? "<p><b>Por que importa.</b> " + esc(n.porque) + "</p>" : n.x ? "<p>" + esc(n.x) + "</p>" : "";
    return '<article class="secundaria">' +
      (comFoto ? '<a href="' + link(n) + '" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">' + foto(n, 1, { w: 600, h: 400 }) + "</a>" : "") +
      '<div class="topo-linha">' + chapeu(n, true) + salvarMini(n) + "</div>" + titulo(n, "h3") + texto + meta(n) + "</article>";
  }

  function linha(n, comFoto) {
    var f = comFoto ? foto(n, 0, { w: 240, h: 160 }) : "";
    return '<article class="linha' + (comFoto && !f ? " sem-foto" : "") + '">' + f +
      titulo(n, "h3") + salvarMini(n) +
      (n.porque ? '<p class="importa-curta"><b>Por que importa.</b> ' + esc(n.porque) + "</p>" : "") +
      meta(n) + "</article>";
  }

  function moduloBriefing() {
    var b = estado.briefing, st = estado.briefingStatus;
    var corpo;
    if (b && b.resumo.length) {
      corpo = '<ol class="pontos">' + b.resumo.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol>" +
        '<p class="nota">Resumo escrito por IA a partir das matérias de hoje' + (b.geradoEm ? ", às " + fmtHora.format(new Date(b.geradoEm)) : "") + ". Confira sempre a fonte.</p>";
    } else if (st === "gerando") {
      corpo = '<div class="esq" style="height:18px;margin-bottom:12px"></div><div class="esq" style="height:18px;margin-bottom:12px"></div><div class="esq" style="height:18px;width:70%"></div><p class="nota">Lendo as notícias de hoje…</p>';
    } else if (st === "erro") {
      corpo = '<p class="nota">O resumo de hoje não ficou pronto. <button type="button" id="tentar-ia">Tentar de novo</button></p>';
    } else {
      corpo = '<p class="nota">O resumo do dia volta na próxima atualização. Enquanto isso, as notícias abaixo estão em ordem de relevância.</p>';
    }
    return '<section class="modulo" aria-labelledby="t-dia"><div class="modulo-cab"><h2 id="t-dia">O dia em 3 pontos</h2></div>' + corpo + "</section>";
  }

  function moduloPrazos() {
    var itens = PRAZOS.map(function (p) {
      var partes = p[0].split("/");
      var hoje = new Date();
      var ano = partes[2] ? (partes[2].length === 2 ? 2000 + Number(partes[2]) : Number(partes[2])) : hoje.getFullYear();
      var dt = new Date(ano, Number(partes[1]) - 1, Number(partes[0]));
      return { dt: dt, dias: diasAte(dt), texto: p[1] };
    }).filter(function (x) { return x.dias >= 0; }).sort(function (a, b) { return a.dt - b.dt; }).slice(0, 4);
    if (!itens.length) return "";
    return '<section class="modulo" aria-labelledby="t-prazos"><div class="modulo-cab"><h2 id="t-prazos">Próximos prazos</h2></div>' +
      itens.map(function (x) {
        var falta = x.dias === 0 ? "Hoje" : x.dias === 1 ? "Amanhã" : x.dias <= 30 ? "Em " + x.dias + " dias" : "";
        return '<div class="prazo' + (x.dias <= 7 ? " proximo" : "") + '"><time class="prazo-data" datetime="' + x.dt.toISOString().slice(0, 10) + '"><b>' + x.dt.getDate() + "</b><small>" + fmtMes.format(x.dt).replace(".", "") + "</small></time>" +
          "<div>" + esc(x.texto) + (falta ? "<em>" + falta + "</em>" : "") + "</div></div>";
      }).join("") + "</section>";
  }

  function faixaRepercussao(L) {
    var top = L.slice().sort(function (a, b) { return (b.cob || 0) - (a.cob || 0) || a.ordem - b.ordem; }).filter(function (n) { return n.cob > 0; }).slice(0, 5);
    if (top.length < 3) return "";
    return '<section class="faixa" aria-labelledby="t-rep"><div class="wrap"><div class="faixa-cab"><h2 id="t-rep">Mais repercutidas</h2><small>Assuntos que aparecem em mais fontes</small></div>' +
      '<ol class="ranking">' + top.map(function (n) {
        return '<li><div><a href="' + link(n) + '" target="_blank" rel="noopener">' + esc(n.t) + "</a><span>" + (n.cob + 1) + " fontes · " + esc(n.k) + "</span></div></li>";
      }).join("") + "</ol></div></section>";
  }

  function blocoEditoria(t, itens, largo) {
    if (!itens.length) return "";
    var d = itens[0];
    var f = foto(d, 1, { w: 480, h: 360 });
    var resto = itens.slice(1, 5);
    var total = NOTICIAS.filter(function (n) { return n.k === t; }).length;
    return '<section class="ed' + (largo ? " largo" : "") + '" aria-labelledby="ed-' + slug(t) + '"><div class="ed-cab"><h2 id="ed-' + slug(t) + '">' + esc(t) + '</h2><a href="' + urlDe({ tipo: "editoria", valor: t }) + '" data-editoria="' + esc(t) + '">Ver as ' + total + "</a></div>" +
      '<article class="destaque-ed' + (f ? "" : " sem-foto") + '">' + (f ? '<a href="' + link(d) + '" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">' + f + "</a>" : "") +
      "<div>" + titulo(d, "h3") + (d.porque ? "<p><b>Por que importa.</b> " + esc(d.porque) + "</p>" : d.x ? "<p>" + esc(d.x) + "</p>" : "") + meta(d) + "</div></article>" +
      '<div class="ed-lista">' + resto.map(function (n) { return linha(n, false); }).join("") + "</div></section>";
  }

  function renderCapa() {
    var L = ordenadas(NOTICIAS);
    if (!L.length) return '<div class="wrap vazio"><strong>Nenhuma notícia agora</strong>As fontes não responderam. Tente de novo em alguns minutos.</div>';
    var lead = L[0], sec = L.slice(1, 4), extra = L.slice(4, 7), usados = {};
    [lead].concat(sec, extra).forEach(function (n) { usados[n.id] = 1; });
    var h = '<div class="wrap"><div class="capa"><div class="col-manchete">' + manchete(lead) +
      (extra.length ? '<section class="mais-capa" aria-labelledby="t-mais"><h2 id="t-mais">Também na capa</h2>' + extra.map(function (n) { return linha(n, false); }).join("") + "</section>" : "") + "</div>" +
      '<div class="secundarias">' + sec.map(function (n, i) { return secundaria(n, i === 0); }).join("") + "</div>" +
      '<div class="coluna-lateral">' + moduloBriefing() + moduloPrazos() + "</div></div></div>";
    h += faixaRepercussao(L);
    var blocos = TOPICOS.map(function (t) { return { t: t, itens: L.filter(function (n) { return n.k === t && !usados[n.id]; }) }; }).filter(function (b) { return b.itens.length; });
    h += '<div class="wrap"><div class="eds">' + blocos.map(function (b, i) {
      return blocoEditoria(b.t, b.itens, blocos.length % 2 === 1 && i === blocos.length - 1);
    }).join("") + "</div></div>";
    return h;
  }

  function pagina(tituloPag, sub, itens, vazio) {
    return '<div class="wrap pagina"><div class="pagina-cab"><h2>' + tituloPag + "</h2><p>" + sub + "</p></div>" +
      '<div class="pagina-grade"><div class="lista-grande">' + (itens.length ? itens.map(function (n) { return linha(n, true); }).join("") : vazio) + "</div>" +
      '<div class="coluna-lateral">' + moduloBriefing() + moduloPrazos() + "</div></div></div>";
  }

  function renderEditoria(t) {
    var itens = ordenadas(NOTICIAS.filter(function (n) { return n.k === t; }));
    return pagina(esc(t), itens.length + (itens.length === 1 ? " notícia" : " notícias") + " nesta editoria", itens,
      '<div class="vazio"><strong>Nada nesta editoria hoje</strong>Volte mais tarde ou veja a capa.</div>');
  }

  function renderBusca(q) {
    var termos = norm(q.trim()).split(/\s+/).filter(Boolean);
    var itens = ordenadas(NOTICIAS.filter(function (n) {
      var alvo = norm(n.t + " " + n.x + " " + n.s + " " + n.k + " " + (n.porque || "") + " " + (n.oque || ""));
      return termos.every(function (w) { return alvo.indexOf(w) > -1; });
    }));
    return pagina("Busca: “" + esc(q) + "”", itens.length + (itens.length === 1 ? " resultado" : " resultados"), itens,
      '<div class="vazio"><strong>Nenhuma notícia com esse termo</strong>Tente uma palavra mais curta, como CBS, IBS ou Simples.</div>');
  }

  function renderSalvos() {
    var itens = CONTA.salvos().map(function (x) { return porLink(x.u) || x; });
    var sub = itens.length ? itens.length + (itens.length === 1 ? " notícia salva" : " notícias salvas") : "Toque no marcador de uma notícia para guardá-la aqui";
    if (!CONTA.usuario()) sub += itens.length ? " neste navegador" : "";
    var h = pagina("Salvas", sub, itens,
      '<div class="vazio"><strong>Você ainda não salvou nenhuma notícia</strong>Use o marcador ao lado de cada título.<br><a class="botao botao-contorno" href="./" data-capa>Ir para a capa</a></div>');
    if (!CONTA.usuario()) {
      h = h.replace('<div class="lista-grande">', '<div class="lista-grande"><p class="nota" style="margin:12px 0 4px">Sem conta, as salvas ficam só neste navegador. <button type="button" data-entrar>Entrar para acessar em qualquer dispositivo</button></p>');
    }
    return h;
  }

  function renderEditorias(r) {
    var itens = [{ t: "Capa", href: "./", atual: r.tipo === "capa", qtd: "" }].concat(TOPICOS.map(function (t) {
      return { t: t, href: urlDe({ tipo: "editoria", valor: t }), atual: r.tipo === "editoria" && r.valor === t, qtd: NOTICIAS.filter(function (n) { return n.k === t; }).length, ed: t };
    }));
    var salvas = CONTA.salvos().length;
    $("editorias").innerHTML = itens.map(function (i) {
      return '<a href="' + i.href + '"' + (i.ed ? ' data-editoria="' + esc(i.ed) + '"' : " data-capa") + (i.atual ? ' aria-current="page"' : "") + ">" + esc(i.t) + "</a>";
    }).join("");
    $("salvas-link").innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-marcador"/></svg><span class="rotulo-util">Salvas</span>' + (salvas ? '<span class="contador">' + salvas + "</span>" : "");
    if (r.tipo === "salvos") $("salvas-link").setAttribute("aria-current", "page");
    else $("salvas-link").removeAttribute("aria-current");
    $("salvas-link").setAttribute("aria-label", "Notícias salvas" + (salvas ? ", " + salvas : ""));
    $("rodape-editorias").innerHTML = TOPICOS.map(function (t) {
      return '<li><a href="' + urlDe({ tipo: "editoria", valor: t }) + '" data-editoria="' + esc(t) + '">' + esc(t) + "</a></li>";
    }).join("");
  }

  function render() {
    var r = rota();
    usadas = {};
    renderEditorias(r);
    if (r.tipo !== "busca" && document.activeElement !== $("campo-busca")) $("campo-busca").value = "";
    if (r.tipo === "busca" && document.activeElement !== $("campo-busca")) $("campo-busca").value = r.valor;
    var html = r.tipo === "editoria" ? renderEditoria(r.valor) : r.tipo === "busca" ? renderBusca(r.valor) : r.tipo === "salvos" ? renderSalvos() : renderCapa();
    $("principal").innerHTML = html;
    $("principal").setAttribute("aria-busy", "false");
    document.title = (r.tipo === "editoria" ? r.valor + " · " : r.tipo === "busca" ? "Busca · " : r.tipo === "salvos" ? "Salvas · " : "") + "Thoth News";
    var recente = NOTICIAS.slice().sort(function (a, b) { return (dataDe(b.d) || 0) - (dataDe(a.d) || 0) || a.ordem - b.ordem; })[0];
    if (recente) {
      $("agora-link").textContent = recente.t;
      $("agora-link").href = recente.u;
    }
  }

  function esqueleto() {
    $("principal").innerHTML = '<div class="wrap"><div class="capa"><div><div class="esq" style="aspect-ratio:16/9;margin-bottom:20px"></div><div class="esq" style="height:40px;margin-bottom:10px"></div><div class="esq" style="height:40px;width:70%"></div></div>' +
      '<div><div class="esq" style="aspect-ratio:3/2;margin-bottom:12px"></div><div class="esq" style="height:22px;margin-bottom:8px"></div><div class="esq" style="height:22px;width:60%"></div></div><div><div class="esq" style="height:220px"></div></div></div></div>';
  }

  var avisoTimer;
  var desfazer = null;
  function avisar(texto, aoDesfazer) {
    var a = $("aviso");
    desfazer = aoDesfazer || null;
    a.innerHTML = "<span>" + esc(texto) + "</span>" + (desfazer ? '<button type="button" id="desfazer">Desfazer</button>' : "");
    a.classList.add("on");
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(function () { a.classList.remove("on"); desfazer = null; }, desfazer ? 5000 : 2200);
  }

  async function json(url) {
    var r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  async function detectarModo() {
    if (location.protocol.indexOf("http") !== 0) return "offline";
    try {
      var st = await json("api/status");
      estado.ia = st.ia;
      return "servidor";
    } catch (e) {
      return "estatico";
    }
  }

  var tentativas = 0;
  async function acompanharBriefing(forcar) {
    try {
      var d = await json("api/briefing" + (forcar ? "?tentar=1" : ""));
      if (d.briefing) aplicarBriefing(d.briefing);
      estado.briefingStatus = d.status;
      estado.briefingErro = d.erro || "";
      if (d.erro) console.warn("Briefing:", d.erro);
      render();
      if (d.status === "gerando" && tentativas++ < 60) setTimeout(acompanharBriefing, 4000);
    } catch (e) {
      estado.briefingStatus = "erro";
      render();
    }
  }

  async function carregarBriefingEstatico() {
    try {
      var b = await json("data/briefing.json");
      if (b.briefing) aplicarBriefing(b.briefing);
      estado.briefingStatus = b.briefing ? "pronto" : "indisponivel";
    } catch (e) {
      estado.briefingStatus = "indisponivel";
    }
    render();
  }

  async function carregar() {
    esqueleto();
    estado.modo = await detectarModo();
    if (estado.modo !== "offline") {
      try {
        var d = await json(estado.modo === "servidor" ? "api/noticias" : "data/noticias.json");
        if (!d.noticias || !d.noticias.length) throw new Error("vazio");
        NOTICIAS.length = 0;
        Array.prototype.push.apply(NOTICIAS, d.noticias);
        estado.atualizado = new Date(d.atualizado);
        var fontes = {};
        NOTICIAS.forEach(function (n) { fontes[n.s] = 1; });
        $("fontes-info").textContent = NOTICIAS.length + " notícias de " + Object.keys(fontes).length + " fontes.";
        $("atualizado").textContent = "Atualizado às " + fmtHora.format(estado.atualizado);
      } catch (e) {
        $("fontes-info").textContent = "As fontes não responderam agora: você está vendo a última edição salva.";
      }
    }
    classificarPorPalavras();
    calcularCobertura();
    estado.carregado = true;
    if (estado.modo === "servidor" && estado.ia) {
      estado.briefingStatus = "gerando";
      render();
      acompanharBriefing();
    } else if (estado.modo === "estatico") {
      render();
      carregarBriefingEstatico();
    } else {
      estado.briefingStatus = "indisponivel";
      render();
    }
  }

  function termos(q) {
    return norm(q).replace(/pgdas\s*-\s*d/g, "pgdasd").split(/[^a-z0-9]+/).filter(function (w) {
      return w.length >= 3 && VAZIAS.indexOf(w) < 0;
    });
  }
  function itemChat(n) {
    var texto = n.porque || n.oque || n.x || "";
    return '<li><a href="' + link(n) + '" target="_blank" rel="noopener">' + esc(n.t) + "</a>" +
      (texto ? "<span>" + esc(texto.length > 150 ? texto.slice(0, 147) + "…" : texto) + "</span>" : "") + "</li>";
  }
  function respostaLocal(q) {
    var t = norm(q);
    if (/^(oi|ola|bom dia|boa tarde|boa noite|e ai)\b/.test(t) && t.length < 20) {
      return "<p>Olá. Pergunte sobre um tema das notícias de hoje: CBS, IBS, Simples Nacional, prazos.</p>";
    }
    if (/feedback|sugest|contato|reclama|e-?mail|falar com|corrig/.test(t)) {
      return '<p>Escreva para <a href="mailto:' + CONTATO + '?subject=Feedback%20Thoth%20News">' + CONTATO + "</a>. A redação lê todas as mensagens.</p>";
    }
    if (/prazo|vencimento|vence|calendario|data limite/.test(t)) {
      return "<p>Os próximos prazos:</p><ul>" + PRAZOS.slice(0, 4).map(function (p) {
        return "<li><b>" + esc(p[0]) + "</b><span>" + esc(p[1]) + "</span></li>";
      }).join("") + "</ul>";
    }
    var w = termos(q);
    if (!w.length || /mudou hoje|resumo do dia/.test(t)) {
      if (estado.briefing && estado.briefing.resumo.length) {
        return "<p>O dia em 3 pontos:</p><ul>" + estado.briefing.resumo.map(function (x) { return "<li><span>" + esc(x) + "</span></li>"; }).join("") + "</ul>";
      }
      return "<p>Os destaques de agora:</p><ul>" + ordenadas(NOTICIAS).slice(0, 3).map(itemChat).join("") + "</ul>";
    }
    var achadas = NOTICIAS.map(function (n) {
      var alvo = norm(n.t + " " + (n.x || "") + " " + (n.oque || "") + " " + (n.porque || "") + " " + n.k).replace(/pgdas\s*-\s*d/g, "pgdasd");
      var tit = norm(n.t);
      var pts = w.reduce(function (acc, p) { return acc + (alvo.indexOf(p) > -1 ? (tit.indexOf(p) > -1 ? 2 : 1) : 0); }, 0);
      return { n: n, pts: pts };
    }).filter(function (x) { return x.pts > 0; }).sort(function (a, b) { return b.pts - a.pts || pontuacao(b.n) - pontuacao(a.n); }).slice(0, 3);
    if (!achadas.length) return "<p>Nenhuma notícia de hoje fala disso. Tente outro termo, como CBS, IBS ou Simples Nacional.</p>";
    return "<p>" + (achadas.length === 1 ? "Uma notícia trata disso:" : achadas.length + " notícias tratam disso:") + "</p><ul>" + achadas.map(function (x) { return itemChat(x.n); }).join("") + "</ul>";
  }
  async function respostaIA(q) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 15000);
    var r, d;
    try {
      r = await fetch("api/perguntar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pergunta: q }), signal: ctrl.signal });
      d = await r.json();
    } finally {
      clearTimeout(timer);
    }
    if (!r.ok) throw new Error(d.error || "Falha ao consultar a IA");
    var texto = esc(d.resposta).replace(/\s*\[(\d+)\]/g, "");
    return "<p>" + texto + "</p>" + (d.fontes.length ? "<ul>" + d.fontes.map(function (f) {
      var n = porId(f.id) || f;
      return itemChat({ t: f.t, u: f.u, x: n.s ? n.s : "" });
    }).join("") + "</ul>" : "");
  }
  function addMsg(quem, html) {
    var div = document.createElement("div");
    div.className = "msg " + quem;
    div.innerHTML = html;
    $("chat-msgs").appendChild(div);
    $("chat-msgs").scrollTop = $("chat-msgs").scrollHeight;
    return div;
  }
  var ocupado = false;
  async function perguntar(q) {
    q = String(q || "").trim();
    if (q.length < 2 || ocupado) return;
    ocupado = true;
    var envio = $("chat-form").querySelector("button");
    envio.disabled = true;
    $("chat-sugestoes").innerHTML = "";
    addMsg("eu", "<p>" + esc(q) + "</p>");
    var bolha = addMsg("thoth", '<p class="digitando" aria-label="Escrevendo resposta…"><i></i><i></i><i></i></p>');
    var html;
    var local = /feedback|sugest|contato|reclama|prazo|vencimento|mudou hoje|resumo do dia|^(oi|ola|bom dia|boa tarde|boa noite)\b/.test(norm(q));
    if (estado.modo === "servidor" && estado.ia && !local) {
      try { html = await respostaIA(q); } catch (e) { html = respostaLocal(q); }
    } else {
      await new Promise(function (r) { setTimeout(r, 300); });
      html = respostaLocal(q);
    }
    bolha.innerHTML = html;
    $("chat-msgs").scrollTop = $("chat-msgs").scrollHeight;
    ocupado = false;
    envio.disabled = false;
  }
  function abrirChat(abrir) {
    $("chat").hidden = !abrir;
    document.body.classList.toggle("chat-aberto", abrir);
    document.querySelectorAll("[data-abrir-chat]").forEach(function (b) { b.setAttribute("aria-expanded", String(abrir)); });
    if (abrir) {
      if (!$("chat-msgs").children.length) {
        addMsg("thoth", "<p>Pergunte sobre as notícias de hoje. A resposta vem em poucas linhas, com o link da matéria.</p>");
        $("chat-sugestoes").innerHTML = SUGESTOES.map(function (x) { return '<button type="button">' + esc(x) + "</button>"; }).join("");
      }
      $("chat-campo").focus();
    }
  }

  function renderConta() {
    var box = $("conta"), u = CONTA.usuario();
    if (!u) {
      box.innerHTML = '<button type="button" class="botao botao-cheio botao-entrar" data-entrar>Entrar</button>';
      return;
    }
    var nome = u.displayName || u.email || "Sua conta";
    var avatar = ehUrl(u.photoURL) ? '<img src="' + esc(u.photoURL) + '" width="36" height="36" alt="" referrerpolicy="no-referrer">' : esc(nome.charAt(0).toUpperCase());
    box.innerHTML = '<div class="perfil"><button type="button" id="perfil-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Conta de ' + esc(nome) + '">' + avatar + "</button>" +
      '<div class="perfil-menu" id="perfil-menu" role="menu" hidden><p><strong>' + esc(nome) + "</strong>" + (u.email && u.email !== nome ? "<small>" + esc(u.email) + "</small>" : "") + "</p>" +
      '<button type="button" role="menuitem" data-ver-salvos>Notícias salvas</button><button type="button" role="menuitem" data-sair>Sair da conta</button></div></div>';
  }
  function menuPerfil(abrir) {
    var m = $("perfil-menu"), b = $("perfil-btn");
    if (!m) return;
    m.hidden = !abrir;
    b.setAttribute("aria-expanded", String(abrir));
  }
  function abrirLogin() {
    var d = $("login");
    var aviso = $("login-aviso");
    aviso.className = "login-aviso";
    $("entrar-google").disabled = !CONTA.configurado;
    $("entrar-apple").disabled = !CONTA.configurado;
    $("entrar-apple").hidden = CONTA.configurado && !CONTA.apple;
    aviso.textContent = CONTA.configurado ? "" : "O login ainda não foi ativado nesta versão do site. Você já pode salvar notícias neste navegador.";
    if (typeof d.showModal === "function") d.showModal();
    else d.setAttribute("open", "");
  }
  function fecharLogin() {
    var d = $("login");
    if (typeof d.close === "function") d.close();
    else d.removeAttribute("open");
  }
  function entrar(tipo) {
    var aviso = $("login-aviso");
    aviso.className = "login-aviso";
    aviso.textContent = "Abrindo a janela de login…";
    CONTA.entrar(tipo).then(function () {
      fecharLogin();
      avisar("Você entrou. Suas salvas agora ficam na sua conta.");
    }).catch(function (e) {
      if (e && /popup-closed|cancelled-popup/.test(e.code || "")) { aviso.textContent = ""; return; }
      aviso.className = "login-aviso erro";
      aviso.textContent = /popup-blocked/.test((e && e.code) || "") ? "O navegador bloqueou a janela de login. Permita pop-ups para este site e tente de novo." : "Não deu para entrar agora. Tente de novo em instantes.";
    });
  }

  function aplicarTema(t) {
    document.documentElement.setAttribute("data-tema", t);
    var escuro = t === "escuro";
    var b = $("tema-btn");
    b.innerHTML = '<svg class="ic" aria-hidden="true"><use href="' + (escuro ? "#i-sol" : "#i-lua") + '"/></svg>';
    b.setAttribute("aria-label", escuro ? "Usar tema claro" : "Usar tema escuro");
    document.querySelector('meta[name="theme-color"]').setAttribute("content", escuro ? "#121316" : "#ffffff");
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[data-editoria], a[data-capa], a[data-salvos]");
    if (a && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
      e.preventDefault();
      navegar(a.hasAttribute("data-editoria") ? { tipo: "editoria", valor: a.getAttribute("data-editoria") } : a.hasAttribute("data-salvos") ? { tipo: "salvos" } : { tipo: "capa" });
      return;
    }
    var s = e.target.closest("[data-salvar]");
    if (s) {
      var n = porLink(s.getAttribute("data-salvar"));
      if (!n) return;
      var antes = CONTA.estaSalvo(n.u);
      CONTA.alternar(n);
      avisar(antes ? "Removida das salvas" : "Notícia salva", antes ? function () { CONTA.alternar(n); } : null);
      return;
    }
    var c = e.target.closest("[data-copiar]");
    if (c) {
      if (navigator.clipboard) navigator.clipboard.writeText(c.getAttribute("data-copiar")).then(function () { avisar("Link copiado"); }, function () { avisar("Não deu para copiar o link"); });
      return;
    }
    if (e.target.id === "desfazer" && desfazer) {
      var f = desfazer;
      desfazer = null;
      f();
      avisar("Notícia salva de novo");
      return;
    }
    if (e.target.closest("[data-entrar]")) { menuPerfil(false); abrirLogin(); return; }
    if (e.target.closest("[data-fechar-login]")) { fecharLogin(); return; }
    if (e.target.closest("[data-abrir-chat]")) { abrirChat(true); return; }
    if (e.target.closest("#perfil-btn")) { menuPerfil($("perfil-menu").hidden); return; }
    if (e.target.closest("[data-ver-salvos]")) { menuPerfil(false); navegar({ tipo: "salvos" }); return; }
    if (e.target.closest("[data-sair]")) { menuPerfil(false); CONTA.sair().then(function () { avisar("Você saiu da conta"); }); return; }
    if (e.target.id === "tentar-ia") {
      tentativas = 0;
      estado.briefingStatus = "gerando";
      render();
      acompanharBriefing(true);
      return;
    }
    if ($("perfil-menu") && !e.target.closest(".perfil")) menuPerfil(false);
  });

  document.addEventListener("error", function (e) {
    var img = e.target;
    if (!img || img.tagName !== "IMG") return;
    var box = img.closest(".foto");
    if (!box) return;
    if (box.classList.contains("pode-vazia")) {
      box.className = "foto foto-vazia";
      box.innerHTML = "<span>" + esc(box.getAttribute("data-rotulo")) + "</span>";
      return;
    }
    var art = box.closest(".linha, .destaque-ed");
    if (art) art.classList.add("sem-foto");
    var alvo = box.parentElement && box.parentElement.tagName === "A" && box.parentElement.children.length === 1 ? box.parentElement : box;
    alvo.remove();
  }, true);

  $("login").addEventListener("click", function (e) {
    if (e.target === $("login")) fecharLogin();
  });
  $("entrar-google").addEventListener("click", function () { entrar("google"); });
  $("entrar-apple").addEventListener("click", function () { entrar("apple"); });
  $("chat-fechar").addEventListener("click", function () { abrirChat(false); document.querySelector(".chat-atalho").focus(); });
  $("chat-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (ocupado) return;
    var q = $("chat-campo").value;
    $("chat-campo").value = "";
    perguntar(q);
  });
  $("chat-sugestoes").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (b) perguntar(b.textContent);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if ($("perfil-menu") && !$("perfil-menu").hidden) { menuPerfil(false); $("perfil-btn").focus(); return; }
    if (!$("chat").hidden && !$("login").open) { abrirChat(false); document.querySelector(".chat-atalho").focus(); }
  });

  var espera;
  $("form-busca").addEventListener("submit", function (e) {
    e.preventDefault();
    var q = $("campo-busca").value.trim();
    navegar(q ? { tipo: "busca", valor: q } : { tipo: "capa" }, rota().tipo === "busca");
  });
  $("campo-busca").addEventListener("input", function () {
    clearTimeout(espera);
    espera = setTimeout(function () {
      if (!estado.carregado) return;
      var q = $("campo-busca").value.trim();
      var atual = rota();
      if (!q && atual.tipo !== "busca") return;
      navegar(q ? { tipo: "busca", valor: q } : { tipo: "capa" }, atual.tipo === "busca");
    }, 250);
  });
  window.addEventListener("popstate", render);

  $("tema-btn").addEventListener("click", function () {
    var t = document.documentElement.getAttribute("data-tema") === "escuro" ? "claro" : "escuro";
    aplicarTema(t);
    try { localStorage.setItem("tema", t); } catch (e) {}
  });
  aplicarTema(document.documentElement.getAttribute("data-tema") === "escuro" ? "escuro" : "claro");

  var hoje = fmtHoje.format(new Date());
  $("hoje").textContent = hoje.charAt(0).toUpperCase() + hoje.slice(1);
  $("hoje").setAttribute("datetime", new Date().toISOString().slice(0, 10));

  CONTA.aoMudar(function () {
    renderConta();
    if (estado.carregado) render();
  });
  renderConta();
  CONTA.iniciar().then(renderConta);
  carregar();
})();
