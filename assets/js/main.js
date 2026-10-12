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

  // Nav: se esconde al bajar, vuelve al subir
  const nav = document.querySelector('[data-nav]');
  const dock = document.querySelector('[data-dock]');
  let lastY = window.scrollY;
  // Mientras el Pide ahora del hero se ve, el header muestra solo la barra de envío
  const heroCta = document.querySelector('[data-hero-cta]');
  let enHero = true;
  if (heroCta && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      enHero = entry.isIntersecting || entry.boundingClientRect.top > 0;
      onScroll();
    }).observe(heroCta);
  } else { enHero = false; }
  let ticking = false;

  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 8);
    const hidden = !enHero && y > lastY && y > 240;
    nav.classList.toggle('is-hero', enHero);
    nav.classList.toggle('is-hidden', hidden);
    document.body.classList.toggle('en-hero', enHero);
    if (dock) dock.classList.toggle('is-on', hidden);
    lastY = y;
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });

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
      geo = { cw, ch, cx: W * c[0] - cw / 2, cy: H * c[1] - ch / 2 };
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
        li.style.transform = `translate(${geo.cx + p.x * geo.cw}px, ${geo.cy + p.y * geo.ch}px) scale(${p.s})`;
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
