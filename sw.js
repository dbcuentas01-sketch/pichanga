'use strict';
/*
 * sw.js — el service worker de Pichanga.
 *
 * Su único trabajo: que la app siga funcionando sin señal. En una losa
 * de barrio no siempre hay datos, y el organizador no puede quedarse
 * mirando una pantalla en blanco con doce personas esperando.
 *
 * Estrategia: caché primero para todo lo propio. La app no habla con
 * ningún servidor —todo el cálculo pasa en el teléfono—, así que una vez
 * guardada no necesita volver a pedir nada.
 */

/* Subir esta versión invalida la caché anterior y fuerza la actualización. */
const VERSION = 'pichanga-v1';

/*
 * Rutas relativas a propósito: la app vive en un subdirectorio
 * (/pichanga/) en GitHub Pages, y con rutas absolutas apuntarían a la
 * raíz del dominio y fallarían todas.
 */
const ARCHIVOS = [
  './',
  './index.html',
  './css/estilos.css',
  './js/reparto.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', function (evento) {
  evento.waitUntil(
    caches.open(VERSION).then(function (cache) {
      /* addAll falla entero si un solo archivo falla. Se piden de a uno
         para que un recurso ausente no deje la app sin caché ninguna. */
      return Promise.all(ARCHIVOS.map(function (ruta) {
        return cache.add(new Request(ruta, { cache: 'reload' })).catch(function () {
          console.warn('[sw] no se pudo guardar', ruta);
        });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    caches.keys().then(function (llaves) {
      return Promise.all(llaves.map(function (llave) {
        if (llave !== VERSION) return caches.delete(llave);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (evento) {
  const peticion = evento.request;

  /* Solo se toca lo propio y solo lecturas. */
  if (peticion.method !== 'GET') return;
  if (new URL(peticion.url).origin !== self.location.origin) return;

  /*
   * Navegación (abrir la app, recargar): se intenta la red primero para
   * que una versión nueva llegue sola, pero con la caché lista debajo.
   * Sin señal, cae en index.html guardado y la app abre igual.
   */
  if (peticion.mode === 'navigate') {
    evento.respondWith(
      fetch(peticion).then(function (respuesta) {
        const copia = respuesta.clone();
        caches.open(VERSION).then(function (c) { c.put('./index.html', copia); });
        return respuesta;
      }).catch(function () {
        return caches.match('./index.html').then(function (r) {
          return r || caches.match('./');
        });
      })
    );
    return;
  }

  /* Todo lo demás: caché primero, y si no está, red (y se guarda). */
  evento.respondWith(
    caches.match(peticion).then(function (guardada) {
      if (guardada) return guardada;
      return fetch(peticion).then(function (respuesta) {
        if (respuesta && respuesta.status === 200 && respuesta.type === 'basic') {
          const copia = respuesta.clone();
          caches.open(VERSION).then(function (c) { c.put(peticion, copia); });
        }
        return respuesta;
      });
    })
  );
});
