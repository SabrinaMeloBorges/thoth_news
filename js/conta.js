(function () {
  "use strict";

  var CHAVE = "salvos";
  var SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
  var cfg = window.THOTH_CONFIG || {};
  var configurado = !!(cfg.firebase && cfg.firebase.apiKey);
  var ouvintes = [];
  var usuario = null, auth = null, db = null;
  var salvos = ler();

  function ler() {
    try {
      var v = JSON.parse(localStorage.getItem(CHAVE) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }

  function gravarLocal() {
    try { localStorage.setItem(CHAVE, JSON.stringify(salvos)); } catch (e) {}
  }

  function avisar() {
    ouvintes.forEach(function (f) { f(); });
  }

  function mesclar(a, b) {
    var vistos = {};
    return a.concat(b).filter(function (n) {
      if (!n || !n.u || vistos[n.u]) return false;
      vistos[n.u] = 1;
      return true;
    }).slice(0, 200);
  }

  function sincronizar() {
    if (!usuario || !db) return;
    db.collection("usuarios").doc(usuario.uid).set({ salvos: salvos, atualizado: new Date().toISOString() }, { merge: true })
      .catch(function (e) { console.warn("Falha ao sincronizar salvos:", e.message); });
  }

  function carregarScript(src) {
    return new Promise(function (ok, falha) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = function () { falha(new Error("Não foi possível carregar " + src)); };
      document.head.appendChild(s);
    });
  }

  function iniciar() {
    if (!configurado) return Promise.resolve(false);
    return carregarScript(SDK + "firebase-app-compat.js")
      .then(function () {
        return Promise.all([carregarScript(SDK + "firebase-auth-compat.js"), carregarScript(SDK + "firebase-firestore-compat.js")]);
      })
      .then(function () {
        firebase.initializeApp(cfg.firebase);
        auth = firebase.auth();
        db = firebase.firestore();
        auth.onAuthStateChanged(function (u) {
          usuario = u;
          if (!u) return avisar();
          db.collection("usuarios").doc(u.uid).get()
            .then(function (doc) {
              var remotos = (doc.exists && doc.data().salvos) || [];
              salvos = mesclar(salvos, remotos);
              gravarLocal();
              sincronizar();
            })
            .catch(function (e) { console.warn("Falha ao ler salvos:", e.message); })
            .then(avisar);
        });
        return true;
      })
      .catch(function (e) {
        console.warn(e.message);
        configurado = false;
        window.ThothConta.configurado = false;
        return false;
      });
  }

  function entrar(tipo) {
    if (!auth) return Promise.reject(new Error("Login indisponível no momento."));
    var provedor = tipo === "apple" ? new firebase.auth.OAuthProvider("apple.com") : new firebase.auth.GoogleAuthProvider();
    if (tipo === "apple") { provedor.addScope("email"); provedor.addScope("name"); }
    return auth.signInWithPopup(provedor);
  }

  function sair() {
    return auth ? auth.signOut() : Promise.resolve();
  }

  function estaSalvo(u) {
    return salvos.some(function (n) { return n.u === u; });
  }

  function alternar(n) {
    if (!n || !n.u) return;
    if (estaSalvo(n.u)) {
      salvos = salvos.filter(function (x) { return x.u !== n.u; });
    } else {
      salvos.unshift({ u: n.u, t: n.t, s: n.s, d: n.d, k: n.k, img: n.img || "", salvoEm: new Date().toISOString() });
    }
    gravarLocal();
    sincronizar();
    avisar();
  }

  window.ThothConta = {
    configurado: configurado,
    apple: configurado && !!cfg.apple,
    iniciar: iniciar,
    entrar: entrar,
    sair: sair,
    usuario: function () { return usuario; },
    salvos: function () { return salvos.slice(); },
    estaSalvo: estaSalvo,
    alternar: alternar,
    aoMudar: function (f) { ouvintes.push(f); }
  };
})();
