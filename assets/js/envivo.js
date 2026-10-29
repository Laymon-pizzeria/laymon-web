// En vivo (temporal): las 8 escenas del storyboard aprobado, al ritmo del riff de Miguel (0.4988 s por pulso).
// 4 pulsos = 1 escena, 8 escenas = 16 s en bucle. Cada pulso cambia --p en la escena; el tono de la sección
// (tinta, rojo o papel) cambia con la escena. Sin sonido. Se carga al asomarse y se pausa fuera de pantalla.
(() => {
  const sec = document.querySelector('[data-envivo]');
  const stage = sec && sec.querySelector('[data-ev-stage]');
  if (!stage) return;
  const escenas = [...stage.querySelectorAll('.ev-fr')];
  const flash = stage.querySelector('.ev-flash'), wipe = stage.querySelector('.ev-wipe'), glitch = stage.querySelector('.ev-glitch');
  const P = 0.4988, B = 4 * P, L = 8 * B, LEAD = 0.12;
  const tonos = ['tinta', 'tinta', 'tinta', 'rojo', 'tinta', 'rojo', 'tinta', 'papel'];
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const muestra = (s, p) => {
    escenas.forEach((e, i) => e.classList.toggle('ev-cur', i === s));
    escenas[s].style.setProperty('--p', p);
    sec.dataset.tono = tonos[s]; sec.dataset.esc = s;
  };
  const dispara = (el, ms) => { if (!el) return; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); setTimeout(() => el.classList.remove('on'), ms); };

  // Con movimiento reducido o sin IntersectionObserver: queda Miguel en primer plano, fijo
  if (reducido || !('IntersectionObserver' in window)) { sec.classList.add('is-listo'); muestra(3, 4); return; }
  muestra(3, 4); // primer cuadro razonable mientras cargan las imágenes

  let t0 = 0, activo = false, escena = -1, pulso = -1, pz = -1, cargada = false, parado = 0;
  const cuadro = (ms) => {
    if (!activo) return;
    requestAnimationFrame(cuadro);
    const u = Math.max(0, ((ms - t0) / 1000) % L);
    const s = Math.floor(u / B), en = u - s * B;
    const p = Math.floor(en / P) + 1;
    if (s !== escena) {
      muestra(s, 0); escena = s; pulso = -1; pz = -1;
      if (s === 1 || s === 6) dispara(flash, 140);
      if (s === 3) dispara(wipe, 240);
      if (s === 4) { stage.classList.add('ev-inv'); setTimeout(() => stage.classList.remove('ev-inv'), 40); }
    }
    if (p !== pulso) { escenas[s].style.setProperty('--p', p); pulso = p; if (s === 7) sec.dataset.tono = p >= 2 ? 'papel' : 'tinta'; }
    if (s === 5) { // las pizzas empiezan a caer un poco antes para aterrizar justo en el golpe
      const pp = Math.min(4, Math.floor((en + LEAD) / P) + 1);
      const v = pp >= 2 && pp > p ? pp : p;
      if (v !== pz) { escenas[s].style.setProperty('--pz', v); pz = v; }
    }
    if (s === 7 && u > L - 0.36 && !glitch.classList.contains('on')) dispara(glitch, 360);
  };
  const arranca = () => {
    activo = true; sec.classList.add('is-visto'); t0 = performance.now() - parado; escena = -1;
    requestAnimationFrame(cuadro);
  };
  const precarga = () => {
    if (cargada) return; cargada = true; sec.classList.add('is-listo');
    const urls = ['g1.webp', 'g2.webp', 'lugar.jpg', 'negro.jpg', 'llamas2.webp', 'papel.jpg', 'pz1.webp', 'pz2.webp', 'pz3.webp'].map(f => 'assets/img/envivo/ev/' + f);
    const listo = Promise.all(urls.map(u => new Promise(ok => { const i = new Image(); i.onload = i.onerror = ok; i.src = u; })));
    return Promise.race([listo, new Promise(ok => setTimeout(ok, 1500))]);
  };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) {
      Promise.resolve(precarga()).then(() => { if (!activo && sec.dataset.visible === '1') arranca(); });
      sec.dataset.visible = '1';
      if (cargada && !activo) arranca();
    } else {
      sec.dataset.visible = '0';
      if (activo) { activo = false; parado = performance.now() - t0; sec.classList.remove('is-visto'); }
    }
  }, { rootMargin: '150px 0px' }).observe(sec);
})();
