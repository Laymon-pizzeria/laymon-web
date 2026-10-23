# laymon-web

Sitio de [laymonpizzeria.com](https://www.laymonpizzeria.com): escaparate de marca. Los pedidos y reservas viven en Justo (`laymonpizzeria.getjusto.com`).

HTML, CSS y JS sin dependencias ni paso de build. Para verlo local:

```
npx http-server -p 8080
```

## Estructura

- `index.html` — home
- `assets/css/main.css` — tokens y estilos (mismas fuentes y colores que el menú de Justo)
- `assets/js/main.js` — intro, Pide ahora flotante, cascada de pizzas, ensaladas, mapa "Ven por una" (Leaflet se carga solo al acercarse), Cold Wave, horario y transiciones de scroll
- `assets/fonts/` — Brick-Laymon (display) y Chelsea Market (texto), woff2
- `assets/img/fantasma/` — fantasma skater, 6 cuadros SVG del mismo sprite que el intro de Justo
- `assets/img/logo/` — logo oficial vectorizado (de Logo Blanco@4x.png en Drive) y favicons con el LMN
- `assets/img/iconos/` — íconos de categoría (los mismos del menú de Justo)

## Páginas

- `/` — home
- `/puntos/` — Puntos de Fuego (recompensas: 5% en puntos, 1 punto = $1, caducan a los 6 meses); `assets/css/puntos.css`, `assets/js/puntos.js`
- `404.html` — página de error (GitHub Pages la sirve en cualquier ruta inexistente)
- `menu/`, `reparto/`, `preguntas-frecuentes-1/`, `unetealequipo/`, `cart/` — redirecciones de las direcciones viejas de Squarespace

Fantasma: las 9 poses oficiales están en `assets/img/fantasma/poses/` (una pose por sección). Los `skater-*.svg` solo quedan para la intro.

## Publicar

GitHub Pages desde `main` (raíz). Vista previa: https://laymon-pizzeria.github.io/laymon-web/

Para usar www.laymonpizzeria.com (el dominio sigue registrado en Squarespace):
1. En el DNS de Squarespace quitar los registros de Squarespace (A de `@` y CNAME `www` → ext-sq.squarespace.com) y agregar:
   A `@` → 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153; CNAME `www` → laymon-pizzeria.github.io.
   No tocar los CNAME `track`, `cotiza` ni `backstage` (apuntan a Render). El dominio no tiene correo (sin MX).
2. Agregar el archivo `CNAME` con `www.laymonpizzeria.com` en la raíz del repo (no antes: rompe la vista previa de github.io).
3. GitHub → Settings → Pages → Custom domain `www.laymonpizzeria.com` y, cuando el certificado esté listo, "Enforce HTTPS".
