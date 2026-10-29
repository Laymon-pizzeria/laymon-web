/* Cartel animado de "Música en vivo" (sáb 31 oct) con las capas de Luis.
   Un solo motor para el video de anuncios y para el sitio: dibuja el cuadro del segundo t en un <canvas>.
   Todo es determinista (mismo t = mismo cuadro), así el render cuadro por cuadro sale igual que en vivo.
   CartelVivo.cargar(base) -> recursos; CartelVivo.crear(canvas, recursos, {formato, web}) -> {dibuja(t), dur} */
(() => {
  const RED = '#EA1D3B', INK = '#0C0B0B', PAPER = '#FFFDFA';
  // Silueta del cantante en el lienzo de Luis (1920x1920): todo se acomoda alrededor de ella
  const CANT = { x: 530, y: 391, w: 823, h: 1346, cx: 941 };

  // Línea de tiempo (s). Copia el ritmo de la referencia: intro con letras que golpean, corte con desenfoque,
  // escenas de ~2.5 s con cortes duros, cuadros sueltos "subliminales" y cierre con bloques glitch.
  const T = {
    corte1: 1.32, s2: 2.7, flash2: 3.93, corte3: 5.0, barrido: 7.4, s4: 7.8, flash4: 9.6, fin: 11.45,
    bloques: 14.35, negro: 14.8, dur: 15, loopWeb: 11.45
  };
  const BOIL = 12; // cuadros por segundo del "temblor" de stop motion

  const h = (a, b = 0) => { // hash 0..1 determinista
    let x = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
    x = Math.imul(x ^ (x >>> 13), 1274126177); x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  };
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOut = p => 1 - Math.pow(1 - clamp(p), 3);

  const cargaImg = src => new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = src; });

  async function cargar(base, fuentes = base + 'fonts/') {
    // window.CartelVivoDatos: capas ya embebidas (visor de un solo archivo); si no, se piden a base
    const man = window.CartelVivoDatos || await (await fetch(base + 'capas.json')).json();
    const ruta = src => /^data:/.test(src) ? src : base + src;
    const img = {};
    const tareas = [];
    for (const [k, c] of Object.entries(man.capas)) tareas.push(cargaImg(ruta(c.src)).then(i => (img[k] = { ...c, i })));
    man.flechas.forEach((c, n) => tareas.push(cargaImg(ruta(c.src)).then(i => (img['f' + n] = { ...c, i }))));
    man.manchas.forEach((c, n) => tareas.push(cargaImg(ruta(c.src)).then(i => (img['m' + n] = { ...c, i }))));
    tareas.push(cargaImg(ruta(man.papel)).then(i => (img.papel = i)));
    tareas.push(cargaImg(ruta(man.logo)).then(i => (img.logo = i)));
    tareas.push(cargaImg(ruta(man.fantasma)).then(i => (img.fantasma = i)));
    if (fuentes && 'FontFace' in window) {
      for (const [fam, f] of [['Brick-Laymon', 'brick-laymon.woff2'], ['Chelsea Market', 'chelsea-market.woff2']]) {
        if (![...document.fonts].some(x => x.family.replace(/"/g, '') === fam && x.status === 'loaded'))
          tareas.push(new FontFace(fam, `url(${fuentes}${f})`).load().then(x => document.fonts.add(x)).catch(() => {}));
      }
    }
    else if (document.fonts) tareas.push(document.fonts.load('100px "Brick-Laymon"').catch(() => {}));
    await Promise.all(tareas);
    return { man, img, nFlechas: man.flechas.length, nManchas: man.manchas.length };
  }

  // Dónde cae cada mancha roja (lienzo de Luis): x, y centro, giro, escala, cuál
  const MANCHAS = [
    [420, 330, -.3, 1.1, 2], [1500, 420, .22, 1, 0], [300, 780, .12, .9, 5], [1640, 860, -.26, 1.05, 1],
    [380, 1240, -.18, 1, 4], [1560, 1330, .32, .95, 3], [960, 200, .06, .8, 6], [1010, 1620, -.12, 1.2, 7]
  ];

  function crear(canvas, R, opts = {}) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const web = !!opts.web;
    const alto = H / W; // 1.78 (9:16), 1.25 (4:5)
    // Encaje de la silueta: un poco más grande en el sitio (no lleva banda de datos abajo)
    const fh = web ? .74 : alto > 1.5 ? .68 : .64;
    const ft = web ? .15 : alto > 1.5 ? .19 : .17;
    const s = fh * H / CANT.h;
    const ox = W / 2 - CANT.cx * s, oy = ft * H - CANT.y * s;
    const k = W / 1080; // tamaño de trazos de pantalla

    const lienzo = (w = W, hh = H) => { const c = document.createElement('canvas'); c.width = w; c.height = hh; return c; };
    const buf = lienzo(), tmp = lienzo(), den = lienzo();
    const bctx = buf.getContext('2d'), tctx = tmp.getContext('2d'), dctx = den.getContext('2d');

    // Trama de puntos para las letras de la intro (como la impresión de la referencia)
    const trama = (() => {
      const p = lienzo(Math.round(9 * k), Math.round(9 * k)), c = p.getContext('2d');
      c.fillStyle = '#000'; c.beginPath(); c.arc(p.width / 2, p.height / 2, 2.1 * k, 0, 7); c.fill();
      return ctx.createPattern(p, 'repeat');
    })();

    // Dibuja una capa en coordenadas del lienzo de Luis, con temblor y transformaciones opcionales
    function capa(c, g, o = {}) {
      const { dx = 0, dy = 0, rot = 0, esc = 1, alpha = 1, id = 0, temblor = 1, q } = o;
      const paso = q ?? Math.floor(g.t * BOIL);
      const jx = (h(id, paso) - .5) * 9 * temblor, jy = (h(id + 99, paso) - .5) * 9 * temblor;
      const jr = (h(id + 7, paso) - .5) * .014 * temblor;
      const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
      g.ctx.save();
      g.ctx.globalAlpha = alpha;
      g.ctx.translate(ox + (cx + dx + jx) * s, oy + (cy + dy + jy) * s);
      g.ctx.rotate(rot + jr);
      g.ctx.scale(s * esc, s * esc);
      g.ctx.drawImage(c.i, -c.w / 2, -c.h / 2, c.w, c.h);
      g.ctx.restore();
    }

    function papel(c) {
      const p = R.img.papel, r = Math.max(W / p.width, H / p.height);
      c.drawImage(p, (W - p.width * r) / 2, (H - p.height * r) / 2, p.width * r, p.height * r);
    }

    // Garabato rojo en espiral (las "eeee" de la referencia). prog 0..1 = cuánto lleva trazado
    function garabato(c, g, x0, y0, largo, vueltas, radio, grosor, prog, id) {
      const pasos = 160, q = Math.floor(g.t * BOIL);
      c.save(); c.translate(ox, oy); c.scale(s, s);
      c.strokeStyle = RED; c.lineWidth = grosor; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath();
      const n = Math.max(2, Math.floor(pasos * clamp(prog)));
      for (let i = 0; i < n; i++) {
        const u = i / (pasos - 1), th = u * vueltas * Math.PI * 2;
        const j = (h(id + i, q) - .5) * 6;
        const x = x0 + u * largo + Math.cos(th + Math.PI) * radio * .55 + j;
        const y = y0 - Math.sin(th) * radio * (.8 + .2 * Math.sin(u * 7)) + j - u * largo * .12;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke(); c.restore();
    }

    // Texto repetido dentro de la silueta, corriendo en diagonal
    function tapiz(c, g) {
      const fs = 128;
      c.save(); c.translate(ox, oy); c.scale(s, s);
      c.translate(CANT.cx, 1000); c.rotate(-.16);
      c.font = `${fs}px "Brick-Laymon"`; c.fillStyle = PAPER; c.textBaseline = 'middle';
      const frase = 'EN VIVO  ', ancho = c.measureText(frase).width;
      const corre = (g.t * 140) % ancho, q = Math.floor(g.t * BOIL);
      for (let r = -7; r <= 7; r++) {
        const y = r * fs * .92, off = (r % 2 ? ancho * .5 : 0) - corre * (r % 2 ? -1 : 1);
        c.globalAlpha = .82 + h(r + 40, q) * .18;
        for (let x = -ancho * 5; x < ancho * 5; x += ancho) c.fillText(frase, x + off + (h(r, q) - .5) * 6, y);
      }
      c.restore();
    }

    // Capa "dentro de la silueta": cantante + guitarra roja, y encima lo que se le pinte, recortado a su forma
    function dentro(g, pinta, sinGuitarra) {
      dctx.setTransform(1, 0, 0, 1, 0, 0); dctx.clearRect(0, 0, W, H);
      const dg = { ...g, ctx: dctx, sinGuitarra };
      capa(R.img.cantante, dg, { id: 3, temblor: .35 });
      if (!dg.sinGuitarra) capa(R.img.guitarra, dg, { id: 3, temblor: .35 });
      if (pinta) { dctx.globalCompositeOperation = 'source-atop'; pinta(dctx, dg); dctx.globalCompositeOperation = 'source-over'; }
      g.ctx.drawImage(den, 0, 0);
    }

    function gafas(g) {
      const c = g.ctx, q = Math.floor(g.t * 30);
      capa(R.img.gafas, g, { id: 3, temblor: .35 });
      // parpadeo de lentes: blanco, rojo o reflejo partido en RGB durante 2-3 cuadros
      const v = h(Math.floor(q / 3), 77);
      if (v > .74) {
        const L = R.img.lentes, modo = Math.floor(h(q >> 1, 5) * 3);
        c.save();
        if (modo === 0) capa(L, g, { id: 3, temblor: .35, alpha: .95 });
        else if (modo === 1) { c.filter = 'sepia(1) saturate(9) hue-rotate(-50deg)'; capa(L, g, { id: 3, temblor: .35 }); }
        else {
          c.globalCompositeOperation = 'lighter';
          c.filter = 'sepia(1) saturate(12) hue-rotate(200deg)'; capa(L, g, { id: 3, temblor: .35, dx: -6, alpha: .8 });
          c.filter = 'sepia(1) saturate(12) hue-rotate(300deg)'; capa(L, g, { id: 3, temblor: .35, dx: 6, alpha: .8 });
        }
        c.restore();
      }
    }

    function flechas(g, prog = 1, abre = 1) {
      for (let n = 0; n < R.nFlechas; n++) {
        const f = R.img['f' + n];
        const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
        let vx = cx - 960, vy = cy - 900; const L = Math.hypot(vx, vy) || 1; vx /= L; vy /= L;
        const abrir = L * (abre - 1); // en el cartel se abren un poco para dejar aire al logo
        const p = easeOut((prog - h(n, 3) * .35) / .65);
        const lejos = (1 - p) * 1300;
        const pulso = Math.sin(g.t * 5 + n) * 8; // respiran hacia el cantante
        capa(f, g, { id: 200 + n, dx: vx * (lejos + pulso + abrir), dy: vy * (lejos + pulso + abrir), alpha: p > 0 ? 1 : 0 });
      }
    }

    function manchas(g, prog = 1) {
      MANCHAS.forEach(([x, y, r, e, m], n) => {
        const c = R.img['m' + m]; if (!c) return;
        const p = clamp((prog - n * .04) / .4);
        if (p <= 0) return;
        capa({ ...c, x: x - c.w / 2, y: y - c.h / 2 }, g, { id: 300 + n, rot: r, esc: e * 1.25 * (0.9 + .1 * p), temblor: 1.4 });
      });
    }

    function logo(g) {
      const L = R.img.logo, w = 440, hL = w * L.height / L.width;
      capa({ i: L, x: CANT.cx - w / 2, y: 235 - hL / 2, w, h: hL }, g, { id: 9, temblor: .6 });
    }

    // Letras de la intro: golpe de escala con trama
    function intro(g) {
      const c = g.ctx;
      papel(c);
      const lineas = ['clasicos-0', 'clasicos-1', 'clasicos-2'], ent = [.22, .5, .78];
      const zoom = 1 + clamp((g.t - .2) / 1.2) * .1;
      c.save(); c.translate(W / 2, H * .45); c.scale(zoom, zoom); c.rotate(-.04 + g.t * .02); c.translate(-W / 2, -H * .45);
      // las letras se dibujan en tmp para tramarlas
      tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.clearRect(0, 0, W, H);
      const tg = { ...g, ctx: tctx };
      lineas.forEach((n, i) => {
        const d = g.t - ent[i]; if (d < 0) return;
        const golpe = d < .1 ? 1.35 - d * 3.5 : 1;
        capa(R.img[n], tg, { id: 500 + i, esc: golpe * .74, dx: -20, dy: (i - 1) * 40 + 120, alpha: d < .033 ? .5 : 1, temblor: 1.2 });
      });
      tctx.globalCompositeOperation = 'destination-out'; tctx.globalAlpha = .55;
      tctx.fillStyle = trama; tctx.fillRect(0, 0, W, H);
      tctx.globalCompositeOperation = 'source-over'; tctx.globalAlpha = 1;
      c.drawImage(tmp, 0, 0);
      c.restore();
      flechas(g, clamp((g.t - .95) / .4));
    }

    // Escenas del cartel
    function cartel(g, escena) {
      const c = g.ctx;
      papel(c);
      manchas(g, clamp((g.t - T.corte1) / .5 + (web && g.t > T.loopWeb ? 1 : 0)));
      if (escena === 4 || escena === 5) capa(R.img['clasicos-negro'], g, { id: 600, temblor: 1, alpha: .92 });
      flechas(g, 1, 1.2);
      logo(g);
      if (escena === 1) dentro(g, (dc, dg) => tapiz(dc, dg));
      else if (escena === 2 || escena === 5) dentro(g, (dc, dg) => capa(R.img['por-miguel'], dg, { id: 610, esc: 1.45, temblor: .8 }));
      else if (escena === 4) dentro(g, (dc, dg) => capa(R.img['31oct-blanco'], dg, { id: 620, esc: 1.3, dy: -10, temblor: .8 }));
      else dentro(g, null, escena === 3);
      gafas(g);
      if (escena === 3) {
        const d = g.t - T.corte3;
        capa(R.img['oct31-rojo'], g, { id: 630, dx: 40, esc: (d < .1 ? 1.25 - d * 2.5 : 1) * .78, temblor: 1.2 });
      }
      if (escena === 4) garabato(c, g, 760, 1270, 420, 5, 70, 34, (g.t - T.s4 - .15) / .6, 700);
    }

    // Banda negra con los datos (solo en el video)
    function banda(g) {
      const c = g.ctx, p = easeOut((g.t - T.fin - .15) / .35);
      if (p <= 0) return;
      const bh = H * (alto > 1.5 ? .135 : .17), y = H * (alto > 1.5 ? .6 : .69);
      c.save();
      c.translate(W / 2 + (1 - p) * W, y); c.rotate(-.045);
      c.fillStyle = INK; c.fillRect(-W * .62, 0, W * 1.24, bh);
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      c.fillStyle = RED; c.font = `${Math.round(bh * .27)}px "Chelsea Market"`;
      c.fillText('Sáb 31 oct · 6 a 9 pm', 0, bh * .37);
      c.fillStyle = PAPER; c.font = `${Math.round(bh * .17)}px "Chelsea Market"`;
      c.fillText('Laymon Pizzería · Coacalco', 0, bh * .62);
      c.font = `${Math.round(bh * .15)}px "Chelsea Market"`; c.globalAlpha = .82;
      c.fillText('Reserva en laymonpizzeria.com', 0, bh * .85);
      c.globalAlpha = 1;
      const fz = R.img.fantasma, fw = bh * 1.05;
      c.drawImage(fz, -W * .47, -fw * 1.12 + Math.sin(g.t * 6) * 4 * k, fw, fw * fz.height / fz.width);
      c.restore();
    }

    // ---------- Efectos de posproducción sobre el cuadro ya dibujado ----------
    const copia = () => { bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.clearRect(0, 0, W, H); bctx.drawImage(canvas, 0, 0); };
    function desenfoque(px, zoom) {
      copia(); ctx.save(); ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
      ctx.filter = `blur(${px * k}px)`;
      ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.drawImage(buf, -W / 2, -H / 2); ctx.restore();
    }
    function rgb(dx) {
      copia(); ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      [['#f00', dx], ['#0f0', 0], ['#00f', -dx]].forEach(([col, d]) => {
        tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.globalCompositeOperation = 'source-over'; tctx.drawImage(buf, 0, 0);
        tctx.globalCompositeOperation = 'multiply'; tctx.fillStyle = col; tctx.fillRect(0, 0, W, H);
        tctx.globalCompositeOperation = 'source-over';
        ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(tmp, d * k, 0);
      });
      ctx.restore();
    }
    function rebanadas(sem, n, amp) {
      copia();
      for (let i = 0; i < n; i++) {
        const y = h(sem, i) * H, hh = (8 + h(sem, i + 50) * 70) * k, d = (h(sem, i + 90) - .5) * 2 * amp * k;
        ctx.drawImage(buf, 0, y, W, hh, d, y, W, hh);
      }
    }
    function bloques(sem, n) {
      copia();
      for (let i = 0; i < n; i++) {
        const w = (40 + h(sem, i) * 380) * k, hh = (20 + h(sem, i + 9) * 160) * k;
        const x = h(sem, i + 18) * W, y = h(sem, i + 27) * H;
        const sx = clamp(x + (h(sem, i + 36) - .5) * 300 * k, 0, W - w), sy = clamp(y + (h(sem, i + 45) - .5) * 200 * k, 0, H - hh);
        ctx.drawImage(buf, sx, sy, w, hh, x, y, w, hh);
        const v = h(sem, i + 54);
        if (v > .6) { ctx.save(); ctx.globalCompositeOperation = v > .85 ? 'difference' : 'multiply'; ctx.fillStyle = v > .85 ? PAPER : RED; ctx.fillRect(x, y, w, hh); ctx.restore(); }
      }
    }

    // Escena según el segundo (con los cuadros sueltos de la referencia)
    function escenaEn(t) {
      if (t < T.corte1) return 0;
      if (t < T.s2) return 1;
      if (t < T.corte3) return Math.abs(t - T.flash2) < .034 ? 1 : 2;
      if (t < T.s4) return 3;
      if (t < T.fin) return Math.abs(t - T.flash4) < .034 ? 2 : 4;
      return 5;
    }

    function dibuja(tReal) {
      let t = tReal;
      if (web && t >= T.loopWeb) t = T.corte1 + ((t - T.loopWeb) % (T.loopWeb - T.corte1));
      const g = { t, ctx };
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-over';
      const e = escenaEn(t);
      if (!web && t >= T.negro) { ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H); return; }
      if (e === 0) intro(g); else cartel(g, e);
      if (e === 3 || (e === 4 && t < T.s4 + .45)) {
        // barrido rojo sobre la cara (como la referencia antes del cambio de escena)
        const d = t - T.barrido;
        if (d >= 0 && d < .55) garabato(ctx, g, 800, 560, 300, 4, 75, 46, d / .2, 800);
      }
      if (!web && e === 5) banda(g);
      if (opts.quieto) return;

      // Cortes con desenfoque y zoom (entrada y salida de cada escena grande)
      const cortes = [T.corte1, T.corte3, T.fin];
      for (const c of cortes) {
        const d = t - c;
        if (d > -.07 && d < .08) { const p = 1 - Math.abs(d) / .08; desenfoque(22 * p, 1 + .08 * p); }
        if (d >= .08 && d < .15) rgb(10);
      }
      if (web && tReal >= T.loopWeb) { // costura del loop del sitio
        const d = ((tReal - T.loopWeb) % (T.loopWeb - T.corte1));
        if (d < .08) desenfoque(22 * (1 - d / .08), 1.08 - d);
      }
      // Golpes cortos de glitch repartidos (deterministas)
      const q = Math.floor(t * 30);
      if (e > 0 && h(q >> 2, 11) > .9) rebanadas(q, 4 + Math.floor(h(q, 2) * 5), 40);
      if (e > 0 && h(q, 12) > .965) rgb(6);
      // Cierre del video: bloques, luego negro
      if (!web && t >= T.bloques) bloques(q, 10 + Math.floor((t - T.bloques) * 60));
    }

    return { dibuja, dur: T.dur, T };
  }

  window.CartelVivo = { cargar, crear };
})();
