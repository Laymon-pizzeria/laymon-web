// Invitación digital: pinta los datos del evento que llegan en el enlace (?n=nombre&f=fecha&h=hora&a=anfitrión&m=mensaje).
// Todo entra con textContent, nunca como HTML. Sin parámetros, muestra el generador para el equipo.
document.addEventListener('DOMContentLoaded', () => {
  const q = new URLSearchParams(location.search);
  const limpia = (v, max) => (v || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const nombre = limpia(q.get('n'), 60);
  const $ = (s) => document.querySelector(s);

  if (nombre) {
    const fecha = limpia(q.get('f'), 60), hora = limpia(q.get('h'), 30);
    const anfitrion = limpia(q.get('a'), 60), mensaje = limpia(q.get('m'), 120);
    $('[data-inv-nombre]').textContent = nombre;
    $('[data-inv-cuando]').textContent = [fecha, hora].filter(Boolean).join(' · ') || 'Por confirmar';
    if (mensaje) { const m = $('[data-inv-mensaje]'); m.textContent = `“${mensaje}”`; m.hidden = false; }
    if (anfitrion) { const a = $('[data-inv-anfitrion]'); a.textContent = `De parte de ${anfitrion}`; a.hidden = false; }
    document.title = `${nombre} · Estás invitado`;
    $('[data-inv-tarjeta]').hidden = false;
    return;
  }

  $('[data-inv-generador]').hidden = false;
  const form = $('[data-inv-form]'), res = $('[data-inv-resultado]');
  const enlace = $('[data-inv-enlace]'), ok = $('[data-inv-ok]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    ['n', 'f', 'h', 'a', 'm'].forEach((k) => { const v = limpia(form.elements[k].value, 120); if (v) p.set(k, v); });
    if (!p.get('n')) { ok.textContent = 'Escribe al menos el nombre del evento.'; res.hidden = false; enlace.value = ''; return; }
    const url = `${location.origin}${location.pathname}?${p.toString()}`;
    enlace.value = url; $('[data-inv-ver]').href = url; ok.textContent = ''; res.hidden = false;
  });
  $('[data-inv-copiar]').addEventListener('click', () => {
    const listo = () => { ok.textContent = 'Copiado.'; };
    const manual = () => { enlace.focus(); enlace.select(); ok.textContent = 'Selecciónalo y cópialo a mano.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(enlace.value).then(listo, manual); else manual();
  });
});
