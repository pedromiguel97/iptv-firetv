/* TV Aberta: player de IPTV simples para Samsung Tizen e Fire TV (Android)
 * Lista: canais gratuitos do mundo inteiro, agrupados por país, do projeto iptv-org.
 */
(function () {
  'use strict';

  var PLAYLIST_URL = 'https://iptv-org.github.io/iptv/index.country.m3u';
  var PAIS_PRIMEIRO = 'Brazil';  // aparece no topo da lista de países
  var COLUNAS = 4;              // precisa bater com grid-template-columns do CSS
  var TEMPO_LIMITE_MS = 12000;  // quanto esperar um canal começar antes de desistir

  // Códigos de tecla do controle Samsung
  var K = {
    ESQ: 37, CIMA: 38, DIR: 39, BAIXO: 40, OK: 13,
    VOLTAR: 10009, SAIR: 10182, CH_MAIS: 427, CH_MENOS: 428
  };

  var grupos = {};        // país -> lista de canais
  var paises = [];        // nomes dos países, já ordenados
  var nivel = 'paises';   // 'paises' ou 'canais'
  var paisAtual = '';
  var focoPais = 0;
  // Plataforma: Samsung (Tizen) ou Android/Fire TV (WebView com ponte "Android")
  var NA_TIZEN = !!window.tizen;
  var NO_ANDROID = !!window.Android;

  var canais = [];        // canais do país aberto
  var itens = [];         // o que está na grade agora
  var totalTexto = '';
  var foco = 0;
  var atual = -1;
  var hls = null;
  var tentouHls = false;
  var tentouNativo = false;
  var vigia = null;
  var bannerTimer = null;
  var digitos = '';
  var digitoTimer = null;

  var $ = function (id) { return document.getElementById(id); };
  var grid = $('grid'), status = $('status'), guide = $('guide');
  var titulo = $('titulo'), hint = $('hint'), sintonia = $('sintonia');
  var dNum = $('d-num'), dPlaca = $('d-placa'), dLogo = $('d-logo');
  var dTitulo = $('d-titulo'), dSub = $('d-sub'), dAcao = $('d-acao');
  var player = $('player'), video = $('video'), msg = $('player-msg');
  var osd = $('osd'), banner = $('banner');

  // ---------- Teclas extras (números, canal +/-) precisam ser registradas ----------
  function registrarTeclas() {
    if (!window.tizen || !tizen.tvinputdevice) return;
    var teclas = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
                  'ChannelUp', 'ChannelDown', 'Exit'];
    teclas.forEach(function (t) {
      try { tizen.tvinputdevice.registerKey(t); } catch (e) { /* tecla indisponível */ }
    });
  }

  // ---------- Lista M3U ----------
  function baixarLista() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', PLAYLIST_URL);
    xhr.timeout = 15000;
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { localStorage.setItem('ultimaLista', xhr.responseText); } catch (e) {}
        usarLista(xhr.responseText, false);
      } else {
        usarCache('A lista respondeu com erro ' + xhr.status + '.');
      }
    };
    xhr.onerror = function () { usarCache('Sem conexão com a internet.'); };
    xhr.ontimeout = function () { usarCache('A lista demorou demais pra responder.'); };
    xhr.send();
  }

  function usarCache(motivo) {
    var cache = null;
    try { cache = localStorage.getItem('ultimaLista'); } catch (e) {}
    if (cache) {
      usarLista(cache, true);
    } else {
      dTitulo.textContent = 'Sem lista de canais';
      dSub.textContent = motivo + ' Confira a rede e abra o app de novo.';
      status.className = 'erro';
    }
  }

  function lerM3U(texto) {
    var linhas = texto.split(/\r?\n/);
    var lista = [];
    var info = null;
    for (var i = 0; i < linhas.length; i++) {
      var l = linhas[i].trim();
      if (!l) continue;
      if (l.indexOf('#EXTINF') === 0) {
        info = {
          nome: l.substring(virgulaDoNome(l) + 1).trim(),
          logo: atributo(l, 'tvg-logo'),
          grupo: atributo(l, 'group-title')
        };
      } else if (l.charAt(0) !== '#' && info) {
        info.url = l;
        lista.push(info);
        info = null;
      }
    }
    return lista;
  }

  // o nome vem depois da primeira vírgula fora de aspas (o nome pode ter vírgulas)
  function virgulaDoNome(linha) {
    var aspas = false;
    for (var i = 0; i < linha.length; i++) {
      var ch = linha.charAt(i);
      if (ch === '"') aspas = !aspas;
      else if (ch === ',' && !aspas) return i;
    }
    return linha.length - 1;
  }

  function atributo(linha, nome) {
    var m = linha.match(new RegExp(nome + '="([^"]*)"'));
    return m ? m[1] : '';
  }

  function usarLista(texto, doCache) {
    var todos = lerM3U(texto);
    if (!todos.length) {
      status.textContent = 'A lista veio vazia. Tente de novo mais tarde.';
      status.className = 'erro';
      return;
    }
    grupos = {};
    todos.forEach(function (c) {
      var g = c.grupo || 'Outros';
      (grupos[g] = grupos[g] || []).push(c);
    });
    paises = Object.keys(grupos).sort(function (a, b) {
      if (a === PAIS_PRIMEIRO) return -1;
      if (b === PAIS_PRIMEIRO) return 1;
      return a.localeCompare(b);
    });
    status.className = '';
    totalTexto = todos.length + ' canais' + (doCache ? ', lista salva (sem internet agora)' : '');

    var ultimoPais = '';
    try { ultimoPais = localStorage.getItem('ultimoPais') || ''; } catch (e) {}
    var idx = paises.indexOf(ultimoPais);
    abrirPaises(idx >= 0 ? idx : 0);
  }

  function abrirPaises(i) {
    nivel = 'paises';
    titulo.textContent = paises.length + ' países';
    status.textContent = totalTexto;
    legenda(['<b>OK</b> abre o país', '<b>Voltar</b> sai']);
    montarGrade(paises.map(function (p) {
      var n = grupos[p].length;
      return {
        tipo: 'pais',
        num: n + (n === 1 ? ' canal' : ' canais'),
        grande: String(n),
        titulo: p,
        sub: n === 1 ? 'canal pra assistir' : 'canais pra assistir',
        acao: '<b>OK</b> pra ver os canais'
      };
    }));
    focar(i);
  }

  function abrirPais(i) {
    focoPais = i;
    paisAtual = paises[i];
    canais = grupos[paisAtual];
    nivel = 'canais';
    try { localStorage.setItem('ultimoPais', paisAtual); } catch (e) {}
    titulo.textContent = paisAtual;
    status.textContent = canais.length + (canais.length === 1 ? ' canal' : ' canais');
    legenda(NA_TIZEN
      ? ['<b>OK</b> assiste', '<b>0–9</b> vai direto pro canal', '<b>Voltar</b> volta aos países']
      : ['<b>OK</b> assiste', '<b>▲ ▼</b> troca de canal assistindo', '<b>Voltar</b> volta aos países']);
    montarGrade(canais.map(function (c, n) {
      return {
        tipo: 'canal',
        num: numero(n),
        titulo: c.nome,
        logo: c.logo,
        sub: paisAtual,
        acao: '<b>OK</b> pra assistir'
      };
    }));
    var ultimo = 0;
    try { ultimo = parseInt(localStorage.getItem('ultimoCanal:' + paisAtual) || '0', 10); } catch (e) {}
    focar(ultimo < canais.length ? ultimo : 0);
  }

  function legenda(lista) {
    hint.innerHTML = lista.map(function (t) { return '<span>' + t + '</span>'; }).join('');
  }

  // ---------- Grade ----------
  function montarGrade(lista) {
    itens = lista;
    grid.className = nivel;
    var frag = document.createDocumentFragment();
    lista.forEach(function (it) {
      var li = document.createElement('li');
      li.className = 'item ' + it.tipo;

      if (it.tipo === 'canal') {
        var placa = document.createElement('div');
        placa.className = 'placa';
        if (it.logo) {
          var img = document.createElement('img');
          img.loading = 'lazy';
          img.src = it.logo;
          img.alt = '';
          img.onerror = function () {
            img.remove();
            placa.className = 'placa vazia largo';
            placa.textContent = it.num;
          };
          placa.appendChild(img);
        } else {
          placa.className = 'placa vazia largo';
          placa.textContent = it.num;
        }
        li.appendChild(placa);

        var rodape = document.createElement('div');
        rodape.className = 'rodape';
        rodape.appendChild(texto('span', 'num largo', it.num));
        rodape.appendChild(texto('span', 'nome', it.titulo));
        li.appendChild(rodape);
      } else {
        li.appendChild(texto('span', 'nome', it.titulo));
        li.appendChild(texto('span', 'num', it.num));
      }

      frag.appendChild(li);
    });
    grid.innerHTML = '';
    grid.scrollTop = 0;
    grid.appendChild(frag);
  }

  function texto(tag, classe, conteudo) {
    var el = document.createElement(tag);
    el.className = classe;
    el.textContent = conteudo;
    return el;
  }

  function atualizarDestaque(it) {
    if (!it) return;
    dNum.textContent = it.tipo === 'canal' ? it.num : it.grande;
    dTitulo.textContent = it.titulo;
    dSub.textContent = it.sub || '';
    dAcao.innerHTML = it.acao || '';
    if (it.logo) {
      dPlaca.hidden = false;
      dLogo.src = it.logo;
      dLogo.onerror = function () { dPlaca.hidden = true; };
    } else {
      dPlaca.hidden = true;
      dLogo.removeAttribute('src');
    }
  }

  function numero(i) {
    var n = String(i + 1);
    while (n.length < 2) n = '0' + n;
    return n;
  }

  function focar(i) {
    var total = grid.children.length;
    if (!total) return;
    i = Math.max(0, Math.min(total - 1, i));
    var antigo = grid.querySelector('.foco');
    if (antigo) antigo.classList.remove('foco');
    foco = i;
    var novo = grid.children[foco];
    novo.classList.add('foco');
    novo.scrollIntoView({ block: 'nearest' });
    atualizarDestaque(itens[foco]);
  }

  // ---------- Player ----------
  function tocar(i) {
    if (!canais.length) return;
    i = (i + canais.length) % canais.length;   // canal +/- dá a volta na lista
    atual = i;
    foco = i;
    try { localStorage.setItem('ultimoCanal:' + paisAtual, String(i)); } catch (e) {}

    pararVideo();
    guide.hidden = true;
    player.hidden = false;
    mostrarMsg('');
    mostrarBanner('Sintonizando…');

    tentouHls = false;
    tentouNativo = false;
    // Na Samsung o player nativo é o melhor; no Android, o hls.js é mais estável
    if (NA_TIZEN || !window.Hls || !Hls.isSupported()) tocarNativo(canais[i].url);
    else tocarComHls(canais[i].url);
  }

  // Player nativo do aparelho
  function tocarNativo(url) {
    tentouNativo = true;
    limparVideo();
    video.src = url;
    video.load();
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
    armarVigia();
  }

  // hls.js, para streams que o player nativo recusar
  function tocarComHls(url) {
    tentouHls = true;
    if (!window.Hls || !Hls.isSupported()) { falhou(); return; }
    limparVideo();
    hls = new Hls({ manifestLoadingTimeOut: 10000 });
    hls.on(Hls.Events.ERROR, function (_, d) { if (d.fatal) falhou(); });
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, function () {
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    });
    armarVigia();
  }

  function falhou() {
    if (atual < 0) return;
    if (!tentouHls) tocarComHls(canais[atual].url);
    else if (!tentouNativo) tocarNativo(canais[atual].url);
    else desistir();
  }

  function desistir() {
    limparVigia();
    sintonia.hidden = true;
    mostrarBanner('Fora do ar');
    mostrarMsg('Este canal não está transmitindo agora.\nUse ▲ ▼ pra trocar de canal, ou Voltar pra grade.');
  }

  function armarVigia() {
    limparVigia();
    vigia = setTimeout(falhou, TEMPO_LIMITE_MS);
  }
  function limparVigia() { if (vigia) { clearTimeout(vigia); vigia = null; } }

  video.addEventListener('playing', function () {
    limparVigia();
    mostrarMsg('');
    mostrarBanner('Ao vivo');
  });
  video.addEventListener('error', function () {
    // erro do player nativo; com hls.js ativo, quem avisa é o próprio hls
    if (!hls) falhou();
  });

  function limparVideo() {
    if (hls) { hls.destroy(); hls = null; }
    video.removeAttribute('src');
    video.load();
  }

  function pararVideo() {
    limparVigia();
    limparVideo();
  }

  function voltarParaGrade() {
    pararVideo();
    sintonia.hidden = true;
    atual = -1;
    player.hidden = true;
    guide.hidden = false;
    focar(foco);
  }

  function mostrarBanner(info) {
    var c = canais[atual];
    if (!c) return;
    var aoVivo = info === 'Ao vivo';
    $('banner-num').textContent = numero(atual);
    $('banner-name').textContent = c.nome;
    var el = $('banner-info');
    el.textContent = info || paisAtual;
    el.className = aoVivo ? 'vivo' : '';
    sintonia.hidden = info !== 'Sintonizando…';
    banner.classList.remove('some');
    clearTimeout(bannerTimer);
    if (aoVivo) {
      bannerTimer = setTimeout(function () { banner.classList.add('some'); }, 4000);
    }
  }

  function mostrarMsg(texto) {
    msg.hidden = !texto;
    msg.textContent = texto;
  }

  // ---------- Número do canal digitado ----------
  function digitar(d) {
    if (digitos.length >= 3) digitos = '';
    digitos += d;
    osd.textContent = digitos;
    osd.hidden = false;
    clearTimeout(digitoTimer);
    digitoTimer = setTimeout(function () {
      var n = parseInt(digitos, 10) - 1;
      digitos = '';
      osd.hidden = true;
      if (n >= 0 && n < canais.length) tocar(n);
    }, 1500);
  }

  // ---------- Controle remoto ----------
  document.addEventListener('keydown', function (e) {
    if (tratarTecla(e.keyCode)) e.preventDefault();
  });

  // No Fire TV, o app Android repassa as teclas do controle por aqui
  window.tvTecla = function (k) { tratarTecla(k); };

  // devolve true quando a tecla foi usada pelo app
  function tratarTecla(k) {
    if (k >= 48 && k <= 57) {
      if (nivel === 'canais') digitar(String(k - 48));
      return true;
    }

    if (k === K.SAIR) { sair(); return true; }

    var assistindo = !player.hidden;

    if (assistindo) {
      switch (k) {
        case K.VOLTAR: voltarParaGrade(); break;
        case K.CIMA: case K.CH_MAIS: tocar(atual + 1); break;
        case K.BAIXO: case K.CH_MENOS: tocar(atual - 1); break;
        case K.ESQ: case K.DIR: case K.OK:
          mostrarBanner(video.paused ? '' : 'Ao vivo'); break;
        default: return false;
      }
    } else {
      switch (k) {
        case K.ESQ: focar(foco - 1); break;
        case K.DIR: focar(foco + 1); break;
        case K.CIMA: focar(foco - COLUNAS); break;
        case K.BAIXO: focar(foco + COLUNAS); break;
        case K.OK:
          if (nivel === 'paises') abrirPais(foco); else tocar(foco);
          break;
        case K.CH_MAIS: if (nivel === 'canais') tocar(foco + 1); break;
        case K.CH_MENOS: if (nivel === 'canais') tocar(foco - 1); break;
        case K.VOLTAR:
          if (nivel === 'canais') abrirPaises(focoPais); else sair();
          break;
        default: return false;
      }
    }
    return true;
  }

  function sair() {
    pararVideo();
    if (NO_ANDROID) { try { Android.sair(); } catch (e) {} return; }
    try { tizen.application.getCurrentApplication().exit(); } catch (e) {}
  }

  // Pausa o vídeo quando o app vai para segundo plano
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && !player.hidden) video.pause();
    else if (!document.hidden && !player.hidden) video.play();
  });

  registrarTeclas();
  baixarLista();
})();
