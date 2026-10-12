// Laymon — interacciones del sitio. Sin dependencias.

document.addEventListener('DOMContentLoaded', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Intro del fantasma: al terminar se quita del DOM; lo demás arranca cuando la ola destapa la página
  const intro = document.querySelector('[data-intro]');
  const introWait = reduceMotion || !intro ? 0 : 3800;
  if (intro) {
    if (reduceMotion) intro.remove();
    else setTimeout(() => intro.remove(), 5400);
  }

  // Sin header (Luis, 12 oct): pasando el Pide ahora del hero aparece el Pide ahora flotante
  const dock = document.querySelector('[data-dock]');
  const heroCta = document.querySelector('[data-hero-cta]');
  const setHero = (enHero) => {
    document.body.classList.toggle('en-hero', enHero);
    if (dock) dock.classList.toggle('is-on', !enHero);
  };
  if (heroCta && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      setHero(entry.isIntersecting || entry.boundingClientRect.top > 0);
    }).observe(heroCta);
  } else setHero(false);

  // Fantasma: hace su truco al cargar y cada vez que lo tocas
  const ghost = document.querySelector('[data-ghost]');
  if (ghost && !reduceMotion) {
    const frames = [...ghost.querySelectorAll('.ghost__frame')];
    let playing = false;
    const trick = () => {
      if (playing) return;
      playing = true;
      let i = 0;
      const step = () => {
        frames.forEach((f, n) => f.classList.toggle('is-on', n === i));
        if (++i < frames.length) setTimeout(step, 150);
        else playing = false;
      };
      step();
    };
    // Una vez al cargar, cuando el logo ya dejó de mecerse; luego solo al pasar el cursor o tocarlo
    setTimeout(trick, introWait + 2200);
    ghost.addEventListener('click', trick);
    ghost.addEventListener('pointerenter', trick);
  }

  // Fantasma del hero: sigue al cursor apenas (solo escritorio)
  const art = document.querySelector('[data-parallax]');
  if (art && !reduceMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let frame = 0;
    window.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * -14;
        const y = (e.clientY / window.innerHeight - 0.5) * -8;
        art.style.transform = `translate(${x}px, ${y}px)`;
      });
    });
  }

  // Playlist: el reproductor de Spotify solo se carga si lo piden
  const playlistBtn = document.querySelector('[data-playlist]');
  const playlist = document.getElementById('playlist');
  document.querySelectorAll('[data-open-playlist]').forEach((link) => {
    link.addEventListener('click', () => {
      if (playlistBtn && playlistBtn.getAttribute('aria-expanded') !== 'true') playlistBtn.click();
    });
  });
  if (playlistBtn && playlist) {
    playlistBtn.addEventListener('click', () => {
      const open = playlistBtn.getAttribute('aria-expanded') === 'true';
      playlistBtn.setAttribute('aria-expanded', String(!open));
      playlist.hidden = open;
      if (!open && !playlist.firstChild) {
        const iframe = document.createElement('iframe');
        iframe.src = 'https://open.spotify.com/embed/playlist/6XAcaR5LWKgsEgesujMqM6?theme=0';
        iframe.title = 'Playlist de Laymon en Spotify';
        iframe.loading = 'lazy';
        iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
        playlist.appendChild(iframe);
      }
    });
  }

  // Pizzas en cascada diagonal (copiada del video de referencia de Luis):
  // una tarjeta sola al centro → se abre un mazo en diagonal detrás → el mazo se reparte: la tarjeta activa
  // grande al centro, las ya vistas apiladas arriba a la izquierda y las que vienen abajo a la derecha →
  // avanza una por una → al final todo se junta en un mazo chico y la primera vuelve a crecer. Se detiene
  // solo con el cursor encima de una tarjeta.
  const escena = document.querySelector('[data-cascada]');
  if (escena && !reduceMotion) {
    const cards = [...escena.querySelectorAll('li')];
    const N = cards.length;

    // Todo lo ajustable de la coreografía, en unidades del tamaño de la tarjeta grande (cw × ch)
    const CFG = {
      centro: [0.56, 0.47],          // centro de la tarjeta activa, en fracción del escenario
      centroTablet: [0.66, 0.47],    // en tablet se corre a la derecha para no pisar el texto
      centroMovil: [0.5, 0.45],
      chica: 0.62,                   // escala de las tarjetas apiladas
      atras: [-1.0, -0.56],          // la anterior inmediata, respecto a la activa
      atrasPaso: [-0.25, -0.17],     // cada una más vieja se recorre esto
      adelante: [1.08, 0.74],        // la siguiente inmediata
      adelantePaso: [0.27, 0.17],
      visibles: 3,                   // cuántas se ven en cada pila
      // Tablet y escritorio: el reparto se mide contra la sección para que ninguna tarjeta quede cortada
      margen: 24,                    // px libres contra los bordes de la sección y el texto
      activaEscala: 1.08,            // la activa del reparto, respecto a la tarjeta sola inicial (Luis: más grande)
      pilaEscala: 0.4,               // las apiladas (Luis: más chicas)
      pilaPaso: 0.34,                // separación dentro de una pila, en anchos de tarjeta apilada
      pilaPasoY: 0.16,               // y en altos
      abanicoEscala: 0.7,
      abanicoInicio: [-0.18, -0.14], // la primera se mueve un poco arriba-izquierda al abrir el mazo
      abanicoPaso: [0.22, 0.17],
      escalonado: 40,                // ms de retraso entre tarjetas vecinas (cascada)
      curva: 'cubic-bezier(.7, 0, .25, 1)',
      curvaSuave: 'cubic-bezier(.22, 1, .36, 1)',
      // Secuencia: [estado, duración de la transición, espera hasta el siguiente paso] en ms
      inicio: [['sola', 800, 900], ['abanico', 650, 900]],
      paso: [750, 1250],             // cada avance de tarjeta
      cierre: [['junta', 650, 350], ['solaChica', 450, 250]], // y de ahí vuelve a 'sola'
    };

    let geo = null;
    const medir = () => {
      const W = escena.clientWidth, H = escena.clientHeight;
      const ch = cards[0].offsetHeight, cw = cards[0].offsetWidth;
      const c = W <= 820 ? CFG.centroMovil : W <= 1100 ? CFG.centroTablet : CFG.centro;
      geo = { cw, ch, cx: W * c[0] - cw / 2, cy: H * c[1] - ch / 2, slots: null };
      if (W <= 820) return; // en celular se vale que las pilas se salgan del cuadro

      // Las pilas se pegan a las esquinas de la activa (arriba-izquierda las vistas, abajo-derecha las que
      // vienen) y el grupo se acomoda dentro de la sección: completo, sin pisar el texto y lo más centrado
      // posible. Si no cabe, la activa se achica de a poco hasta que quepa.
      const m = CFG.margen, V = CFG.visibles;
      const er = escena.getBoundingClientRect(), tr = escena.parentElement.querySelector('.pizzas__concepto').getBoundingClientRect();
      const texto = { l: tr.left - er.left - m, t: tr.top - er.top - m, r: tr.right - er.left + m, b: tr.bottom - er.top + m };
      const choca = (x, y, w, h) => x - w / 2 < texto.r && x + w / 2 > texto.l && y - h / 2 < texto.b && y + h / 2 > texto.t;
      const dentro = (x, y, w, h) => x - w / 2 >= m && x + w / 2 <= W - m && y - h / 2 >= m && y + h / 2 <= H - m;
      const sw = cw * CFG.pilaEscala, sh = ch * CFG.pilaEscala;
      for (let ea = CFG.activaEscala; ea >= 0.7 && !geo.slots; ea -= 0.04) {
        const aw = cw * ea, ah = ch * ea;
        const off = (dir, n) => [
          dir * (aw / 2 + sw * 0.12 + (n - 1) * sw * CFG.pilaPaso),
          dir * (ah / 2 - sh * 0.32 + (n - 1) * sh * CFG.pilaPasoY),
        ];
        const ay = H / 2, ideal = (Math.max(texto.r, 0) + W) / 2; // centrado en el hueco a la derecha del texto
        for (let d = 0; d < W && !geo.slots; d += 8) {
          for (const ax of [ideal - d, ideal + d]) {
            const cajas = [[ax, ay, aw, ah]];
            const atras = [], adelante = [];
            for (let n = 1; n <= V; n++) {
              const p = off(-1, n), q = off(1, n);
              atras.push([ax + p[0], ay + p[1]]); adelante.push([ax + q[0], ay + q[1]]);
              cajas.push([ax + p[0], ay + p[1], sw, sh], [ax + q[0], ay + q[1], sw, sh]);
            }
            if (cajas.every((c) => dentro(...c) && !choca(...c))) { geo.slots = { activa: [ax, ay], atras, adelante, escala: ea }; break; }
          }
        }
      }
    };

    // Dónde va la tarjeta i en cada estado: desplazamiento (en cw/ch), escala, opacidad y orden
    const pose = (estado, i, activa) => {
      if (estado === 'oculta') return { x: 0, y: 0, s: 0.5, o: 0, z: 100 - i, k: i };
      if (estado === 'sola' || estado === 'solaChica') {
        return { x: 0, y: 0, s: i === 0 ? (estado === 'sola' ? 1 : 0.5) : 0.5, o: i === 0 ? 1 : 0, z: 100 - i, k: i };
      }
      if (estado === 'abanico' || estado === 'junta') {
        const n = Math.min(i, CFG.visibles + 1);
        const e = estado === 'junta' ? 0.55 : CFG.abanicoEscala;
        const f = estado === 'junta' ? 0.55 : 1;
        return {
          x: (CFG.abanicoInicio[0] + n * CFG.abanicoPaso[0]) * f, y: (CFG.abanicoInicio[1] + n * CFG.abanicoPaso[1]) * f,
          s: e, o: i <= CFG.visibles + 1 ? 1 : 0, z: 100 - i, k: i,
        };
      }
      const k = i - activa;
      if (geo.slots) {
        const n = Math.min(Math.abs(k), CFG.visibles);
        const c = k === 0 ? geo.slots.activa : (k < 0 ? geo.slots.atras : geo.slots.adelante)[n - 1];
        return {
          abs: c, s: k === 0 ? geo.slots.escala : CFG.pilaEscala,
          o: Math.abs(k) <= CFG.visibles ? 1 : 0, z: 100 - Math.abs(k), k,
        };
      }
      if (k === 0) return { x: 0, y: 0, s: 1, o: 1, z: 100, k: 0 };
      const n = Math.min(Math.abs(k), CFG.visibles + 1);
      const [b, p] = k < 0 ? [CFG.atras, CFG.atrasPaso] : [CFG.adelante, CFG.adelantePaso];
      return {
        x: b[0] + (n - 1) * p[0], y: b[1] + (n - 1) * p[1], s: CFG.chica,
        o: Math.abs(k) <= CFG.visibles ? 1 : 0, z: 100 - Math.abs(k), k,
      };
    };

    let estado = 'sola', activa = 0;
    const aplicar = (dur, curva = CFG.curva) => {
      escena.style.setProperty('--dur', dur + 'ms');
      escena.style.setProperty('--curva', curva);
      cards.forEach((li, i) => {
        const p = pose(estado, i, activa);
        li.style.zIndex = p.z;
        li.style.opacity = p.o;
        li.style.transitionDelay = Math.min(Math.abs(p.k), CFG.visibles + 1) * CFG.escalonado + 'ms';
        const [x, y] = p.abs ? [p.abs[0] - geo.cw / 2, p.abs[1] - geo.ch / 2] : [geo.cx + p.x * geo.cw, geo.cy + p.y * geo.ch];
        li.style.transform = `translate(${x}px, ${y}px) scale(${p.s})`;
      });
    };

    // Lista de pasos de una vuelta completa
    const pasos = [
      ...CFG.inicio.map(([e, d, w]) => ({ e, d, w })),
      ...cards.slice(1).map((_, i) => ({ e: 'diag', a: i + 1, d: CFG.paso[0], w: CFG.paso[1] })),
      ...CFG.cierre.map(([e, d, w]) => ({ e, d, w })),
    ];
    let idx = 0, reloj = 0, siguiente = 0, last = 0, pausa = false, enPantalla = false;
    const correr = () => {
      const p = pasos[idx];
      estado = p.e; activa = p.a ?? 0;
      aplicar(p.d, p.e === 'sola' ? CFG.curvaSuave : CFG.curva);
      siguiente = reloj + p.d + p.w;
      idx = (idx + 1) % pasos.length;
    };
    const tick = (now) => {
      const dt = last ? Math.min(now - last, 100) : 0;
      last = now;
      if (!pausa && enPantalla) {
        reloj += dt;
        if (reloj >= siguiente) correr();
      }
      requestAnimationFrame(tick);
    };

    // Cada vez que llegas a la sección la secuencia empieza de cero: la primera tarjeta crece desde la nada.
    // Al salir se congela; al volver arranca otra vez desde el principio.
    const reiniciar = () => {
      estado = 'oculta'; activa = 0;
      cards.forEach((li) => { li.style.transition = 'none'; });
      aplicar(0);
      escena.offsetHeight;
      cards.forEach((li) => { li.style.transition = ''; });
      idx = 0; reloj = 0; siguiente = 120;
    };
    medir();
    reiniciar();
    requestAnimationFrame(tick);

    window.addEventListener('resize', () => { medir(); aplicar(0); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        if (e.isIntersecting && !enPantalla) reiniciar();
        enPantalla = e.isIntersecting;
      }, { threshold: 0.35 }).observe(escena);
    } else enPantalla = true;
    escena.addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse' && e.target.closest('li')) pausa = true; });
    escena.addEventListener('pointerout', (e) => {
      if (e.pointerType === 'mouse' && !e.relatedTarget?.closest?.('[data-cascada] li')) pausa = false;
    });
    escena.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') siguiente = Math.max(siguiente, reloj + 2500); });
    // Con teclado: la tarjeta enfocada pasa al centro y todo espera
    escena.addEventListener('focusin', (e) => {
      const i = cards.indexOf(e.target.closest('li'));
      if (i < 0) return;
      pausa = true; estado = 'diag'; activa = i; aplicar(500);
      idx = pasos.findIndex((p) => p.e === 'diag' && p.a === Math.min(i + 1, N - 1));
      if (i === N - 1) idx = pasos.length - CFG.cierre.length;
    });
    escena.addEventListener('focusout', () => { pausa = false; });
  }

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
});
