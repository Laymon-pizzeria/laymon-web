// Sorteo de intercambio: mezcla los nombres en un solo círculo (nadie se toca a sí mismo) y arma un enlace secreto por persona.
// No hay servidor: la asignación viaja dentro del enlace (?r=). Todo se pinta con textContent, nunca como HTML.
document.addEventListener('DOMContentLoaded', () => {
  const $ = (s) => document.querySelector(s);
  const limpia = (v, max) => (v || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const empaca = (o) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const desempaca = (t) => {
    const b = atob(t.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0))));
  };

  const r = new URLSearchParams(location.search).get('r');
  if (r) {
    let d = null;
    try { d = desempaca(r); } catch (_) { /* enlace dañado */ }
    const de = d && limpia(d.de, 60), a = d && limpia(d.a, 60);
    if (de && a) {
      $('[data-ic-hola]').textContent = `Hola, ${de}`;
      if (d.e) $('[data-ic-evento]').textContent = limpia(d.e, 60);
      $('[data-ic-a]').textContent = a;
      const x = limpia(d.x, 120);
      if (x) { $('[data-ic-extra]').textContent = x; $('[data-ic-detalles]').hidden = false; }
      $('[data-ic-ver]').addEventListener('click', (ev) => { ev.currentTarget.hidden = true; $('[data-ic-resultado]').hidden = false; });
      $('[data-ic-revela]').hidden = false;
      return;
    }
  }

  $('[data-ic-generador]').hidden = false;
  const error = $('[data-ic-error]'), lista = $('[data-ic-lista]');
  const avisa = (t) => { error.textContent = t; error.hidden = !t; };

  const mezcla = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  $('[data-ic-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const nombres = f.elements.n.value.split('\n').map((n) => limpia(n, 60)).filter(Boolean);
    const unicos = new Set(nombres.map((n) => n.toLowerCase()));
    lista.replaceChildren(); lista.hidden = true;
    if (nombres.length < 3) return avisa('Escribe al menos 3 nombres.');
    if (unicos.size !== nombres.length) return avisa('Hay nombres repetidos. Agrega una inicial para distinguirlos, por ejemplo "Ana M." y "Ana R.".');
    avisa('');
    const evento = limpia(f.elements.e.value, 60), extra = limpia(f.elements.x.value, 120);
    const ronda = mezcla(nombres);
    ronda.forEach((de, i) => {
      const a = ronda[(i + 1) % ronda.length];
      const url = `${location.origin}${location.pathname}?r=${empaca({ de, a, e: evento, x: extra })}`;
      const texto = `Hola ${de}, este es tu enlace secreto del intercambio${evento ? ` (${evento})` : ''}. No se lo enseñes a nadie: ${url}`;
      const li = document.createElement('li');
      const n = document.createElement('strong'); n.textContent = de;
      const wa = document.createElement('a');
      wa.className = 'ev-cta'; wa.target = '_blank'; wa.rel = 'noopener';
      wa.href = `https://api.whatsapp.com/send/?text=${encodeURIComponent(texto)}`; wa.textContent = 'Mandar por WhatsApp →';
      const cp = document.createElement('button');
      cp.type = 'button'; cp.className = 'ic-copiar'; cp.textContent = 'Copiar enlace';
      cp.addEventListener('click', () => {
        const listo = () => { cp.textContent = 'Copiado'; setTimeout(() => { cp.textContent = 'Copiar enlace'; }, 1800); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(listo, () => { cp.textContent = 'No se pudo copiar'; });
        else cp.textContent = 'No se pudo copiar';
      });
      li.append(n, wa, cp);
      lista.append(li);
    });
    lista.hidden = false;
    lista.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });
});
