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

  // Pizzas en arco: las tarjetas corren por una curva y se detienen con el cursor (o el dedo) encima
  const arco = document.querySelector('[data-arco]');
  if (arco && !reduceMotion) {
    const items = [...arco.querySelectorAll('li')];
    const SPEED = 42; // px por segundo
    let table = [], vis = 0, total = 0, offset = 0, paused = false, resumeT = 0, last = 0, onScreen = true;

    // Recorrido de las tarjetas. Escritorio y tablet: un cuarto de elipse que orbita el texto de la esquina
    // (entran por abajo a la derecha y salen por arriba a la izquierda). Celular: arcoíris de lado a lado.
    const build = () => {
      const W = arco.clientWidth, H = arco.clientHeight;
      const cw = items[0].offsetWidth, ch = items[0].offsetHeight;
      const movil = W <= 820;
      const pts = [];
      if (movil) {
        const y0 = H - ch * 0.15, yc = (ch * 0.55 + 16 - 0.25 * y0) / 0.75;
        const P = [[W + cw, y0], [W * 0.8, yc], [W * 0.2, yc], [-cw, y0]];
        for (let i = 0; i <= 400; i++) {
          const t = i / 400, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
          pts.push([a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]]);
        }
      } else {
        const cx = -cw * 0.2, cy = H + ch * 0.25;
        const rx = W * 0.8 - cx, ry = cy - (ch * 0.62 + 18);
        pts.push([cx + rx, H + ch]);
        for (let i = 0; i <= 400; i++) {
          const th = Math.PI / 2 * (1 - i / 400);
          pts.push([cx + rx * Math.sin(th), cy - ry * Math.cos(th)]);
        }
        pts.push([cx - cw * 1.2, cy - ry]);
      }
      table = [];
      let len = 0, prev = pts[0];
      for (const p of pts) {
        len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
        table.push([len, p[0], p[1]]);
        prev = p;
      }
      vis = len;
      // Separación fija entre tarjetas; las que sobran esperan fuera de cuadro
      total = Math.max(vis + cw, items.length * cw * (movil ? 1.25 : 1.32));
    };
    const at = (s) => {
      let lo = 0, hi = table.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (table[m][0] < s) lo = m + 1; else hi = m; }
      const p = table[lo], q = table[Math.max(lo - 1, 0)];
      return [p[1], p[2], Math.atan2(q[2] - p[2], q[1] - p[1])];
    };
    const place = () => {
      const gap = total / items.length;
      items.forEach((li, i) => {
        const s = ((offset + i * gap) % total + total) % total;
        if (s > vis) { li.style.visibility = 'hidden'; return; }
        const [x, y, ang] = at(s);
        // Se inclinan con la curva, pero a medias para que no queden de lado
        const rot = ang * 180 / Math.PI * 0.45;
        li.style.visibility = '';
        li.style.transform = `translate(${x - li.offsetWidth / 2}px, ${y - li.offsetHeight / 2}px) rotate(${rot}deg)`;
      });
    };
    const tick = (now) => {
      const dt = Math.min((now - (last || now)) / 1000, 0.1);
      last = now;
      if (!paused && now > resumeT && onScreen) { offset += SPEED * dt; place(); }
      requestAnimationFrame(tick);
    };
    build(); place();
    requestAnimationFrame(tick);
    window.addEventListener('resize', () => { build(); place(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(arco);
    arco.addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse' && e.target.closest('li')) paused = true; });
    arco.addEventListener('pointerout', (e) => { if (e.pointerType === 'mouse' && !e.relatedTarget?.closest?.('[data-arco] li')) paused = false; });
    arco.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') resumeT = performance.now() + 2500; });
    arco.addEventListener('focusin', (e) => {
      // Con teclado, la tarjeta enfocada se acomoda en lo alto del arco
      const i = items.indexOf(e.target.closest('li'));
      if (i >= 0) { offset = vis / 2 - i * (total / items.length); place(); }
      paused = true;
    });
    arco.addEventListener('focusout', () => { paused = false; });
  }

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
});
