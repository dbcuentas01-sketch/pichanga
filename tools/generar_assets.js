'use strict';
/*
 * generar_assets.js — produce los íconos, el QR y el afiche imprimible.
 *
 * Uso:
 *   npm install
 *   node tools/generar_assets.js
 *
 * La dirección pública se puede cambiar sin tocar el código:
 *   PICHANGA_URL=https://otra.direccion/ node tools/generar_assets.js
 *
 * Esto NO hace falta para usar la app: los archivos que genera ya están
 * en el repositorio. Solo se corre si cambia el ícono o la dirección.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const QRCode = require('qrcode');

const RAIZ = path.join(__dirname, '..');
const URL_PUBLICA = process.env.PICHANGA_URL || 'https://dbcuentas01-sketch.github.io/pichanga/';

const ROJO = '#D7263D';
const ROJO_OS = '#A41B2D';
const CREMA = '#EFE9E0';
const TINTA = '#17120E';
const TINTA_2 = '#5B5248';

function asegurar(dir) { fs.mkdirSync(dir, { recursive: true }); }

/* ===================== ÍCONOS ===================== */

async function iconos() {
  const dir = path.join(RAIZ, 'icons');
  asegurar(dir);

  const trabajos = [
    { origen: 'icono.svg',           destino: 'icon-192.png',          tam: 192 },
    { origen: 'icono.svg',           destino: 'icon-512.png',          tam: 512 },
    { origen: 'icono-maskable.svg',  destino: 'icon-maskable-512.png', tam: 512 },
    { origen: 'icono-cuadrado.svg',  destino: 'apple-touch-icon.png',  tam: 180 },
    { origen: 'icono.svg',           destino: 'favicon-32.png',        tam: 32  }
  ];

  for (const t of trabajos) {
    const svg = fs.readFileSync(path.join(dir, t.origen));
    await sharp(svg, { density: 384 })
      .resize(t.tam, t.tam, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(path.join(dir, t.destino));
    console.log('  icono  ' + t.destino + '  (' + t.tam + 'px)');
  }
}

/* ===================== QR ===================== */

/*
 * Se construye el camino del QR a mano a partir de la matriz de módulos.
 * Así el mismo dibujo sirve para el archivo suelto y para el afiche, con
 * las coordenadas bajo control en vez de tener que parsear un SVG ajeno.
 */
function caminoQR(matriz, lado, modulos, margen) {
  const paso = lado / (modulos + margen * 2);
  let d = '';
  for (let f = 0; f < modulos; f++) {
    for (let c = 0; c < modulos; c++) {
      if (matriz.get(c, f)) {
        const x = (c + margen) * paso;
        const y = (f + margen) * paso;
        /* +0.4 de solape: evita hilos blancos entre módulos al rasterizar */
        d += 'M' + x.toFixed(3) + ',' + y.toFixed(3) +
             'h' + (paso + 0.4).toFixed(3) +
             'v' + (paso + 0.4).toFixed(3) +
             'h' + (-(paso + 0.4)).toFixed(3) + 'z';
      }
    }
  }
  return d;
}

function datosQR(texto) {
  /* Corrección 'Q': aguanta hasta un 25% del código dañado. Un afiche
     pegado en la losa se ensucia, se despinta y le cae sol. */
  const qr = QRCode.create(texto, { errorCorrectionLevel: 'Q' });
  return { matriz: qr.modules, modulos: qr.modules.size };
}

async function qr() {
  const dir = path.join(RAIZ, 'qr');
  asegurar(dir);

  const { matriz, modulos } = datosQR(URL_PUBLICA);
  const LADO = 1000, MARGEN = 4;
  const d = caminoQR(matriz, LADO, modulos, MARGEN);

  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + LADO + ' ' + LADO + '" ' +
    'width="' + LADO + '" height="' + LADO + '" shape-rendering="crispEdges">\n' +
    '  <title>Pichanga — ' + URL_PUBLICA + '</title>\n' +
    '  <rect width="' + LADO + '" height="' + LADO + '" fill="#FFFFFF"/>\n' +
    '  <path d="' + d + '" fill="#17120E"/>\n' +
    '</svg>\n';

  fs.writeFileSync(path.join(dir, 'pichanga-qr.svg'), svg);
  console.log('  qr     pichanga-qr.svg  (' + modulos + 'x' + modulos + ' módulos)');

  await sharp(Buffer.from(svg)).resize(1024, 1024).png({ compressionLevel: 9 })
    .toFile(path.join(dir, 'pichanga-qr.png'));
  console.log('  qr     pichanga-qr.png  (1024px)');

  return { matriz, modulos };
}

/* ===================== AFICHE ===================== */

function aficheSVG(matriz, modulos) {
  const A = 600, ALTO = 850;          /* proporción A5 */
  const LADO_QR = 300;
  const X_QR = (A - LADO_QR) / 2, Y_QR = 358;
  const d = caminoQR(matriz, LADO_QR, modulos, 2);

  /* El ícono se dibuja aquí mismo, no se enlaza: el afiche tiene que ser
     un solo archivo que se pueda mandar por correo o llevar a imprimir. */
  const icono = `
  <g transform="translate(228,52) scale(0.281)">
    <rect x="0" y="0" width="512" height="512" rx="114" ry="114" fill="url(#degradado)"/>
    <g clip-path="url(#recorteIcono)">
      <g stroke="#FFF3E2" fill="none" opacity="0.34">
        <circle cx="256" cy="318" r="124" stroke-width="17"/>
        <path d="M-10,318 H522" stroke-width="17"/>
      </g>
      <ellipse cx="256" cy="372" rx="104" ry="20" fill="#5A0E1C" opacity="0.3"/>
    </g>
    <circle cx="256" cy="246" r="116" fill="#FBF7EF"/>
    <circle cx="256" cy="246" r="116" fill="none" stroke="#1C1512" stroke-width="13"/>
    <path d="M256,178 L311,218 L290,282 L222,282 L201,218 Z" fill="#1C1512"/>
    <g stroke="#1C1512" stroke-width="13" stroke-linecap="round" fill="none">
      <path d="M256,178 L256,136"/><path d="M311,218 L352,205"/>
      <path d="M290,282 L316,317"/><path d="M222,282 L196,317"/>
      <path d="M201,218 L160,205"/>
    </g>
  </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${A} ${ALTO}" width="${A}" height="${ALTO}">
  <defs>
    <linearGradient id="degradado" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="#E13347"/><stop offset="1" stop-color="${ROJO_OS}"/>
    </linearGradient>
    <clipPath id="recorteIcono">
      <rect x="0" y="0" width="512" height="512" rx="114" ry="114"/>
    </clipPath>
  </defs>

  <rect width="${A}" height="${ALTO}" fill="${CREMA}"/>
  <rect width="${A}" height="14" fill="${ROJO}"/>
  <rect y="${ALTO - 14}" width="${A}" height="14" fill="${ROJO}"/>
${icono}

  <text x="${A / 2}" y="248" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
        font-size="62" font-weight="bold" fill="${TINTA}">Pichanga</text>
  <text x="${A / 2}" y="286" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
        font-size="21" font-weight="bold" letter-spacing="4.5" fill="${ROJO_OS}">EQUIPOS PAREJOS</text>
  <text x="${A / 2}" y="322" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
        font-size="20" fill="${TINTA_2}">Arma equipos parejos para tu pichanga</text>

  <rect x="${X_QR - 22}" y="${Y_QR - 22}" width="${LADO_QR + 44}" height="${LADO_QR + 44}"
        rx="22" fill="#FFFFFF" stroke="#D8CDBC" stroke-width="2"/>
  <g transform="translate(${X_QR},${Y_QR})" shape-rendering="crispEdges">
    <path d="${d}" fill="${TINTA}"/>
  </g>

  <text x="${A / 2}" y="${Y_QR + LADO_QR + 82}" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="bold" fill="${TINTA}">
    Escanea para instalar
  </text>
  <text x="${A / 2}" y="${Y_QR + LADO_QR + 120}" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="19" fill="${TINTA_2}">
    Se abre en el navegador. No hace falta cuenta ni tienda de apps.
  </text>
  <text x="${A / 2}" y="${ALTO - 30}" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="17" fill="${TINTA_2}">
    ${URL_PUBLICA}
  </text>
</svg>
`;
}

async function afiche(matriz, modulos) {
  const dir = path.join(RAIZ, 'qr');
  const svg = aficheSVG(matriz, modulos);
  fs.writeFileSync(path.join(dir, 'pichanga-afiche.svg'), svg);
  console.log('  afiche pichanga-afiche.svg');

  /* A5 a 300 ppp = 1748 x 2480 px. Listo para imprimir sin que se pixele. */
  await sharp(Buffer.from(svg), { density: 300 })
    .resize(1748, 2480)
    .flatten({ background: CREMA })
    .png({ compressionLevel: 9 })
    .toFile(path.join(dir, 'pichanga-afiche.png'));
  console.log('  afiche pichanga-afiche.png  (1748x2480, A5 a 300 ppp)');
}

/* ===================== Arranque ===================== */

(async function () {
  console.log('');
  console.log('Generando assets de Pichanga');
  console.log('Dirección pública: ' + URL_PUBLICA);
  console.log('');
  await iconos();
  const { matriz, modulos } = await qr();
  await afiche(matriz, modulos);
  console.log('');
  console.log('Listo.');
  console.log('');
})().catch(function (e) {
  console.error('Falló la generación:', e);
  process.exit(1);
});
