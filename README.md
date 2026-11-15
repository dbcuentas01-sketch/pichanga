# Pichanga

Arma equipos parejos para tu pichanga desde el borde de la losa, en un minuto.

**→ https://dbcuentas01-sketch.github.io/pichanga/**

Sin cuenta, sin tienda de apps, sin internet una vez instalada. Es HTML, CSS y
JavaScript a secas: no hay compilación ni dependencias que bajar.

---

## Instalarla en el celular

Se instala desde el navegador. Cada persona escanea el QR, se le abre la app y
confirma la instalación en su propio teléfono.

| | |
|---|---|
| **QR en PNG** | [`qr/pichanga-qr.png`](qr/pichanga-qr.png) — 1024 px |
| **QR en SVG** | [`qr/pichanga-qr.svg`](qr/pichanga-qr.svg) — vectorial, escala a cualquier tamaño |
| **Afiche para imprimir** | [`qr/pichanga-afiche.png`](qr/pichanga-afiche.png) — A5 a 300 ppp · también en [SVG](qr/pichanga-afiche.svg) |

El afiche lleva el ícono de Pichanga, el QR y el texto «Escanea para instalar».

**En Android, con Chrome:** aparece una franja con el botón *Instalar*. Si no
sale, menú **⋮** → *Instalar aplicación*.

**En iPhone, con Safari:** botón **Compartir** → *Añadir a pantalla de inicio*.
Tiene que ser Safari: desde Chrome de iPhone, iOS no deja instalar.

La app explica las dos rutas por dentro, en **¿Cómo instalar Pichanga?** al pie.

### Regenerar el QR si cambia la dirección

```bash
npm install
PICHANGA_URL=https://tu.direccion/ npm run assets
npm run verificar-qr
```

`verificar-qr` **decodifica** los archivos generados, como lo haría un celular,
y falla si no apuntan a donde deben. Generar un QR y mirarlo no prueba nada.

---

## Cómo ejecutarla en tu máquina

**La forma rápida:** abre `index.html` con doble clic. Funciona tal cual, pero
sin service worker: desde `file://` los navegadores no lo permiten.

**La forma recomendada**, para que el botón de copiar funcione en todos los
navegadores (algunos bloquean el portapapeles en `file://`):

```bash
cd pichanga
python -m http.server 5173
```

Luego abre `http://127.0.0.1:5173` en el navegador.

Si prefieres node:

```bash
npx http-server -p 5173
```

---

## Cómo se usa

1. **Jugadores.** Escribe el nombre y toca el nivel: se agrega solo y el campo
   queda listo para el siguiente. Con la tecla Enter se agrega como Intermedio,
   que es el caso más común.
   Toca el engranaje de cualquiera para abrir sus detalles: si puede tapar,
   su posición habitual y hasta dos fortalezas.
2. **Formato.** 2 equipos de 5, 2 de 6, 3 de 5 o 3 de 6. Solo se habilitan los
   que alcanzan con la gente que hay, y cada uno dice cuántos quedan rotando.
3. **Equipos.** Salen dos propuestas distintas. Puedes alternar entre ellas,
   mezclar de nuevo, o tocar a dos jugadores para intercambiarlos de sitio
   (también funciona con los que rotan).
   Al final, compartir por WhatsApp o copiar.

La lista se guarda sola en el aparato. La próxima vez que abras la app, tu
gente sigue ahí.

---

## Cómo reparte

Cada nivel vale puntos: Principiante 1, Intermedio 2, Avanzado 3.

El reparto busca equipos del mismo tamaño con **sumas de nivel lo más
parecidas posible**. No busca el mismo número de avanzados por equipo, y eso
es deliberado: con 3 avanzados y 2 equipos no se pueden repartir en partes
iguales, y forzarlo arruinaría el equilibrio real. Lo que manda es la suma,
así que el algoritmo compensa con intermedios y principiantes.

Las prioridades, en orden:

| Qué | Cuánto pesa |
|---|---|
| Un punto de diferencia de nivel | 600 |
| Un equipo sin nadie que pueda tapar | 1200 |
| Arqueros apilados en un solo equipo | 60 |
| Desequilibrio de defensa / ataque | 30 |
| Desequilibrio de armadores | 20 |
| Desequilibrio de avanzados | 25 |

Que el arquero pese el doble que un punto de nivel significa esto: el reparto
prefiere quedar un poco más desigual antes que dejar a un equipo sin nadie en
el arco. Si no hay arqueros para todos, lo dice en pantalla en vez de
disimularlo.

El método es una búsqueda con reinicios: 140 repartos de arranque en serpiente
(1-2-3-3-2-1), y sobre cada uno un afinado que prueba intercambios de a dos
—incluidos los de la banca— y se queda con los que mejoran. De ahí salen las
dos propuestas distintas.

---

## Privacidad de las calificaciones

El mensaje que se comparte lleva **los nombres y la rotación, nunca los
niveles**. Las notas son del organizador.

En pantalla hay además un botón **🙈 Ocultar** para esconder los niveles si
vas a enseñarle el teléfono al grupo.

---

## Pruebas

```bash
node test/probar_reparto.js
```

301 comprobaciones sobre planteles de 10, 12, 15, 17 y 18 jugadores, con
cantidades impares de avanzados y con casos de pocos arqueros (incluido uno
donde nadie puede tapar). Verifica tamaños de equipo, que nadie se repita ni
se pierda, la cuenta de rotación, que la diferencia de nivel no pase de 2,
que haya arquero por equipo cuando los hay, que las dos propuestas sean
distintas y que el mensaje no filtre las calificaciones.

Resultados medidos:

| Plantel | Formato | Rotan | Arqueros | Totales | Diferencia |
|---|---|---|---|---|---|
| 12 | 2 de 6 | 0 | 2 | 11 / 11 | 0 |
| 15 | 3 de 5 | 0 | 1 | 10 / 10 / 10 | 0 |
| 17 | 3 de 5 | 2 | 3 | 11 / 11 / 11 | 0 |
| 18 | 3 de 6 | 0 | 0 | 12 / 11 / 11 | 1 |

El único caso con diferencia 1 es el de 18 jugadores en 3 equipos de 6: el
total del grupo es 34 puntos, y 34 no se divide en tres partes iguales. Es el
mejor reparto que existe, no una falla.

Cada reparto tarda entre 7 y 34 ms.

---

## Funciona sin internet

Después de la primera carga, un service worker guarda la app entera en el
teléfono: la página, los estilos, el reparto y los íconos. En una losa de
barrio no siempre hay señal, y el organizador no puede quedarse mirando una
pantalla en blanco con doce personas esperando.

El reparto nunca necesitó red: todo el cálculo pasa dentro del teléfono. La
lista de jugadores se guarda en el aparato, no en ningún servidor.

Para publicar una versión nueva hay que subir `VERSION` en `sw.js`. Si no, los
teléfonos que ya la tienen seguirán sirviendo la copia vieja.

---

## Archivos

```
index.html              la página, con la ilustración de la losa en SVG
css/estilos.css         estilos, primero para celular
js/reparto.js           el reparto equilibrado (sin nada del navegador dentro)
js/app.js               la interfaz, la instalación y el registro del servicio
sw.js                   el service worker: la app sin conexión
manifest.webmanifest    nombre, íconos y modo de apertura
icons/                  el ícono en SVG y sus versiones en PNG
qr/                     el QR y el afiche para imprimir
tools/                  genera y verifica los assets de arriba
test/probar_reparto.js  las pruebas
```

`reparto.js` no toca el DOM a propósito: así se puede probar con node y se
podría reutilizar en otra cosa sin arrastrar la interfaz.

---

## Accesibilidad y uso al aire libre

- Botones de 48 px como mínimo, que es lo que pide un pulgar.
- Contraste alto y texto grande, pensando en pantalla al sol.
- Cada equipo se distingue por **color y además por trama** (liso, rayas,
  banda), para quien no diferencia bien los colores.
- Se respeta `prefers-reduced-motion`.
- Funciona de 320 px para arriba.
