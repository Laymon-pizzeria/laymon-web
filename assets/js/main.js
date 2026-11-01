// Laymon — interacciones del sitio. Sin dependencias.

// Ruta de este archivo, para cargar lo de assets/vendor bajo demanda (funciona igual desde / y desde /puntos/)
const scriptBase = document.currentScript ? document.currentScript.src : location.href;

document.addEventListener('DOMContentLoaded', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  // Pizzas en cascada diagonal (copiada del video de referencia de Luis):
  // el mazo cerrado al centro → se abre en diagonal detrás → el mazo se reparte: la tarjeta activa
  // grande al centro, las ya vistas apiladas arriba a la izquierda y las que vienen abajo a la derecha →
  // avanza una por una → al terminar todas regresan al mazo cerrado y vuelve a empezar. Cada vuelta empieza y
  // acaba con el mazo cerrado, así no se nota el bucle. Se detiene solo con el cursor encima de una tarjeta.
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
      separacion: 40,                // px de aire entre la activa y cada pila (Luis: que no vayan pegadas)
      pilaPaso: 0.34,                // separación dentro de una pila, en anchos de tarjeta apilada
      pilaPasoY: 0.16,               // y en altos
      abanicoEscala: 0.7,
      abanicoInicio: [-0.18, -0.14], // la primera se mueve un poco arriba-izquierda al abrir el mazo
      abanicoPaso: [0.22, 0.17],
      escalonado: 40,                // ms de retraso entre tarjetas vecinas (cascada)
      curva: 'cubic-bezier(.7, 0, .25, 1)',
      curvaSuave: 'cubic-bezier(.22, 1, .36, 1)',
      mazoPaso: [0.025, 0.02],       // grosor del mazo cerrado: cuánto asoma cada tarjeta de abajo
      // Secuencia de una vuelta: [estado, duración de la transición, espera hasta el siguiente paso] en ms.
      // Empieza y termina en el mazo cerrado ('mazo'), así la vuelta siguiente arranca donde acabó la anterior.
      inicio: [['mazo', 800, 1000], ['abanico', 650, 900]],
      paso: [750, 1250],             // cada avance de tarjeta
      cierre: 900,                   // lo que tarda todo en regresar al mazo cerrado
    };

    let geo = null;
    const medir = () => {
      const W = escena.clientWidth, H = escena.clientHeight;
      const ch = cards[0].offsetHeight, cw = cards[0].offsetWidth;
      const c = W <= 820 ? CFG.centroMovil : W <= 1100 ? CFG.centroTablet : CFG.centro;
      geo = { cw, ch, cx: W * c[0] - cw / 2, cy: H * c[1] - ch / 2, slots: null };
      if (W <= 820) return; // en celular se vale que las pilas se salgan del cuadro

      // Las pilas van separadas de la activa: las vistas arriba a la izquierda (alineadas con su borde de
      // arriba) y las que vienen abajo a la derecha (alineadas con su borde de abajo). El grupo se acomoda
      // dentro de la sección: completo, sin pisar el texto y lo más centrado posible. Si no cabe, la activa
      // se achica de a poco hasta que quepa.
      const m = CFG.margen, V = CFG.visibles;
      const er = escena.getBoundingClientRect(), tr = escena.parentElement.querySelector('.pizzas__concepto').getBoundingClientRect();
      const texto = { l: tr.left - er.left - m, t: tr.top - er.top - m, r: tr.right - er.left + m, b: tr.bottom - er.top + m };
      const choca = (x, y, w, h) => x - w / 2 < texto.r && x + w / 2 > texto.l && y - h / 2 < texto.b && y + h / 2 > texto.t;
      const dentro = (x, y, w, h) => x - w / 2 >= m && x + w / 2 <= W - m && y - h / 2 >= m && y + h / 2 <= H - m;
      const sw = cw * CFG.pilaEscala, sh = ch * CFG.pilaEscala;
      // Se prueba de más a menos: activa grande y bien separada primero; si no cabe (tablet), se baja la
      // separación, se sube o baja el grupo y al final se achica la activa
      const ideal = (Math.max(texto.r, 0) + W) / 2; // centrado en el hueco a la derecha del texto
      const probar = (ea, sep, ay) => {
        const aw = cw * ea, ah = ch * ea;
        const off = (dir, n) => [
          dir * (aw / 2 + sep + sw / 2 + (n - 1) * sw * CFG.pilaPaso),
          dir * (ah / 2 - sh / 2 + (n - 1) * sh * CFG.pilaPasoY),
        ];
        for (let d = 0; d < W; d += 8) {
          for (const ax of [ideal - d, ideal + d]) {
            const cajas = [[ax, ay, aw, ah]];
            const atras = [], adelante = [];
            for (let n = 1; n <= V; n++) {
              const p = off(-1, n), q = off(1, n);
              atras.push([ax + p[0], ay + p[1]]); adelante.push([ax + q[0], ay + q[1]]);
              cajas.push([ax + p[0], ay + p[1], sw, sh], [ax + q[0], ay + q[1], sw, sh]);
            }
            if (cajas.every((c) => dentro(...c) && !choca(...c))) return { activa: [ax, ay], atras, adelante, escala: ea };
          }
        }
        return null;
      };
      busca: for (let ea = CFG.activaEscala; ea >= 0.6; ea -= 0.04) {
        for (const sep of [CFG.separacion, CFG.separacion / 2, 8]) {
          for (let dy = 0; dy <= H * 0.2; dy += 8) {
            for (const ay of [H / 2 - dy, H / 2 + dy]) {
              geo.slots = probar(ea, sep, ay);
              if (geo.slots) break busca;
            }
          }
        }
      }
    };

    // Dónde va la tarjeta i en cada estado: desplazamiento (en cw/ch), escala, opacidad y orden
    const pose = (estado, i, activa) => {
      if (estado === 'oculta') return { x: 0, y: 0, s: 0.5, o: 0, z: 100 - i, k: i };
      if (estado === 'mazo') {
        const n = Math.min(i, CFG.visibles);
        return { x: n * CFG.mazoPaso[0], y: n * CFG.mazoPaso[1], s: 1, o: i <= CFG.visibles ? 1 : 0, z: 100 - i, k: i };
      }
      if (estado === 'abanico') {
        const n = Math.min(i, CFG.visibles + 1);
        return {
          x: CFG.abanicoInicio[0] + n * CFG.abanicoPaso[0], y: CFG.abanicoInicio[1] + n * CFG.abanicoPaso[1],
          s: CFG.abanicoEscala, o: i <= CFG.visibles + 1 ? 1 : 0, z: 100 - i, k: i,
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

    let estado = 'mazo', activa = 0;
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

    // Una vuelta: mazo cerrado → se abre → pasan todas → regresan al mazo cerrado (y otra vez)
    const pasos = [
      ...CFG.inicio.map(([e, d, w]) => ({ e, d, w })),
      ...cards.slice(1).map((_, i) => ({ e: 'diag', a: i + 1, d: CFG.paso[0], w: CFG.paso[1] })),
    ];
    let idx = 0, reloj = 0, siguiente = 0, last = 0, pausa = false, enPantalla = false, vuelta = 0;
    const correr = () => {
      const p = pasos[idx];
      estado = p.e; activa = p.a ?? 0;
      // Al regresar al mazo desde la última pizza se usa la duración de cierre; al entrar, la curva suave
      const d = p.e === 'mazo' && vuelta > 0 ? CFG.cierre : p.d;
      aplicar(d, p.e === 'mazo' && vuelta === 0 ? CFG.curvaSuave : CFG.curva);
      siguiente = reloj + d + p.w;
      idx = (idx + 1) % pasos.length;
      if (idx === 0) vuelta++;
    };
    // El reloj solo corre con la sección en pantalla; fuera de ella no queda ningún cuadro pendiente
    let cuadro = 0;
    const tick = (now) => {
      const dt = last ? Math.min(now - last, 100) : 0;
      last = now;
      if (!pausa) {
        reloj += dt;
        if (reloj >= siguiente) correr();
      }
      cuadro = enPantalla ? requestAnimationFrame(tick) : 0;
    };
    const arrancar = () => { if (!cuadro) { last = 0; cuadro = requestAnimationFrame(tick); } };

    // Cada vez que llegas a la sección la secuencia empieza de cero: la primera tarjeta crece desde la nada.
    // Al salir se congela; al volver arranca otra vez desde el principio.
    const reiniciar = () => {
      estado = 'oculta'; activa = 0;
      cards.forEach((li) => { li.style.transition = 'none'; });
      aplicar(0);
      escena.offsetHeight;
      cards.forEach((li) => { li.style.transition = ''; });
      idx = 0; reloj = 0; siguiente = 120; vuelta = 0;
    };
    medir();
    reiniciar();

    // En celular la barra del navegador cambia el alto de la ventana al hacer scroll: eso no mueve el
    // escenario, así que solo se vuelve a medir si cambió su tamaño (si no, las tarjetas brincaban a media animación)
    let tam = `${escena.clientWidth}x${escena.clientHeight}`;
    window.addEventListener('resize', () => {
      const t = `${escena.clientWidth}x${escena.clientHeight}`;
      if (t === tam) return;
      tam = t; medir(); aplicar(0);
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        if (e.isIntersecting && !enPantalla) reiniciar();
        enPantalla = e.isIntersecting;
        if (enPantalla) arrancar();
      }, { threshold: 0.35 }).observe(escena);
    } else { enPantalla = true; arrancar(); }
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
      idx = (i + 2) % pasos.length; // el siguiente paso es la pizza que sigue (o el cierre si era la última)
    });
    escena.addEventListener('focusout', () => { pausa = false; });
  }

  // Ven por una: mapa con Laymon. Con el botón pide tu ubicación, traza la ruta y el fantasma en patineta
  // la recorre hasta Laymon encendiendo el camino en rojo detrás de él.
  // Mapa: Leaflet (assets/vendor) con calles de OpenStreetMap; ruta: OSRM público. Sin llaves ni cuentas.
  const ruta = document.querySelector('[data-ruta]');
  if (ruta) {
    const laymon = [+ruta.dataset.lat, +ruta.dataset.lng];
    const gmaps = ruta.querySelector('[data-ruta-gmaps]').href;
    const waze = ruta.querySelector('[data-ruta-waze]').href;

    // Mándate la ruta al cel: en celular abre el menú de compartir; en compu, WhatsApp Web con los dos links
    const enviar = ruta.querySelector('[data-ruta-enviar]');
    const texto = `Ruta a Laymon Pizzería Artesanal\nGoogle Maps: ${gmaps}\nWaze: ${waze}`;
    enviar.addEventListener('click', () => {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        navigator.share({ title: 'Ruta a Laymon', text: texto }).catch(() => {});
      } else {
        window.open(`https://api.whatsapp.com/send/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
      }
    });
  }
  const iniciarMapa = () => {
    const laymon = [+ruta.dataset.lat, +ruta.dataset.lng];
    const msg = ruta.querySelector('[data-ruta-msg]');
    const btn = ruta.querySelector('[data-ruta-btn]');
    const decir = (t) => { msg.textContent = t; };
    const tpl = (k) => ruta.querySelector(`[data-ruta-${k}]`).content.firstElementChild.outerHTML;
    const mapa = L.map(ruta.querySelector('[data-ruta-mapa]'), {
      center: laymon, zoom: 15, scrollWheelZoom: false, zoomControl: false,
      dragging: !L.Browser.mobile, // en celular un dedo es para bajar la página; dos para mover el mapa
      zoomAnimation: !reduceMotion, fadeAnimation: !reduceMotion, markerZoomAnimation: !reduceMotion,
    });
    L.control.zoom({ position: 'topright' }).addTo(mapa);
    mapa.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa);
    L.marker(laymon, {
      icon: L.divIcon({ className: 'ruta__pin', html: tpl('pin'), iconSize: [68, 68], iconAnchor: [34, 34] }),
      keyboard: false, alt: 'Laymon', zIndexOffset: 500,
    }).addTo(mapa);

    let capa = null, viaje = 0, pidiendo = false;
    const caja = ruta.querySelector('[data-ruta-mapa]');
    // Tramo por delante del fantasma: rojo con miniflechas que fluyen hacia Laymon; lo recorrido queda en negro.
    // Al llegar, el fantasma se desvanece y vuelve a salir de tu punto (el rojo se recupera).
    const recorrer = (puntos, luz, flechas, fantasma) => {
      const acum = [0];
      for (let i = 1; i < puntos.length; i++) acum.push(acum[i - 1] + mapa.distance(puntos[i - 1], puntos[i]));
      const total = acum[acum.length - 1] || 1;
      const en = (d) => {
        let i = 1;
        while (i < acum.length - 1 && acum[i] < d) i++;
        const a = puntos[i - 1], b = puntos[i] || a;
        const f = Math.min(1, Math.max(0, (d - acum[i - 1]) / ((acum[i] - acum[i - 1]) || 1)));
        return { ll: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], este: b[1] > a[1] };
      };
      const dur = Math.min(9000, Math.max(5000, total * 0.8));
      const yo = viaje, el = fantasma ? fantasma.getElement() : null, rojo = luz.getElement(), fl = flechas.getElement();
      // Miniflechas: se calculan en pixeles del mapa en cada cuadro, desde el fantasma hasta Laymon
      const PASO = 22, ALA = 5;
      const dibujarFlechas = (frac, fase) => {
        const pts = puntos.map((p) => mapa.latLngToLayerPoint(p));
        const lar = [0];
        for (let i = 1; i < pts.length; i++) lar.push(lar[i - 1] + pts[i].distanceTo(pts[i - 1]));
        const largo = lar[lar.length - 1];
        let d = '', i = 1;
        for (let s = frac * largo + 14 + fase; s < largo - 30; s += PASO) {
          while (i < lar.length - 1 && lar[i] < s) i++;
          const a = pts[i - 1], b = pts[i], seg = (lar[i] - lar[i - 1]) || 1, f = (s - lar[i - 1]) / seg;
          const ux = (b.x - a.x) / seg, uy = (b.y - a.y) / seg;
          const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
          d += `M${(x - ux * ALA - uy * ALA).toFixed(1)} ${(y - uy * ALA + ux * ALA).toFixed(1)}L${x.toFixed(1)} ${y.toFixed(1)}L${(x - ux * ALA + uy * ALA).toFixed(1)} ${(y - uy * ALA - ux * ALA).toFixed(1)}`;
        }
        fl.setAttribute('d', d || 'M0 0');
      };
      const pintar = (e, fase) => {
        const p = 1000 * e;
        rojo.style.strokeDasharray = `${1000 - p} 1000`;
        rojo.style.strokeDashoffset = -p;
        dibujarFlechas(e, fase);
      };
      if (!fantasma) { // movimiento reducido: todo rojo, flechas quietas
        pintar(0, 0);
        mapa.on('zoomend moveend', () => { if (yo === viaje) pintar(0, 0); });
        return;
      }
      let inicio = null, espera = 0, e = 0;
      const t0 = performance.now();
      const paso = (now) => {
        if (yo !== viaje) return;
        const fase = ((now - t0) * 0.03) % PASO; // las flechas avanzan hacia Laymon
        if (espera) {
          if (now >= espera) { espera = 0; inicio = null; fantasma.setLatLng(puntos[0]); el.classList.remove('llego'); e = 0; }
        } else {
          if (inicio === null) inicio = now;
          const t = Math.min(1, (now - inicio) / dur);
          e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
          const p = en(e * total);
          fantasma.setLatLng(p.ll);
          el.classList.toggle('va-este', p.este);
          if (t >= 1) { el.classList.add('llego'); espera = now + 2200; }
        }
        pintar(espera ? 1 : e, fase);
        requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    };
    const dibujar = (puntos, yo) => {
      if (capa) capa.remove();
      viaje++;
      const base = L.polyline(puntos, { className: 'ruta__base', weight: 9, interactive: false });
      const luz = L.polyline(puntos, { className: 'ruta__luz', weight: 7, interactive: false });
      const flechas = L.polyline(puntos, { className: 'ruta__flechas', weight: 2.2, interactive: false });
      const punto = L.circleMarker(yo, { radius: 7, className: 'ruta__yo', interactive: false });
      capa = L.layerGroup([base, luz, flechas, punto]).addTo(mapa);
      // pathLength fijo: el tramo rojo no depende del zoom (Leaflet redibuja la línea al acercar)
      luz.getElement().setAttribute('pathLength', 1000);
      // arriba deja aire para el fantasma, que sobresale de la línea
      mapa.fitBounds(L.latLngBounds(puntos), { paddingTopLeft: [48, 96], paddingBottomRight: [48, 40], animate: !reduceMotion });
      let fantasma = null;
      if (!reduceMotion) {
        fantasma = L.marker(puntos[0], {
          icon: L.divIcon({ className: 'ruta__rider', html: tpl('rider'), iconSize: [64, 76], iconAnchor: [32, 70] }),
          interactive: false, keyboard: false, zIndexOffset: 1000,
        });
        capa.addLayer(fantasma);
      }
      // Ruta lista: el mapa late (se hunde y regresa) y se queda con el glow rojo
      caja.classList.remove('late');
      void caja.offsetWidth;
      caja.classList.add('late', 'lista');
      setTimeout(() => recorrer(puntos, luz, flechas, fantasma), reduceMotion ? 0 : 700);
    };
    const enRuta = (yo) => {
      decir('Trazando el camino a Laymon…');
      const url = `https://router.project-osrm.org/route/v1/driving/${yo[1]},${yo[0]};${laymon[1]},${laymon[0]}?overview=full&geometries=geojson`;
      fetch(url).then((r) => r.json()).then((d) => {
        const r = d.routes && d.routes[0];
        if (!r) throw new Error('sin ruta');
        dibujar(r.geometry.coordinates.map(([lng, lat]) => [lat, lng]), yo);
        const km = r.distance / 1000, min = Math.max(1, Math.round(r.duration / 60));
        const dist = km < 1 ? `${Math.round(r.distance)} m` : `${km.toFixed(1)} km`;
        decir(km > 80
          ? `Estás a ${Math.round(km)} km. Es lejos, pero hay quien ha viajado más por menos.`
          : `Estás a ${dist} de Laymon, unos ${min} min en coche. Ya nada te detiene.`);
        btn.textContent = 'Volver a trazar';
      }).catch(() => decir('No pudimos trazar el camino. Ábrela en Google Maps o Waze y que ellos te lleven.'))
        .finally(() => { pidiendo = false; caja.classList.remove('pensando'); });
    };
    // Solo con el botón: pedir la ubicación al entrar hace que el navegador esconda la pregunta (Luis, 12 oct)
    btn.addEventListener('click', () => {
      if (pidiendo) return;
      if (!('geolocation' in navigator)) { decir('Tu navegador no comparte ubicación. Ábrela en Google Maps o Waze.'); return; }
      pidiendo = true;
      caja.classList.add('pensando');
      decir('Buscándote en el mapa…');
      navigator.geolocation.getCurrentPosition(
        (p) => enRuta([p.coords.latitude, p.coords.longitude]),
        (e) => {
          pidiendo = false;
          caja.classList.remove('pensando');
          decir(e.code === 1
            ? 'Sin tu ubicación no hay ruta. Si cambias de opinión, permite la ubicación y vuelve a tocar el botón.'
            : 'No te encontramos. Toca el botón otra vez o ábrela en Google Maps o Waze.');
        },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
      );
    });
    // El mapa se mide bien hasta que la sección entra en pantalla
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); mapa.invalidateSize(); } });
      io.observe(ruta);
    }
  };
  // Leaflet (~160 KB) se descarga solo cuando el mapa se acerca a la pantalla, no en la carga inicial
  if (ruta) {
    const sinMapa = () => ruta.classList.add('ruta--sinmapa');
    const cargar = (el) => new Promise((ok, mal) => { el.onload = ok; el.onerror = mal; });
    const cargarMapa = () => {
      // La hoja de Leaflet va antes de main.css, para que nuestros estilos del mapa sigan mandando
      const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: new URL('../vendor/leaflet/leaflet.css', scriptBase).href });
      const js = Object.assign(document.createElement('script'), { src: new URL('../vendor/leaflet/leaflet.js', scriptBase).href });
      const listos = Promise.all([cargar(css), cargar(js)]);
      document.head.insertBefore(css, document.querySelector('link[rel="stylesheet"]'));
      document.head.appendChild(js);
      listos.then(() => (window.L ? iniciarMapa() : sinMapa()), sinMapa);
    };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); cargarMapa(); } }, { rootMargin: '900px 0px' });
      io.observe(ruta);
    } else cargarMapa();
  }

  // Ensaladas: una carta por poeta. Deslizas (o tocas un punto, o flechas del teclado) y la carta gira a la siguiente;
  // las fichas y los ingredientes brotan alrededor. Pasa sola mientras nadie la toca.
  const ens = document.querySelector('[data-ensaladas]');
  if (ens) {
    const escena = ens.querySelector('[data-escena]');
    const slides = [...escena.querySelectorAll('.es')];
    const puntos = [...ens.querySelectorAll('[data-ir]')];
    const n = slides.length;
    let actual = 0, tocado = false, encima = false, visible = false;
    const pintar = () => {
      ens.dataset.vibra = slides[actual].dataset.vibra;
      puntos.forEach((p, k) => p.setAttribute('aria-selected', String(k === actual)));
      slides.forEach((s, k) => { s.inert = k !== actual; });
    };
    // Giro 360 completo: la que se va se ve hasta los 90°, la que llega entra volteada (180°) y se endereza a los 270°,
    // así ninguna se ve al revés. dir 1 = siguiente (gira hacia la izquierda, como al deslizar).
    const giro = escena.querySelector('[data-giro]');
    let girando = false;
    const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const mostrar = (i, dir) => {
      i = (i + n) % n;
      if (i === actual || girando) return;
      const sale = slides[actual], entra = slides[i];
      actual = i;
      if (reduceMotion) { sale.dataset.pos = '1'; entra.dataset.pos = '0'; pintar(); return; }
      girando = true;
      let t0 = null, cambio = false;
      const paso = (ts) => {
        if (t0 === null) t0 = ts;
        const t = Math.min(1, (ts - t0) / 1500), e = suave(t), a = 360 * e;
        giro.style.transform = `rotateY(${-dir * a}deg) scale(${1 - 0.14 * Math.sin(Math.PI * e)})`;
        if (a >= 90 && !cambio) { cambio = true; sale.dataset.pos = '1'; entra.dataset.pos = '0'; pintar(); }
        entra.style.transform = cambio && a < 270 ? 'rotateY(180deg)' : '';
        if (t < 1) requestAnimationFrame(paso);
        else { giro.style.transform = ''; entra.style.transform = ''; girando = false; }
      };
      requestAnimationFrame(paso);
    };
    slides.forEach((s, k) => { s.dataset.pos = k === 0 ? '0' : '1'; });
    pintar();
    const usuario = () => { tocado = true; };
    puntos.forEach((p) => p.addEventListener('click', () => { usuario(); const i = +p.dataset.ir; mostrar(i, i > actual ? 1 : -1); }));
    escena.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); usuario(); mostrar(actual + 1, 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); usuario(); mostrar(actual - 1, -1); }
    });
    let x0 = null;
    escena.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    escena.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) < 40) return;
      usuario();
      mostrar(actual + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    });
    escena.addEventListener('pointercancel', () => { x0 = null; });
    escena.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') encima = true; });
    escena.addEventListener('pointerleave', () => { encima = false; });
    if (!reduceMotion) {
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.4 }).observe(escena);
      }
      setInterval(() => { if (visible && !tocado && !encima && !document.hidden) mostrar(actual + 1, 1); }, 5000);
    }
  }

  // Cold Wave: líneas de pulso (homenaje a Unknown Pleasures) + sintonizador FM. Cada estación es una Cold Wave: al acercarse
  // la aguja, las líneas toman su forma; sintonizada, su nombre sale en rojo entre las líneas y medio vaso entra con glitch
  // por el borde derecho. Entre estaciones hay estática.
  const cold = document.querySelector('[data-cold]');
  const ondas = cold && cold.querySelector('[data-ondas="atras"]');
  if (ondas) {
    // El nombre queda a media altura: las líneas desde BASE pasan enfrente y lo tapan cuando suben
    const N = 48, W = 800, VH = 400, Y0 = 18, Y1 = 392, BASE = 27, PASO = 4, NS = 'http://www.w3.org/2000/svg';
    const frente = cold.querySelector('[data-ondas="frente"]');
    const lineas = Array.from({ length: N }, (_, i) => [0, 1].map((k) => { const p = (i < BASE ? ondas : frente).appendChild(document.createElementNS(NS, 'path')); p.setAttribute('class', k ? 'raya' : 'tapa'); return p; }));
    const estaciones = [...cold.querySelectorAll('[data-estaciones] li')].map((li) => ({ f: +li.dataset.f, banda: li.dataset.banda, sabor: li.dataset.sabor }));
    const azar = (sem) => () => ((sem = (sem * 16807) % 2147483647) - 1) / 2147483646;
    const firma = (k) => { const r = azar(9301 + k * 7919); return Array.from({ length: N }, () => [0, 1, 2].map(() => [r() * 360 - 180, 12 + r() * 26, 6 + r() * 26])); };
    const firmas = estaciones.map((_, k) => firma(k));
    const dial = cold.querySelector('[data-dial]'), frecuencia = cold.querySelector('[data-frecuencia]');
    const nombre = cold.querySelector('[data-nombre]'), ingredientes = cold.querySelector('[data-ingredientes]'), anuncio = cold.querySelector('[data-anuncio]');
    // Cada vaso tiene dos mitades: la izquierda se asoma por el borde derecho y la derecha por el izquierdo
    const fotos = [...cold.querySelectorAll('[data-vaso] img')].map((img) => {
      const otra = img.cloneNode(); otra.classList.add('cold__otra'); img.after(otra); return [img, otra];
    });
    const TOL = 0.9; // MHz alrededor de cada estación donde ya se “oye” algo
    let cerca = 0, senal = 0, sel = null, t = 0;
    const dibujar = () => {
      const forma = firmas[cerca], estatica = (1 - senal) * 1.8;
      lineas.forEach(([tapa, raya], i) => {
        const y0 = Y0 + i * ((Y1 - Y0) / (N - 1)); let d = `M0 ${y0}`;
        for (let x = 0; x <= W; x += PASO) {
          const env = Math.min(1, x / 40, (W - x) / 40), cx = (x - W / 2) / 260, foco = Math.exp(-cx * cx);
          let h = 0;
          for (const [mu, sg, ht] of forma[i]) h += ht * Math.exp(-(((x - W / 2 - mu) / sg) ** 2));
          h = h * senal * foco + Math.sin(x * .7 + i * 3 + t) * .6 + (reduceMotion ? 0 : (Math.random() * 2 - 1) * estatica);
          d += ` L${x} ${(y0 - h * env).toFixed(1)}`;
        }
        raya.setAttribute('d', d); tapa.setAttribute('d', d + ` L${W} ${VH} L0 ${VH} Z`);
      });
    };
    const sintonizar = () => {
      const f = +dial.value;
      frecuencia.textContent = `FM ${f.toFixed(1)}`;
      cerca = estaciones.reduce((m, e, k) => (Math.abs(e.f - f) < Math.abs(estaciones[m].f - f) ? k : m), 0);
      const df = Math.abs(estaciones[cerca].f - f);
      senal = Math.max(0, 1 - df / TOL); senal = senal * senal * (3 - 2 * senal);
      const k = df <= 0.35 ? cerca : null;
      if (k !== sel) {
        sel = k;
        cold.classList.toggle('is-on', k !== null);
        fotos.forEach((par, i) => par.forEach((img) => img.classList.toggle('is-on', i === k)));
        if (k !== null) {
          const e = estaciones[k];
          nombre.textContent = e.banda; ingredientes.textContent = e.sabor;
          dial.setAttribute('aria-valuetext', `FM ${f.toFixed(1)}: ${e.banda}`);
          anuncio.textContent = `${e.banda}. ${e.sabor}`;
          if (!reduceMotion) [nombre, ...fotos[k]].forEach((el) => { el.classList.remove('is-glitch'); void el.offsetWidth; el.classList.add('is-glitch'); });
        } else {
          dial.setAttribute('aria-valuetext', `FM ${f.toFixed(1)}: estática`);
        }
      }
      if (reduceMotion) dibujar();
    };
    // Pista inicial: la primera vez que se ve la sección la aguja barre el dial sola (pasa por Bauhaus y se queda en Human Tetris)
    // y una etiqueta “Desliza” sigue a la aguja hasta que la persona lo mueve
    const radio = cold.querySelector('.cold__radio'), pista = cold.querySelector('[data-pista]');
    let tocado = false, barrido = 0;
    const ponPista = () => {
      const pos = (dial.value - dial.min) / (dial.max - dial.min);
      radio.style.setProperty('--pos', pos); radio.style.setProperty('--pista-top', dial.offsetTop + 'px');
      radio.classList.toggle('pista-izq', pos > .7);
    };
    const quitaPista = () => { tocado = true; cancelAnimationFrame(barrido); radio.classList.remove('con-pista'); };
    ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => dial.addEventListener(ev, quitaPista, { passive: true }));
    if (pista && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting || tocado) return;
        io.disconnect();
        radio.classList.add('con-pista'); ponPista();
        if (reduceMotion) return;
        const de = 88.2, a = 92.4, dur = 2600, t0 = performance.now();
        const paso = (ahora) => {
          if (tocado) return;
          const p = Math.min(1, (ahora - t0) / dur), ease = p < .5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
          dial.value = (de + (a - de) * ease).toFixed(1); sintonizar(); ponPista();
          if (p < 1) barrido = requestAnimationFrame(paso);
        };
        setTimeout(() => { if (!tocado) barrido = requestAnimationFrame(paso); }, 400);
      }, { threshold: .6 });
      io.observe(radio);
    }
    dial.addEventListener('input', sintonizar);
    // Al soltar cerca de una estación, la aguja se acomoda en ella
    dial.addEventListener('change', () => { const e = estaciones[cerca]; if (Math.abs(e.f - dial.value) < TOL) { dial.value = e.f; sintonizar(); } });
    sintonizar(); dibujar();
    if (!reduceMotion) {
      let visible = false;
      new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(cold.querySelector('.cold__mesa'));
      const bucle = () => { if (visible) { t += .05; dibujar(); } requestAnimationFrame(bucle); };
      requestAnimationFrame(bucle);
    }
  }

  // Horario: marca el día de hoy (hora de Coacalco)
  const horario = document.querySelector('[data-horario]');
  if (horario) {
    const dia = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/Mexico_City' }).format(new Date())];
    horario.querySelectorAll('[data-dias]').forEach((fila) => fila.classList.toggle('es-hoy', fila.dataset.dias.split(' ').includes(String(dia))));
  }

  // Transiciones al hacer scroll: cada bloque sube y aparece suave al entrar en pantalla (nada si se pide menos movimiento)
  const revelar = [...document.querySelectorAll('.pizzas__concepto, .ensaladas__titulo, .visit__title, .ruta, .visit__body, .cold__texto, .manifesto__title, .manifesto__row, .fuego__texto, .fuego__fantasma, .pf-cabeza, .pf-paso, .pf-wallet, .pf-calc__cabeza, .pf-calc__control, .pf-calc__res, .pf-caduca__in, .pf-faq, .pf-final__titulo')];
  if (!reduceMotion && 'IntersectionObserver' in window && revelar.length) {
    const io = new IntersectionObserver((entradas) => entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-visto'); io.unobserve(e.target);
    }), { rootMargin: '0px 0px -8% 0px', threshold: .12 });
    revelar.forEach((el) => {
      // Los hermanos que entran juntos (tarjetas) llegan escalonados
      const hermanos = revelar.filter((o) => o.parentElement === el.parentElement);
      el.style.setProperty('--r-delay', `${Math.min(hermanos.indexOf(el), 4) * 90}ms`);
      el.classList.add('revela');
      if (el.getBoundingClientRect().top < innerHeight * .92) el.classList.add('is-visto');
      else io.observe(el);
    });
  }

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
});
