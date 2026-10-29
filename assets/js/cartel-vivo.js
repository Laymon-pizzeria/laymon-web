/* Cartel animado "Música en vivo" (sáb 31 oct, Miguel Rocha) — v2.
   Un solo motor para el video del anuncio y para la sección del sitio. Dibuja el cuadro del segundo t
   en un <canvas>; mismo t = mismo cuadro (todo es determinista), así el render cuadro por cuadro
   sale igual que en vivo. Va al ritmo del riff de Miguel: 120 BPM, un cambio de escena por compás.
   CartelVivo.cargar(base) -> recursos · CartelVivo.crear(canvas, recursos, opts) -> { dibuja(t), dur } */
(() => {
  const RED = '#EA1D3B', INK = '#0C0B0B', PAPER = '#FFFDFA';
  const FUENTE = '"Brick-Laymon"', FUENTE2 = '"Chelsea Market"';

  // Ritmo (sacado del audio de Miguel): pulso cada 0.4988 s desde 0.18 s; compás = 4 pulsos
  const P = 0.4988, F0 = 0.18;
  const pulso = k => F0 + k * P, compas = n => pulso(n * 4);
  const DUR = 16;
  // Golpes de la guitarra (corcheas del riff) para disparar glitches; se completan con ritmo.json si llega
  let GOLPES = [];

  // Silueta en el lienzo de Luis (1920x1920): todo se acomoda alrededor de ella
  const CANT = { x: 530, y: 391, w: 823, h: 1346, cx: 941 };
  const ARO = { x: 952, y: 880 };          // centro del aro de flechas
  const TORSO = { x: 848, y: 905, w: 480, h: 470 }; // donde va el texto dentro del cuerpo + guitarra (medido en la máscara)

  // Escenas del video, una por compás. fondo: papel | tinta | rojo. gig: texto rojo ampliado (textura).
  const ESCENAS = [
    { id: 'intro' },
    { id: 'envivo', fondo: 'papel', gig: ['EN', 'VIVO'], dentro: { tapiz: 'EN VIVO' }, entra: 'zoom' },
    { id: 'miguel', fondo: 'papel', gig: ['MIGUEL'], dentro: ['MIGUEL', 'ROCHA'], entra: 'parpadeo' },
    { id: 'clasicos', fondo: 'tinta', gig: ['ROCK'], dentro: ['CLÁSICOS', 'DEL ROCK'], entra: 'invierte' },
    { id: 'fecha', fondo: 'papel', gig: ['31'], dentro: ['SÁB', '31', 'OCT'], entra: 'barrido' },
    { id: 'hora', fondo: 'rojo', gig: ['6PM'], dentro: ['6 A 9', 'PM'], entra: 'rebanadas' },
    { id: 'oldies', fondo: 'papel', gig: ['OLDIES'], dentro: ['OLDIES', 'EN', 'ACÚSTICO'], entra: 'zoom' },
    { id: 'cierre', fondo: 'papel', gig: ['EN', 'VIVO'], dentro: ['MIGUEL', 'ROCHA'], entra: 'parpadeo', cierre: true }
  ];
  // En el sitio: loop sobre rojo (entre el hero negro y las pizzas en papel), sin intro ni banda de datos
  // y sin destellos de pantalla completa
  const ESCENAS_WEB = [
    { id: 'envivo', fondo: 'rojo', gig: ['EN', 'VIVO'], dentro: { tapiz: 'EN VIVO' }, entra: 'zoom' },
    { id: 'miguel', fondo: 'rojo', gig: ['MIGUEL'], dentro: ['MIGUEL', 'ROCHA'], entra: 'parpadeo' },
    { id: 'fecha', fondo: 'rojo', gig: ['31 OCT'], dentro: ['SÁB', '31', 'OCT'], entra: 'rebanadas' },
    { id: 'oldies', fondo: 'rojo', gig: ['OLDIES'], dentro: ['OLDIES', 'EN', 'ACÚSTICO'], entra: 'zoom' }
  ];

  const h = (a, b = 0) => { // hash 0..1 determinista
    let x = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
    x = Math.imul(x ^ (x >>> 13), 1274126177); x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  };
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOut = p => 1 - Math.pow(1 - clamp(p), 3);
  const easeIn = p => Math.pow(clamp(p), 3);
  const resorte = (u, k = 7, w = 15) => u < 0 ? 0 : Math.exp(-k * u) * Math.cos(w * u); // 1 -> 0 con rebote

  const cargaImg = src => new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = src; });

  async function cargar(base, fuentes = base + 'fonts/') {
    // window.CartelVivoDatos: capas ya embebidas (visor de un solo archivo); si no, se piden a base
    const man = window.CartelVivoDatos || await (await fetch(base + 'capas.json')).json();
    const ruta = src => /^data:/.test(src) ? src : base + src;
    const img = {}, tareas = [];
    for (const [k, c] of Object.entries(man.capas)) tareas.push(cargaImg(ruta(c.src)).then(i => (img[k] = { ...c, i })));
    man.flechas.forEach((c, n) => tareas.push(cargaImg(ruta(c.src)).then(i => (img['f' + n] = { ...c, i }))));
    for (const k of ['papel', 'papel2', 'grano', 'logo']) if (man[k]) tareas.push(cargaImg(ruta(man[k])).then(i => (img[k] = i)));
    (man.fantasmas || []).forEach((f, n) => tareas.push(cargaImg(ruta(f)).then(i => (img['fz' + n] = i))));
    if (man.ritmo) tareas.push(fetch(ruta(man.ritmo)).then(r => r.json()).then(r => { GOLPES = r.onsets; }).catch(() => {}));
    if (fuentes && 'FontFace' in window) {
      for (const [fam, f] of [['Brick-Laymon', 'brick-laymon.woff2'], ['Chelsea Market', 'chelsea-market.woff2']])
        tareas.push(new FontFace(fam, `url(${fuentes}${f})`).load().then(x => document.fonts.add(x)).catch(() => {}));
    } else if (document.fonts) tareas.push(document.fonts.load(`100px ${FUENTE}`).catch(() => {}));
    await Promise.all(tareas);
    if (document.fonts) await Promise.all([document.fonts.load(`100px ${FUENTE}`), document.fonts.load(`40px ${FUENTE2}`)]).catch(() => {});
    return { man, img, nFlechas: man.flechas.length, nFantasmas: (man.fantasmas || []).length };
  }

  function crear(canvas, R, opts = {}) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, web = !!opts.web;
    const k = Math.min(W, H) / 1080; // escala de trazos de pantalla
    // Encuadre: dónde cae la silueta. En el sitio lo decide la página (opts.encuadre)
    const enc = opts.encuadre ? opts.encuadre(W, H) : (() => {
      const alto = H / W > 1.5 ? .86 : .84;
      const s = alto * H / CANT.h;
      return { s, cx: W / 2, top: H * (H / W > 1.5 ? .135 : .13), rx: .56 * W, ry: H / W > 1.5 ? .5 * H : .47 * H };
    })();
    const s = enc.s, ox = enc.cx - CANT.cx * s, oy = enc.top - CANT.y * s;
    const X = d => ox + d * s, Y = d => oy + d * s;
    const kx = enc.rx / 750, ky = enc.ry / 750; // aro de flechas: se estira para llenar el cuadro

    const lienzo = (w = W, hh = H) => { const c = document.createElement('canvas'); c.width = w; c.height = hh; return c; };
    const A = lienzo(), B = lienzo(), T1 = lienzo(), T2 = lienzo();
    const a = A.getContext('2d'), b = B.getContext('2d'), t1 = T1.getContext('2d'), t2 = T2.getContext('2d');
    // guitarra en su propio lienzo para el glitch
    const gw = Math.ceil((R.img.guitarra.w + 160) * s), gh = Math.ceil((R.img.guitarra.h + 160) * s);
    const G = lienzo(gw, gh), gx = G.getContext('2d');
    const grano = R.img.grano ? ctx.createPattern(R.img.grano, 'repeat') : null;
    const trama = (() => {
      const p = lienzo(Math.max(4, Math.round(8 * k)), Math.max(4, Math.round(8 * k))), c = p.getContext('2d');
      c.fillStyle = '#000'; c.beginPath(); c.arc(p.width / 2, p.height / 2, 1.9 * k, 0, 7); c.fill();
      return ctx.createPattern(p, 'repeat');
    })();

    const escenas = web ? ESCENAS_WEB : ESCENAS;
    const LOOP = escenas.length * 4 * P; // duración del loop web

    // ---------- Reloj musical ----------
    function reloj(t) {
      if (web) {
        const u = ((t % LOOP) + LOOP) % LOOP, n = Math.floor(u / (4 * P));
        return { t: u + compas(1), n, sc: escenas[n], ant: escenas[(n + escenas.length - 1) % escenas.length], tb: compas(1) + n * 4 * P, tAbs: t };
      }
      const n = t < compas(1) ? 0 : Math.min(7, Math.floor((t - F0) / (4 * P)));
      return { t, n, sc: escenas[n], ant: escenas[Math.max(0, n - 1)], tb: compas(n), tAbs: t };
    }
    // intensidad del último golpe de guitarra (0..1, cae en 0.14 s)
    function golpe(t) {
      let v = 0;
      if (GOLPES.length && !web) { for (const [g, f] of GOLPES) { const u = t - g; if (u >= 0 && u < .2) v = Math.max(v, Math.min(1, f / 3) * Math.exp(-u / .07)); } }
      else { const u = ((t - F0) % (P / 2) + P / 2) % (P / 2); v = Math.exp(-u / .07) * (.55 + .45 * h(Math.floor((t - F0) / (P / 2)), 4)); }
      return v;
    }
    const enPulso = t => { const u = ((t - F0) % P + P) % P; return Math.exp(-u / .09); };

    // ---------- Primitivas en coordenadas del lienzo de Luis ----------
    function capa(c, L, o = {}) {
      const { dx = 0, dy = 0, rot = 0, esc = 1, alpha = 1, id = 0, temblor = 1, t = 0 } = o;
      const paso = Math.floor(t * 5); // stop motion a 5 cuadros/s, como la referencia
      const jx = (h(id, paso) - .5) * 8 * temblor, jy = (h(id + 99, paso) - .5) * 8 * temblor;
      const jr = (h(id + 7, paso) - .5) * .02 * temblor;
      c.save(); c.globalAlpha = alpha;
      c.translate(X(L.x + L.w / 2 + dx + jx), Y(L.y + L.h / 2 + dy + jy));
      c.rotate(rot + jr); c.scale(s * esc, s * esc);
      c.drawImage(L.i, -L.w / 2, -L.h / 2, L.w, L.h);
      c.restore();
    }
    function tinte(c, color) { c.save(); c.globalCompositeOperation = 'source-in'; c.fillStyle = color; c.fillRect(0, 0, W, H); c.restore(); }
    const limpia = c => { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.filter = 'none'; c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H); };
    const raspa = (c, fuerza, sem) => { // grano de brocha seca: le come pintura a lo ya dibujado
      if (!grano) return;
      c.save(); c.globalCompositeOperation = 'destination-out'; c.globalAlpha = fuerza;
      c.translate((h(sem, 1) * 512) | 0, (h(sem, 2) * 512) | 0); c.fillStyle = grano; c.fillRect(-512, -512, W + 1024, H + 1024); c.restore();
    };

    // ---------- Fondo ----------
    const fondos = new Map();
    function fondo(c, tipo, t) {
      if (web) { // en el sitio el fondo no tiembla: se pinta una vez y se reusa
        let f = fondos.get(tipo);
        if (!f) { f = lienzo(); fondos.set(tipo, f); fondoReal(f.getContext('2d'), tipo, 0, 0); }
        c.drawImage(f, 0, 0); return;
      }
      fondoReal(c, tipo, (h(Math.floor(t * 5), 31) - .5) * 6 * k, (h(Math.floor(t * 5), 32) - .5) * 6 * k);
    }
    function fondoReal(c, tipo, dx, dy) {
      const p = web ? (R.img.papel2 || R.img.papel) : (W / H < .7 ? R.img.papel : (R.img.papel2 || R.img.papel));
      const r = Math.max(W / p.width, H / p.height) * 1.04;
      if (tipo === 'papel') { c.drawImage(p, (W - p.width * r) / 2 + dx, (H - p.height * r) / 2 + dy, p.width * r, p.height * r); return; }
      c.fillStyle = tipo === 'rojo' ? RED : INK; c.fillRect(0, 0, W, H);
      c.save(); c.globalCompositeOperation = tipo === 'rojo' ? 'multiply' : 'soft-light'; c.globalAlpha = tipo === 'rojo' ? .9 : .55;
      c.drawImage(p, (W - p.width * r) / 2 + dx, (H - p.height * r) / 2 + dy, p.width * r, p.height * r); c.restore();
    }

    // Texto rojo ampliado: textura gigante detrás del cantante (sustituye a las manchas)
    // En el sitio las capas caras se re-dibujan a 12 cuadros/s y se reusan entre cuadros (stop motion de todos modos)
    const cacheW = web ? { g: lienzo(), gk: '', d: lienzo(), dk: '' } : null;
    function gigante(c, lineas, color, t, tb, sem, alpha = 1) {
      const u = t - tb, fs = web ? H * .4 : H * .3;
      const XC = web ? cacheW.g : T1, t1 = XC.getContext('2d');
      const clave = web && [lineas.join(), color, Math.floor(t * 12), u < .1 ? Math.floor(u * 30) : ''].join('|');
      if (web && clave === cacheW.gk) { c.globalAlpha = alpha; c.drawImage(XC, 0, 0); c.globalAlpha = 1; return; }
      if (web) cacheW.gk = clave;
      limpia(t1);
      const golpeE = u < .1 ? 1.25 - u * 2.5 : 1;
      const paso = Math.floor(t * 5);
      t1.save();
      t1.translate(X(ARO.x) + (h(paso, sem) - .5) * 10 * k, Y(ARO.y) + (h(paso, sem + 3) - .5) * 10 * k);
      t1.rotate(-.13 + (h(paso, sem + 5) - .5) * .015);
      t1.scale(golpeE, golpeE);
      t1.font = `${Math.round(fs)}px ${FUENTE}`; t1.textAlign = 'center'; t1.textBaseline = 'middle'; t1.fillStyle = color;
      // dos franjas (arriba y abajo del torso) que corren en sentidos contrarios y asoman por los dos lados
      const deriva = u * 70 * k;
      const filas = lineas.length > 1 ? lineas : [lineas[0], lineas[0]];
      filas.forEach((L, i) => {
        const y = (i ? .34 : -.3) * H;
        t1.fillText(L, (i ? -1 : 1) * (deriva - W * .06), y);
      });
      t1.restore();
      raspa(t1, .75, paso + sem);
      c.globalAlpha = alpha; c.drawImage(XC, 0, 0); c.globalAlpha = 1;
    }

    // Aro de flechas: se abren y se cierran en cada cambio de escena, respiran en cada pulso
    function flechas(c, t, abre, entrada = 1) {
      const pul = enPulso(t) * .035;
      for (let n = 0; n < R.nFlechas; n++) {
        const f = R.img['f' + n];
        const fx = f.x + f.w / 2 - ARO.x, fy = f.y + f.h / 2 - ARO.y;
        const lejos = (1 - easeOut((entrada - h(n, 3) * .3) / .7)) * 2.4; // entrada desde fuera
        if (entrada < 1 && lejos > 2.3) continue;
        const r = (abre + pul + lejos) * (1 + (h(n, 9) - .5) * .06);
        const paso = Math.floor(t * 5);
        const jx = (h(200 + n, paso) - .5) * 7 * k, jy = (h(300 + n, paso) - .5) * 7 * k, jr = (h(400 + n, paso) - .5) * .05;
        const esc = Math.min(1.25, s * .95) * (.92 + .1 * Math.sqrt(abre));
        const px = X(ARO.x) + fx * kx * r + jx, py = Y(ARO.y) + fy * ky * r + jy;
        if (zonaLogo && Math.abs(px - zonaLogo.x) < zonaLogo.w && py < zonaLogo.y) continue; // aire para el logo
        c.save(); c.translate(px, py);
        c.rotate(Math.atan2(fy * ky, fx * kx) - Math.atan2(fy, fx) + jr); // el aro se estira: cada flecha sigue apuntando al centro
        c.scale(esc, esc); c.drawImage(f.i, -f.w / 2, -f.h / 2, f.w, f.h); c.restore();
      }
    }

    const zonaLogo = web ? null : { x: W / 2, w: W * .2, y: H * .15 };
    function logo(c, color, t) {
      const L = R.img.logo; if (!L || web) return;
      const w = Math.min(W * .26, 300 * k), hL = w * L.height / L.width, y = H * (H / W > 1.5 ? .035 : .025);
      const paso = Math.floor(t * 5), g = golpe(t);
      limpia(t2);
      t2.drawImage(L, W / 2 - w / 2 + (h(paso, 50) - .5) * 4 * k, y + (h(paso, 51) - .5) * 4 * k, w, hL);
      if (color !== INK) tinte(t2, color);
      if (g > .75) { // glitch del logo como en el CSS maestro de Justo
        c.save(); c.globalAlpha = .8; c.drawImage(T2, -10 * k * g, 0); c.globalCompositeOperation = 'source-over'; c.restore();
        c.save(); c.globalAlpha = .7; c.filter = 'none'; c.drawImage(T2, 0, 0, W, y + hL * .5, 14 * k * g, 0, W, y + hL * .5); c.restore();
      }
      c.drawImage(T2, 0, 0);
    }

    // ---------- Cantante ----------
    function cuerpo(c, color, t) {
      if (color === INK) { capa(c, R.img.cuerpo, { id: 3, temblor: .3, t }); return; }
      limpia(t2); capa(t2, R.img.cuerpo, { id: 3, temblor: .3, t });
      if (color !== INK) tinte(t2, color);
      c.drawImage(T2, 0, 0);
    }

    // Guitarra con glitch propio: rebanadas desplazadas, registro corrido cian/papel y estirones de píxel
    function guitarra(c, color, t, extra = 0) {
      const L = R.img.guitarra, m = 80;
      if (G.color !== color) { // el lienzo base solo cambia con el color
        G.color = color;
        gx.setTransform(1, 0, 0, 1, 0, 0); gx.clearRect(0, 0, gw, gh);
        gx.drawImage(L.i, m * s, m * s, L.w * s, L.h * s);
        if (color !== RED) { gx.globalCompositeOperation = 'source-in'; gx.fillStyle = color; gx.fillRect(0, 0, gw, gh); gx.globalCompositeOperation = 'source-over'; }
      }
      const g = web ? clamp(.1 + golpe(t) * .55) : clamp(.18 + golpe(t) * .9 + extra);
      const q = Math.floor(t * 30), q2 = q >> 1;
      const bx = X(L.x) - m * s, by = Y(L.y) - m * s;
      const paso = Math.floor(t * 5);
      const jx = (h(3, paso) - .5) * 8 * .3 * s, jy = (h(102, paso) - .5) * 8 * .3 * s;
      c.save(); c.translate(jx, jy);
      // registro corrido: copias de color por debajo
      const off = (3 + 16 * g) * k;
      c.globalAlpha = .85;
      c.filter = 'none';
      c.save(); c.globalAlpha = .75 * g + .2; c.drawImage(teñida(G, '#22D3EE'), bx - off, by + off * .2); c.restore();
      c.save(); c.globalAlpha = .7 * g + .15; c.drawImage(teñida(G, color === PAPER ? INK : PAPER), bx + off * .8, by - off * .15); c.restore();
      c.globalAlpha = 1;
      // rebanadas
      const N = 14, alto = gh / N;
      for (let i = 0; i < N; i++) {
        const r = h(q2 * 31 + i, 7);
        const d = r > 1 - g * .75 ? (h(q2 + i * 13, 8) - .5) * 2 * (20 + 110 * g) * k : 0;
        const y0 = Math.round(i * alto), hh = Math.round(alto + 1);
        c.drawImage(G, 0, y0, gw, hh, bx + d, by + y0, gw, hh);
      }
      // estirón de píxel (datamosh) en los golpes fuertes
      if (g > .55) {
        const y = Math.floor(h(q2, 21) * gh * .8 + gh * .1), hh = (14 + h(q2, 22) * (web ? 30 : 80)) * k;
        c.globalAlpha = .9; c.drawImage(G, 0, y, gw, 2, bx + (h(q2, 23) - .5) * 40 * k, by + y, gw, hh);
        c.globalAlpha = 1;
      }
      // bloque desplazado
      if (g > .7) {
        const bw = gw * (.15 + h(q, 24) * .3), bh = gh * (.06 + h(q, 25) * .12), sx = h(q, 26) * (gw - bw), sy = h(q, 27) * (gh - bh);
        c.drawImage(G, sx, sy, bw, bh, bx + sx + (h(q, 28) - .5) * 80 * k, by + sy, bw, bh);
      }
      c.restore();
    }
    const cacheTinte = new Map();
    function teñida(src, color) { // copia de un lienzo en un solo color (para el registro corrido)
      let e = cacheTinte.get(color);
      if (e) return e; // la silueta de la guitarra no cambia: basta teñirla una vez por color
      e = lienzo(src.width, src.height); cacheTinte.set(color, e);
      const x = e.getContext('2d'); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, e.width, e.height);
      x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, e.width, e.height);
      return e;
    }

    // Gafas: glitch continuo (lentes iridiscentes que cambian cada cuadro, armazón con registro corrido, rebanadas)
    const Gf0 = R.img.gafas, gaW = Math.ceil(Gf0.w * s * 1.6 + 60 * k), gaH = Math.ceil(Gf0.h * s * 1.6 + 30 * k);
    const GA = lienzo(gaW, gaH), ga = GA.getContext('2d'), GB = lienzo(gaW, gaH), gb = GB.getContext('2d');
    function gafas(c, cuerpoClaro, t) {
      const Gf = R.img.gafas, Ln = R.img.lentes, q = Math.floor(t * 30), g = golpe(t);
      const pop = 1 + g * .16, w = Gf.w * s * pop, hh = Gf.h * s * pop;
      const paso = Math.floor(t * 5), jx = (h(3, paso) - .5) * 2.4 * s, jy = (h(102, paso) - .5) * 2.4 * s;
      const cx = X(Gf.x + Gf.w / 2) + jx, cy = Y(Gf.y + Gf.h / 2) + jy, lx = gaW / 2 - w / 2, ly = gaH / 2 - hh / 2;
      // lentes con degradado que gira de tono
      ga.globalCompositeOperation = 'source-over'; ga.clearRect(0, 0, gaW, gaH);
      ga.drawImage(Ln.i, lx, ly, w, hh);
      ga.globalCompositeOperation = 'source-in';
      const hue = (q * 37) % 360, gr = ga.createLinearGradient(lx, 0, lx + w, 0);
      gr.addColorStop(0, `hsl(${hue},95%,62%)`); gr.addColorStop(.5, `hsl(${(hue + 120) % 360},95%,72%)`); gr.addColorStop(1, `hsl(${(hue + 240) % 360},95%,60%)`);
      ga.fillStyle = gr; ga.fillRect(0, 0, gaW, gaH);
      if (h(q, 61) > .65) { ga.fillStyle = 'rgba(255,253,250,.9)'; ga.fillRect(lx, ly + hh * h(q, 62) * .8, w, hh * .22); }
      ga.globalCompositeOperation = 'source-over';
      ga.drawImage(Gf.i, lx + (h(q, 65) - .5) * 3 * k, ly, w, hh);
      // copia teñida para el registro corrido
      const d = (2 + 9 * g + 3 * h(q, 63)) * k;
      c.save(); c.translate(cx - gaW / 2, cy - gaH / 2);
      for (const [col, dd] of [[cuerpoClaro ? '#00B8D9' : '#00E5FF', -d], [cuerpoClaro ? '#D6008F' : '#FF2BD6', d]]) {
        gb.globalCompositeOperation = 'source-over'; gb.clearRect(0, 0, gaW, gaH); gb.drawImage(GA, 0, 0);
        gb.globalCompositeOperation = 'source-in'; gb.fillStyle = col; gb.fillRect(0, 0, gaW, gaH);
        c.globalCompositeOperation = cuerpoClaro ? 'multiply' : 'lighter'; c.globalAlpha = .85; c.drawImage(GB, dd, (h(q, 66) - .5) * 2 * k);
      }
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      // rebanadas
      const N = 5, sl = gaH / N;
      for (let i = 0; i < N; i++) {
        const dd = (h(q * 7 + i, 64) - .5) * (4 + 26 * g) * k;
        c.drawImage(GA, 0, i * sl, gaW, sl + 1, dd, i * sl, gaW, sl + 1);
      }
      if (g > .4) { c.globalAlpha = .75; c.drawImage(Gf.i, lx + d * 1.6, ly - d * .3, w, hh); c.globalAlpha = 1; }
      c.restore();
    }

    // Texto dentro de la silueta (recortado a cuerpo + guitarra)
    function dentro(c, sc, t, tb, colorTexto) {
      const XC = web ? cacheW.d : T1, t1 = XC.getContext('2d'), u0 = t - tb;
      const clave = web && [sc.id, JSON.stringify(sc.dentro), colorTexto, Math.floor(t * 12), u0 < .12 ? Math.floor(u0 * 30) : ''].join('|');
      if (web && clave === cacheW.dk) { c.drawImage(XC, 0, 0); return; } // (la caja está vacía fuera del cantante)
      if (web) cacheW.dk = clave;
      // máscara (cuerpo + guitarra) en T2; el texto va en XC y luego se recorta con destination-in.
      // Todo se limita a la caja del cantante (más barato que el lienzo completo)
      const bx0 = Math.max(0, X(CANT.x - 120)), by0 = Math.max(0, Y(CANT.y - 80)), bw0 = (CANT.w + 240) * s, bh0 = (CANT.h + 160) * s;
      for (const x of [t1, t2]) { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, W, H); x.save(); x.beginPath(); x.rect(bx0, by0, bw0, bh0); x.clip(); }
      capa(t2, R.img.cuerpo, { id: 3, temblor: .3, t });
      capa(t2, R.img.guitarra, { id: 3, temblor: .3, t });
      const u = t - tb, golpeE = u < .1 ? 1.18 - u * 1.8 : 1;
      const paso = Math.floor(t * 5);
      t1.save();
      t1.translate(X(TORSO.x), Y(TORSO.y)); t1.rotate(-.11 + (h(paso, 70) - .5) * .02); t1.scale(golpeE * s, golpeE * s);
      t1.fillStyle = colorTexto; t1.textAlign = 'center'; t1.textBaseline = 'middle';
      const d = sc.dentro;
      if (d.tapiz) {
        const fs = 118; t1.font = `${fs}px ${FUENTE}`;
        const frase = d.tapiz + '  ', an = t1.measureText(frase).width;
        for (let r = -7; r <= 8; r++) {
          const dir = r % 2 ? -1 : 1, off = ((u * 150 * dir) % an) + (r % 2 ? an / 2 : 0);
          for (let x = -an * 4; x < an * 4; x += an) t1.fillText(frase, x + off, r * fs * .9);
        }
      } else {
        // cada renglón ocupa el ancho del torso (los cortes en la orilla son parte del estilo)
        const lineas = d, tam = lineas.map(L => { t1.font = `100px ${FUENTE}`; return Math.min(300, 100 * TORSO.w / Math.max(1, t1.measureText(L).width)); });
        const alto = tam.reduce((x, y) => x + y * .88, 0), red = Math.min(1, TORSO.h / alto);
        tam.forEach((v, i) => (tam[i] = v * red));
        const total = alto * red;
        let y = -total / 2;
        lineas.forEach((L, i) => {
          const fs = tam[i]; y += fs * .44;
          t1.font = `${Math.round(fs)}px ${FUENTE}`;
          const tarde = u - i * .06; // los renglones entran escalonados a corchea corta
          if (tarde >= 0 || u < 0) t1.fillText(L, (h(i, paso) - .5) * 6, y);
          y += fs * .44;
        });
      }
      t1.restore();
      raspa(t1, .5, paso + 9);
      t1.globalCompositeOperation = 'destination-in'; t1.drawImage(T2, 0, 0); t1.globalCompositeOperation = 'source-over';
      t1.restore(); t2.restore();
      c.drawImage(XC, bx0, by0, bw0, bh0, bx0, by0, bw0, bh0);
    }

    // ---------- Una escena completa ----------
    function escena(c, sc, t, tb, abre) {
      const tipo = sc.fondo;
      const cTexto = tipo === 'tinta' ? INK : tipo === 'rojo' ? RED : PAPER;
      const cCuerpo = tipo === 'tinta' ? PAPER : INK;
      const cGig = tipo === 'rojo' ? INK : RED;
      const cFlecha = tipo === 'tinta' ? PAPER : INK;
      const cGuit = tipo === 'rojo' ? PAPER : RED;
      fondo(c, tipo, t);
      // en el sitio, el texto rojo ampliado y las flechas no se meten debajo del texto HTML
      const rc = opts.recorte && opts.recorte(W, H);
      if (rc) { c.save(); c.beginPath(); c.rect(rc.x, rc.y, rc.w, rc.h); c.clip(); }
      gigante(c, sc.gig, cGig, t, tb, 11, web ? .5 : 1);
      // flechas en su lienzo para poder teñirlas
      if (cFlecha === INK) flechas(c, t, abre);
      else { limpia(t2); flechas(t2, t, abre); tinte(t2, cFlecha); c.drawImage(T2, 0, 0); }
      if (rc) c.restore();
      logo(c, tipo === 'tinta' ? PAPER : INK, t);
      cuerpo(c, cCuerpo, t);
      guitarra(c, cGuit, t, sc.cierre ? .1 : 0);
      dentro(c, sc, t, tb, cTexto);
      gafas(c, cCuerpo === PAPER, t);
      if (sc.cierre && !web) banda(c, t, tb);
    }

    // Banda negra con los datos (cierre del video)
    function banda(c, t, tb) {
      const p = easeOut((t - tb - P * .5) / .3);
      if (p <= 0) return;
      const bh = H * (H / W > 1.5 ? .15 : .19), y = H * (H / W > 1.5 ? .6 : .64);
      c.save(); c.translate(W / 2 + (1 - p) * W * 1.2, y); c.rotate(-.05);
      c.fillStyle = INK; c.fillRect(-W * .7, 0, W * 1.4, bh);
      c.fillStyle = RED; c.fillRect(-W * .7, bh - 8 * k, W * 1.4, 8 * k);
      c.textAlign = 'center';
      c.fillStyle = RED; c.font = `${Math.round(bh * .26)}px ${FUENTE2}`; c.fillText('Sáb 31 oct · 6 a 9 pm', 0, bh * .34);
      c.fillStyle = PAPER; c.font = `${Math.round(bh * .16)}px ${FUENTE2}`; c.fillText('Laymon Pizzería · Coacalco', 0, bh * .6);
      c.globalAlpha = .85; c.font = `${Math.round(bh * .135)}px ${FUENTE2}`; c.fillText('Aparta tu mesa: laymonpizzeria.com', 0, bh * .83);
      c.globalAlpha = 1;
      // fantasmas en las orillas de la banda
      const f0 = R.img.fz0, f1 = R.img.fz1;
      const fw = bh * .72, bote = Math.abs(Math.sin((t - F0) / P * Math.PI)) * 10 * k;
      if (f0) c.drawImage(f0, -W * .5, -fw * f0.height / f0.width * .92 - bote, fw, fw * f0.height / f0.width);
      if (f1) c.drawImage(f1, W * .5 - fw, -fw * f1.height / f1.width * .9 - (10 * k - bote), fw, fw * f1.height / f1.width);
      c.restore();
    }

    // ---------- Intro (compás 0): texto propio que golpea al pulso ----------
    function intro(c, t) {
      fondo(c, 'papel', t);
      limpia(t1);
      const paso = Math.floor(t * 5);
      const golpeE = (u, a = 1.5) => u < 0 ? 0 : u < .1 ? a - (a - 1) * (u / .1) : 1;
      // "ESTE" (pulso 0) y "SÁBADO" (pulso 1): se van empujados cuando entra "EN VIVO"
      const fuera = easeOut((t - pulso(2)) / .1);
      const f1s = H * .13, f2s = H * .16;
      t1.save(); t1.translate(W * .5, H * .36); t1.rotate(-.16); t1.scale(1 + fuera * 1.4, 1 + fuera * 1.4); t1.globalAlpha = 1 - fuera;
      t1.textAlign = 'center'; t1.textBaseline = 'middle'; t1.fillStyle = RED;
      const u0 = t - pulso(0), u1 = t - pulso(1);
      if (u0 >= 0) { const e = golpeE(u0); t1.save(); t1.translate(-W * .12 + (h(paso, 1) - .5) * 8, -f2s * .75); t1.scale(e, e); t1.font = `${Math.round(f1s)}px ${FUENTE}`; t1.fillText('ESTE', 0, 0); t1.restore(); }
      if (u1 >= 0) { const e = golpeE(u1); t1.save(); t1.translate(W * .04 + (h(paso, 2) - .5) * 8, f2s * .35); t1.scale(e, e); t1.font = `${Math.round(f2s)}px ${FUENTE}`; t1.fillText('SÁBADO', 0, 0); t1.restore(); }
      t1.restore();
      // "EN VIVO" enorme (pulso 2), con sacudida
      const u2 = t - pulso(2);
      if (u2 >= 0) {
        const e = golpeE(u2, 1.7), sh = u2 < .2 ? (1 - u2 / .2) * 22 * k : 0;
        const sube = easeIn((t - (compas(1) - .3)) / .3); // se encoge al entrar el cantante: pasa a ser la textura del cartel
        const fs = H * .3 * (1 - sube * .18);
        t1.save(); t1.translate(W / 2 + (h(Math.floor(t * 30), 3) - .5) * sh, H * .42 + (h(Math.floor(t * 30), 4) - .5) * sh - sube * H * .03);
        t1.rotate(-.13); t1.scale(e, e); t1.fillStyle = RED; t1.textAlign = 'center'; t1.textBaseline = 'middle';
        t1.font = `${Math.round(fs)}px ${FUENTE}`; t1.fillText('EN', -W * .08, -fs * .43); t1.fillText('VIVO', W * .02, fs * .43);
        t1.restore();
      }
      raspa(t1, .85, paso);
      // trama de imprenta sobre las letras rojas
      t1.save(); t1.globalCompositeOperation = 'destination-out'; t1.globalAlpha = .45; t1.fillStyle = trama; t1.fillRect(0, 0, W, H); t1.restore();
      c.drawImage(T1, 0, 0);
      // flechas que llegan desde fuera (pulso 3) y se cierran sobre el centro
      const ent = clamp((t - pulso(3)) / .45);
      if (ent > 0) { limpia(t2); flechas(t2, t, 1 + .3 * resorte(t - pulso(3) - .45), ent); c.drawImage(T2, 0, 0); }
      // el cantante sube desde abajo con barrido de movimiento
      const sub = clamp((t - (compas(1) - .27)) / .27);
      if (sub > 0) {
        const dy = (1 - easeOut(sub)) * H * .9;
        for (let i = 3; i >= 0; i--) {
          c.save(); c.globalAlpha = i ? .22 : 1; c.translate(0, dy + i * 40 * k * (1 - sub));
          capa(c, R.img.cantante, { id: 3, temblor: .3, t }); c.restore();
        }
      }
    }

    // ---------- Efectos sobre el cuadro ----------
    function copiaA() { limpia(a); a.drawImage(canvas, 0, 0); }
    function rgbSplit(dx) { // en pantalla completa: separa canales
      copiaA(); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      [['#f00', dx], ['#0f0', 0], ['#00f', -dx]].forEach(([col, d]) => {
        limpia(t2); t2.drawImage(A, 0, 0); t2.globalCompositeOperation = 'multiply'; t2.fillStyle = col; t2.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(T2, d * k, 0);
      });
      ctx.restore();
    }
    function zoomBlur(fuerza, z) { // desenfoque radial: varias copias escaladas
      copiaA(); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (let i = 1; i <= 5; i++) { const e = 1 + (z - 1) * i / 5; ctx.globalAlpha = .28; ctx.drawImage(A, W / 2 - W * e / 2, H / 2 - H * e / 2, W * e, H * e); }
      ctx.globalAlpha = 1; if (fuerza > 0) { ctx.filter = `blur(${fuerza * k}px)`; ctx.globalAlpha = .6; ctx.drawImage(canvas, 0, 0); }
      ctx.restore();
    }
    function rebanadas(c, srcA, srcB, sem, n, amp) { // bandas horizontales que mezclan dos cuadros
      for (let i = 0; i < n; i++) {
        const y = h(sem, i) * H, hh = (10 + h(sem, i + 50) * 90) * k, d = (h(sem, i + 90) - .5) * 2 * amp * k;
        c.drawImage(h(sem, i + 120) > .5 ? srcA : srcB, 0, y, W, hh, d, y, W, hh);
      }
    }
    function bloques(sem, n) {
      copiaA();
      for (let i = 0; i < n; i++) {
        const w = (40 + h(sem, i) * 420) * k, hh = (16 + h(sem, i + 9) * 170) * k, x = h(sem, i + 18) * W, y = h(sem, i + 27) * H;
        const sx = clamp(x + (h(sem, i + 36) - .5) * 300 * k, 0, W - w), sy = clamp(y + (h(sem, i + 45) - .5) * 200 * k, 0, H - hh);
        ctx.drawImage(A, sx, sy, w, hh, x, y, w, hh);
        const v = h(sem, i + 54);
        if (v > .62) { ctx.save(); ctx.globalCompositeOperation = v > .86 ? 'difference' : 'multiply'; ctx.fillStyle = v > .86 ? PAPER : RED; ctx.fillRect(x, y, w, hh); ctx.restore(); }
      }
    }

    // Apertura de flechas: se abren antes del cambio y se cierran con rebote después
    function abertura(t, tb, tbSig) {
      const antes = easeIn((t - (tbSig - .12)) / .12) * .4;
      const despues = .38 * resorte(t - tb, 6.5, 13);
      return 1 + Math.max(antes, despues);
    }

    // ---------- Cuadro ----------
    function dibuja(tReal) {
      const r = reloj(tReal), t = r.t;
      limpia(ctx);
      if (!web && tReal >= DUR - .15) { ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H); return; }
      if (r.sc.id === 'intro') { intro(ctx, t); post(r); return; }
      const tbSig = r.tb + 4 * P;
      // cámara: bombeo en cada pulso y sacudida al cambiar
      const bombeo = 1 + enPulso(t) * .012;
      const u = t - r.tb, sh = u < .18 ? (1 - u / .18) * 12 * k : 0;
      ctx.save();
      ctx.translate(W / 2 + (h(Math.floor(t * 30), 5) - .5) * sh, H / 2 + (h(Math.floor(t * 30), 6) - .5) * sh);
      ctx.scale(bombeo, bombeo); ctx.translate(-W / 2, -H / 2);
      // destello a media frase (como la referencia): dos cuadros con el texto de la escena que viene
      const sig = escenas[r.n + 1], uM = t - (r.tb + 2.5 * P);
      const destello = !web && !opts.quieto && sig && sig.dentro && uM >= 0 && uM < 2 / 30;
      escena(ctx, destello ? { ...r.sc, dentro: sig.dentro } : r.sc, t, r.tb, abertura(t, r.tb, tbSig));
      ctx.restore();
      if (!opts.quieto) { post(r); transicion(r); }
    }

    // Golpes menores: destellos de un cuadro del texto de la escena siguiente (como la referencia)
    function post(r) {
      const t = r.t, q = Math.floor(t * 30);
      if (r.sc.id !== 'intro' && !web) {
        const g = golpe(t);
        if (g > .85 && h(q, 12) > .55) { copiaA(); limpia(b); b.drawImage(A, 0, 0); rebanadas(ctx, A, B, q, 5, 46); }
      }
      if (!web && r.tAbs >= DUR - .7) bloques(q, 8 + Math.floor((r.tAbs - (DUR - .7)) * 70));
    }

    // Transición de entrada de cada escena: arranca un poco antes del compás y termina un poco después
    function transicion(r) {
      const t = r.t, u = t - r.tb, q = Math.floor(t * 30);
      const tipo = r.sc.entra; if (!tipo) return;
      if (u < 0 || u > .3) return;
      // dibuja la escena anterior en B para mezclarla
      const ant = r.ant;
      const renderAnt = () => {
        limpia(b);
        if (ant.id === 'intro') intro(b, r.tb - .001);
        else escena(b, ant, t, r.tb - 4 * P, 1.35);
      };
      if (tipo === 'zoom') {
        if (u < .1) { const p = 1 - u / .1; zoomBlur(18 * p, 1 + .14 * p); }
        else if (u < .17) rgbSplit(12 * (1 - (u - .1) / .07) + 2);
      } else if (tipo === 'parpadeo') {
        const patron = [1, 0, 1, 0, 0, 1, 0, 0, 0]; const f = Math.floor(u * 30);
        if (f < patron.length && patron[f]) { renderAnt(); ctx.drawImage(B, (h(q, 1) - .5) * 30 * k, 0); }
        if (f < 3) rgbSplit(10);
      } else if (tipo === 'invierte') {
        const f = Math.floor(u * 30);
        // contraste volteado dentro de la paleta: la misma escena en papel por un cuadro (no negativo de color)
        if (f === 0 || f === 3) { limpia(ctx); escena(ctx, { ...r.sc, fondo: 'papel' }, t, r.tb, 1.3); }
        if (f === 1) { renderAnt(); copiaA(); rebanadas(ctx, B, A, q, 14, 70); }
        if (f < 6 && f !== 0) rgbSplit(8 - f);
      } else if (tipo === 'barrido') {
        // la palabra roja gigante de la escena barre la pantalla (textura como cortinilla)
        const p = clamp(u / .22);
        if (p < 1) {
          renderAnt();
          copiaA();
          const x = W * (1.1 - p * 2.4);
          ctx.save(); ctx.beginPath(); ctx.rect(x + W * .45, 0, W * 2, H); ctx.clip(); ctx.drawImage(B, 0, 0); ctx.restore();
          ctx.save(); ctx.translate(x + W * .3, H * .5); ctx.rotate(-.12); ctx.fillStyle = RED; ctx.font = `${Math.round(H * .62)}px ${FUENTE}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(r.sc.gig.join(''), 0, 0); ctx.restore();
        }
      } else if (tipo === 'rebanadas') {
        const f = Math.floor(u * 30);
        if (f < 6) { renderAnt(); copiaA(); limpia(ctx); ctx.drawImage(A, 0, 0); rebanadas(ctx, B, A, q, 22 - f * 3, 90 - f * 12); if (f < 3) rgbSplit(9); }
      }
    }

    return { dibuja, dur: web ? LOOP : DUR, compas, pulso, P };
  }

  window.CartelVivo = { cargar, crear, ritmo: { P, F0 } };
})();
