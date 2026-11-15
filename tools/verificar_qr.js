'use strict';
/*
 * verificar_qr.js — lee los QR generados como lo haría un celular y
 * comprueba que apuntan a la dirección esperada.
 *
 * Generar un QR y mirarlo no prueba nada: hay que decodificarlo.
 *
 * Uso:  node tools/verificar_qr.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const jsQR = require('jsqr');

const RAIZ = path.join(__dirname, '..');
const ESPERADA = process.env.PICHANGA_URL || 'https://dbcuentas01-sketch.github.io/pichanga/';

async function leer(archivo, recorte) {
  let img = sharp(archivo, { density: 300 });
  if (recorte) img = img.extract(recorte);
  const { data, info } = await img
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data), info.width, info.height);
}

(async function () {
  let fallos = 0;
  console.log('');
  console.log('Verificando los QR');
  console.log('Se espera: ' + ESPERADA);
  console.log('');

  const casos = [
    { nombre: 'qr/pichanga-qr.png', archivo: path.join(RAIZ, 'qr', 'pichanga-qr.png') },
    { nombre: 'qr/pichanga-qr.svg', archivo: path.join(RAIZ, 'qr', 'pichanga-qr.svg') },
    {
      nombre: 'qr/pichanga-afiche.png (recortando el QR del afiche)',
      archivo: path.join(RAIZ, 'qr', 'pichanga-afiche.png'),
      /* El afiche mide 1748x2480 y el QR vive en un recuadro conocido.
         Se recorta con margen para que el lector lo aísle del resto. */
      recorte: { left: 380, top: 950, width: 990, height: 990 }
    }
  ];

  for (const caso of casos) {
    if (!fs.existsSync(caso.archivo)) {
      console.log('  FALTA  ' + caso.nombre);
      fallos++;
      continue;
    }
    let leido = null;
    try { leido = await leer(caso.archivo, caso.recorte); }
    catch (e) { console.log('  ERROR  ' + caso.nombre + ' -> ' + e.message); fallos++; continue; }

    if (!leido) {
      console.log('  NO SE PUDO LEER  ' + caso.nombre);
      fallos++;
    } else if (leido.data !== ESPERADA) {
      console.log('  DIRECCIÓN DISTINTA  ' + caso.nombre);
      console.log('          leyó: ' + leido.data);
      fallos++;
    } else {
      console.log('  ok     ' + caso.nombre);
      console.log('         -> ' + leido.data);
    }
  }

  console.log('');
  if (fallos) {
    console.log('  ' + fallos + ' problema(s). El QR NO está listo para imprimir.');
    process.exit(1);
  }
  console.log('  Todos los QR apuntan a la dirección correcta.');
  console.log('');
})();
