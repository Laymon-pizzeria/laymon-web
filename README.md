# laymon-web

Sitio de [laymonpizzeria.com](https://www.laymonpizzeria.com): escaparate de marca. Los pedidos y reservas viven en Justo (`laymonpizzeria.getjusto.com`).

HTML, CSS y JS sin dependencias ni paso de build. Para verlo local:

```
npx http-server -p 8080
```

## Estructura

- `index.html` — home
- `assets/css/main.css` — tokens y estilos (mismas fuentes y colores que el menú de Justo)
- `assets/js/main.js` — nav que se esconde, barra fija en móvil, truco del fantasma y parallax, playlist bajo demanda
- `assets/fonts/` — Brick-Laymon (display) y Chelsea Market (texto), woff2
- `assets/img/fantasma/` — fantasma skater, 6 cuadros SVG del mismo sprite que el intro de Justo
- `assets/img/logo/` — logo oficial vectorizado (de Logo Blanco@4x.png en Drive) y favicons con el LMN
- `assets/img/iconos/` — íconos de categoría (los mismos del menú de Justo)

## Publicar

Cualquier hosting estático sirve (Vercel, Netlify, Cloudflare Pages): carpeta raíz, sin comando de build.
