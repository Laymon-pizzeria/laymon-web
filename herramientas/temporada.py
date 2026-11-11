#!/usr/bin/env python3
"""Interruptor de temporada del fantasma.

    python3 herramientas/temporada.py navidad   # todas las poses pasan a assets/img/fantasma/navidad/
    python3 herramientas/temporada.py normal    # regresan a assets/img/fantasma/poses/

Solo cambia rutas (y width/height de cada <img>, para que no brinque el layout) en los
HTML y CSS del sitio. Las poses originales nunca se tocan. Para otra temporada (Halloween,
aniversario...), crea assets/img/fantasma/<temporada>/ con los MISMOS nombres de archivo
que poses/ y córrelo con ese nombre. Sin dependencias: solo Python 3.
"""
import pathlib, re, struct, sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
FANTASMA = RAIZ / 'assets/img/fantasma'


def medida_webp(p):
    b = p.read_bytes()[:30]
    if b[12:16] == b'VP8X':
        return 1 + int.from_bytes(b[24:27], 'little'), 1 + int.from_bytes(b[27:30], 'little')
    if b[12:16] == b'VP8L':
        n = int.from_bytes(b[21:25], 'little')
        return (n & 0x3FFF) + 1, ((n >> 14) & 0x3FFF) + 1
    w, h = struct.unpack('<HH', b[26:30])
    return w & 0x3FFF, h & 0x3FFF


def main():
    destino = sys.argv[1] if len(sys.argv) > 1 else ''
    carpeta = 'poses' if destino == 'normal' else destino
    if not (FANTASMA / carpeta).is_dir():
        sys.exit(f'No existe assets/img/fantasma/{carpeta}/  (usa: navidad | normal)')
    otras = '|'.join(re.escape(d.name) for d in FANTASMA.iterdir() if d.is_dir())
    patron = re.compile(r'(fantasma/)(' + otras + r')/([\w-]+)\.webp("?)((?:\s+width="\d+"\s+height="\d+")?)')

    def cambiar(m):
        nuevo = FANTASMA / carpeta / f'{m.group(3)}.webp'
        if not nuevo.exists():  # esa pose no existe en la temporada: se queda la que estaba
            return m.group(0)
        medidas = m.group(5)
        if medidas:
            w, h = medida_webp(nuevo)
            # mantener el ancho del HTML y ajustar el alto a la proporción nueva
            w0 = int(re.search(r'width="(\d+)"', medidas).group(1))
            medidas = f' width="{w0}" height="{round(w0 * h / w)}"'
        return f'{m.group(1)}{carpeta}/{m.group(3)}.webp{m.group(4)}{medidas}'

    cambios = 0
    for f in list(RAIZ.rglob('*.html')) + list((RAIZ / 'assets/css').glob('*.css')):
        if 'herramientas' in f.parts:
            continue
        t = f.read_text(encoding='utf-8')
        n = patron.sub(cambiar, t)
        if n != t:
            f.write_text(n, encoding='utf-8')
            cambios += 1
            print('  ', f.relative_to(RAIZ))
    print(f'Temporada «{destino}»: {cambios} archivos actualizados.')


main()
