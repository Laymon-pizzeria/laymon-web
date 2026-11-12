// Puntos de Fuego: calculadora de cuánto regresa en puntos (5%), en 1 mes y en 6 meses (lo que dura un punto).
document.addEventListener('DOMContentLoaded', () => {
  const calc = document.querySelector('[data-calc]');
  if (!calc) return;
  const barra = calc.querySelector('[data-gasto]');
  const $ = (s) => calc.querySelector(s);
  const pesos = (n) => '$' + Math.round(n).toLocaleString('es-MX');
  const pintar = () => {
    const g = +barra.value, mes = g * 0.05, seis = mes * 6;
    $('[data-gasto-txt]').textContent = pesos(g);
    $('[data-mes]').textContent = Math.round(mes).toLocaleString('es-MX');
    $('[data-seis]').textContent = pesos(seis);
    barra.style.setProperty('--p', `${((g - barra.min) / (barra.max - barra.min)) * 100}%`);
    barra.setAttribute('aria-valuetext', `${pesos(g)} al mes`);
  };
  barra.addEventListener('input', pintar);
  pintar();
});
