// Laymon — interacciones del sitio. Sin dependencias.

document.addEventListener('DOMContentLoaded', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Nav: se esconde al bajar, vuelve al subir
  const nav = document.querySelector('[data-nav]');
  const dock = document.querySelector('[data-dock]');
  const heroActions = document.querySelector('.hero__actions');
  let lastY = window.scrollY;
  let ticking = false;

  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 8);
    nav.classList.toggle('is-hidden', y > lastY && y > 240);
    lastY = y;
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });

  // Dock móvil: aparece cuando los botones del hero ya no se ven
  if (dock && heroActions && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      dock.classList.toggle('is-on', !entry.isIntersecting && entry.boundingClientRect.top < 0);
    }).observe(heroActions);
  }

  // Jaguar del hero: sigue al cursor apenas (solo escritorio)
  const beast = document.querySelector('[data-parallax]');
  if (beast && !reduceMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let frame = 0;
    window.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * -14;
        const y = (e.clientY / window.innerHeight - 0.5) * -8;
        beast.style.transform = `translate(${x}px, ${y}px)`;
      });
    });
  }

  // Playlist: el reproductor de Spotify solo se carga si lo piden
  const playlistBtn = document.querySelector('[data-playlist]');
  const playlist = document.getElementById('playlist');
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
