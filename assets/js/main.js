// Laymon — interacciones del sitio. Sin dependencias.

document.addEventListener('DOMContentLoaded', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    setTimeout(trick, 2200);
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

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
});
