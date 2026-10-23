// Eventos: arma el mensaje de WhatsApp con la fecha, los invitados, la modalidad y lo que el cliente quiere incluir.
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('[data-evento-form]');
  if (!form) return;
  const WA = 'https://api.whatsapp.com/send/?phone=525535023665&text=';
  const aviso = form.querySelector('[data-evento-aviso]');
  const invitados = form.elements.invitados;
  const modalidad = form.elements.modalidad;

  // Los botones "Cotiza ..." de las tarjetas eligen la modalidad y bajan al formulario.
  document.querySelectorAll('[data-modalidad]').forEach((a) => {
    a.addEventListener('click', () => { modalidad.value = a.dataset.modalidad; });
  });

  const avisar = () => {
    const n = parseInt(invitados.value, 10);
    aviso.hidden = !(n > 0 && n < 25);
  };
  invitados.addEventListener('input', avisar);

  const falta = form.querySelector('[data-evento-falta]');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const limpia = (v) => v.replace(/\s+/g, ' ').trim();
    const nombre = limpia(form.elements.nombre.value), tel = limpia(form.elements.telefono.value);
    falta.hidden = !!(nombre && tel);
    if (!nombre || !tel) { (nombre ? form.elements.telefono : form.elements.nombre).focus(); return; }
    const incluir = [...form.querySelectorAll('input[name="inc"]:checked')].map((i) => i.value);
    const partes = ['Hola, quiero cotizar un evento en Laymon.'];
    if (modalidad.value) partes.push(`Modalidad: ${modalidad.value}.`);
    partes.push(`Fecha: ${form.elements.fecha.value.trim() || 'por definir'}.`);
    partes.push(`Invitados: ${invitados.value.trim() || 'por definir'}.`);
    const imagina = limpia(form.elements.imagina.value);
    if (imagina) partes.push(`Cómo lo imagino: ${imagina}.`);
    if (incluir.length) partes.push(`Me gustaría incluir: ${incluir.join(', ')}.`);
    const correo = limpia(form.elements.correo.value);
    partes.push(`Mis datos: ${nombre}, tel. ${tel}${correo ? `, ${correo}` : ''}.`);
    window.open(WA + encodeURIComponent(partes.join(' ')), '_blank', 'noopener');
  });
});
