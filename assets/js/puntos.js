// Puntos de Fuego: calculadora de cuánto regresa en puntos (5% ahora, 2% antes), en 1 mes y en 6 meses (lo que dura un punto).
document.addEventListener('DOMContentLoaded', () => {
  const calc = document.querySelector('[data-calc]');
  if (!calc) return;
  const barra = calc.querySelector('[data-gasto]');
  const $ = (s) => calc.querySelector(s);
  const pesos = (n) => '$' + Math.round(n).toLocaleString('es-MX');
  const MAX6 = +barra.max * 6 * 0.05;
  const pintar = () => {
    const g = +barra.value, mes = g * 0.05, seis = mes * 6, antes = g * 0.02 * 6;
    $('[data-gasto-txt]').textContent = pesos(g);
    $('[data-mes]').textContent = Math.round(mes).toLocaleString('es-MX');
    $('[data-seis]').textContent = pesos(seis);
    $('[data-antes]').textContent = pesos(antes);
    $('[data-dif]').textContent = pesos(seis - antes);
    $('[data-barra-ahora]').style.width = `${Math.max(18, (seis / MAX6) * 100)}%`;
    $('[data-barra-antes]').style.width = `${Math.max(18, (antes / MAX6) * 100)}%`;
    barra.style.setProperty('--p', `${((g - barra.min) / (barra.max - barra.min)) * 100}%`);
    barra.setAttribute('aria-valuetext', `${pesos(g)} al mes`);
  };
  barra.addEventListener('input', pintar);
  pintar();
});
