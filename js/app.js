'use strict';
/*
 * app.js — la interfaz de Pichanga.
 *
 * Todo el calculo de equipos vive en reparto.js. Aqui solo se dibuja,
 * se escucha al dedo del organizador y se guarda la lista en el aparato.
 */
(function () {

  var LLAVE = 'pichanga.v1';

  /* ---------------- Estado ---------------- */

  var estado = {
    jugadores: [],
    formatoId: null,
    resultado: null,
    propuesta: 0,
    paso: 'jugadores',
    editando: null,
    seleccion: null,      /* { equipo: n | 'rotan', pos: n }  para intercambiar */
    modoPublico: false
  };

  /* ---------------- Atajos ---------------- */

  function $(sel) { return document.querySelector(sel); }
  function crear(tag, clase, texto) {
    var el = document.createElement(tag);
    if (clase) el.className = clase;
    if (texto != null) el.textContent = texto;
    return el;
  }
  function vaciar(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  /* ---------------- Guardado en el aparato ---------------- */

  function guardar() {
    try {
      localStorage.setItem(LLAVE, JSON.stringify({
        jugadores: estado.jugadores,
        formatoId: estado.formatoId
      }));
    } catch (e) {
      /* Modo incognito o almacenamiento lleno: la app sigue funcionando,
         solo que no recordara la lista la proxima vez. */
    }
  }

  function cargar() {
    try {
      var crudo = localStorage.getItem(LLAVE);
      if (!crudo) return;
      var datos = JSON.parse(crudo);
      if (datos && Array.isArray(datos.jugadores)) {
        estado.jugadores = datos.jugadores.filter(function (j) {
          return j && typeof j.nombre === 'string' && j.nombre.length;
        }).map(function (j) {
          return {
            id: j.id || nuevoId(),
            nombre: String(j.nombre).slice(0, 24),
            nivel: ['principiante', 'intermedio', 'avanzado'].indexOf(j.nivel) !== -1
              ? j.nivel : 'intermedio',
            puedeTapar: j.puedeTapar === true,
            posicion: typeof j.posicion === 'string' ? j.posicion : '',
            fortalezas: Array.isArray(j.fortalezas) ? j.fortalezas.slice(0, 2) : []
          };
        });
        estado.formatoId = datos.formatoId || null;
      }
    } catch (e) { /* dato corrupto: se empieza de cero */ }
  }

  var contadorId = 0;
  function nuevoId() {
    contadorId++;
    return 'j' + Date.now().toString(36) + '-' + contadorId;
  }

  /* ---------------- Aviso flotante ---------------- */

  var temporizadorAviso = null;
  function avisar(texto) {
    var el = $('#avisoFlotante');
    el.textContent = texto;
    el.classList.add('aviso-flotante--visible');
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(function () {
      el.classList.remove('aviso-flotante--visible');
    }, 2200);
  }

  /* ---------------- Alta y baja de jugadores ---------------- */

  function agregar(nivel) {
    var campo = $('#nombre');
    var nombre = campo.value.trim().replace(/\s+/g, ' ');
    if (!nombre) {
      campo.focus();
      avisar('Escribe un nombre primero');
      return;
    }
    var repetido = estado.jugadores.some(function (j) {
      return j.nombre.toLowerCase() === nombre.toLowerCase();
    });
    if (repetido) nombre = nombre + ' (2)';

    estado.jugadores.push({
      id: nuevoId(),
      nombre: nombre,
      nivel: nivel,
      puedeTapar: false,
      posicion: '',
      fortalezas: []
    });

    campo.value = '';
    campo.focus();
    invalidarReparto();
    guardar();
    dibujar();
  }

  function eliminar(id) {
    estado.jugadores = estado.jugadores.filter(function (j) { return j.id !== id; });
    if (estado.editando === id) estado.editando = null;
    invalidarReparto();
    guardar();
    dibujar();
  }

  function buscar(id) {
    for (var i = 0; i < estado.jugadores.length; i++) {
      if (estado.jugadores[i].id === id) return estado.jugadores[i];
    }
    return null;
  }

  /* Cualquier cambio en la gente invalida los equipos ya armados. */
  function invalidarReparto() {
    estado.resultado = null;
    estado.seleccion = null;
    var disponibles = Reparto.formatosPara(estado.jugadores.length);
    var sigueValiendo = disponibles.some(function (f) {
      return f.id === estado.formatoId && f.alcanza;
    });
    if (!sigueValiendo) estado.formatoId = null;
  }

  /* ---------------- Navegacion ---------------- */

  function irA(paso) {
    estado.paso = paso;
    estado.editando = null;
    dibujar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- Dibujo: jugadores ---------------- */

  function dibujarJugadores() {
    var lista = $('#listaJugadores');
    var vacio = $('#vacioJugadores');
    vaciar(lista);

    var n = estado.jugadores.length;
    vacio.hidden = n > 0;
    $('#zonaBorrar').hidden = n === 0;

    $('#contadorN').textContent = n + (n === 1 ? ' jugador' : ' jugadores');

    var tapan = estado.jugadores.filter(Reparto.esArquero).length;
    var avanzados = estado.jugadores.filter(function (j) { return j.nivel === 'avanzado'; }).length;
    var partes = [];
    if (tapan) partes.push(tapan + (tapan === 1 ? ' puede tapar' : ' pueden tapar'));
    if (avanzados) partes.push(avanzados + (avanzados === 1 ? ' avanzado' : ' avanzados'));
    $('#contadorDetalle').textContent = partes.join(' · ');

    estado.jugadores.forEach(function (j) {
      lista.appendChild(filaJugador(j));
    });
  }

  function filaJugador(j) {
    var li = crear('li', 'jugador');
    var fila = crear('div', 'jugador__fila');

    var puntos = Reparto.puntos(j);

    var ini = crear('span', 'inicial inicial--' + puntos, j.nombre.charAt(0).toUpperCase());
    ini.setAttribute('aria-hidden', 'true');
    fila.appendChild(ini);

    var centro = crear('div');
    centro.style.flex = '1 1 auto';
    centro.style.minWidth = '0';
    centro.appendChild(crear('div', 'jugador__nombre', j.nombre));

    var marcas = [];
    if (Reparto.esArquero(j)) marcas.push({ texto: '🧤 Tapa', clase: ' marcaje--arquero' });
    if (j.posicion && j.posicion !== 'arquero') {
      var pos = Reparto.POSICIONES.filter(function (p) { return p.id === j.posicion; })[0];
      if (pos) marcas.push({ texto: pos.etiqueta, clase: '' });
    }
    j.fortalezas.forEach(function (f) {
      var fo = Reparto.FORTALEZAS.filter(function (x) { return x.id === f; })[0];
      if (fo) marcas.push({ texto: fo.etiqueta, clase: '' });
    });
    if (marcas.length) {
      var cont = crear('div', 'jugador__marcas');
      marcas.forEach(function (m) { cont.appendChild(crear('span', 'marcaje' + m.clase, m.texto)); });
      centro.appendChild(cont);
    }
    fila.appendChild(centro);

    var nivel = Reparto.NIVELES.filter(function (nv) { return nv.id === j.nivel; })[0];
    fila.appendChild(crear('span', 'chip-nivel chip-nivel--' + puntos, nivel.corto));

    var btnEditar = crear('button', 'icono-btn', estado.editando === j.id ? '▲' : '⚙');
    btnEditar.title = 'Detalles de ' + j.nombre;
    btnEditar.setAttribute('aria-label', 'Detalles de ' + j.nombre);
    btnEditar.onclick = function () {
      estado.editando = estado.editando === j.id ? null : j.id;
      dibujar();
    };
    fila.appendChild(btnEditar);

    li.appendChild(fila);

    if (estado.editando === j.id) li.appendChild(editorJugador(j));
    return li;
  }

  function editorJugador(j) {
    var ed = crear('div', 'editor');

    /* Nombre */
    var b0 = crear('div', 'editor__bloque');
    b0.appendChild(crear('label', 'rotulo', 'Nombre'));
    var campo = crear('input', 'campo-nombre');
    campo.type = 'text';
    campo.value = j.nombre;
    campo.maxLength = 24;
    campo.oninput = function () {
      j.nombre = campo.value.slice(0, 24);
      guardar();
    };
    campo.onblur = function () {
      j.nombre = (campo.value.trim() || 'Sin nombre').replace(/\s+/g, ' ');
      invalidarReparto();
      guardar();
      dibujar();
    };
    b0.appendChild(campo);
    ed.appendChild(b0);

    /* Nivel */
    var b1 = crear('div', 'editor__bloque');
    b1.appendChild(crear('label', 'rotulo', 'Nivel'));
    var ops1 = crear('div', 'opciones');
    Reparto.NIVELES.forEach(function (nv) {
      var b = crear('button', 'opcion', nv.etiqueta);
      b.setAttribute('aria-pressed', String(j.nivel === nv.id));
      b.onclick = function () {
        j.nivel = nv.id;
        invalidarReparto(); guardar(); dibujar();
      };
      ops1.appendChild(b);
    });
    b1.appendChild(ops1);
    ed.appendChild(b1);

    /* Puede tapar */
    var b2 = crear('div', 'editor__bloque');
    b2.appendChild(crear('label', 'rotulo', 'Arco'));
    var ops2 = crear('div', 'opciones');
    var bt = crear('button', 'opcion', '🧤 Puede tapar');
    bt.setAttribute('aria-pressed', String(j.puedeTapar === true));
    bt.onclick = function () {
      j.puedeTapar = !j.puedeTapar;
      invalidarReparto(); guardar(); dibujar();
    };
    ops2.appendChild(bt);
    b2.appendChild(ops2);
    ed.appendChild(b2);

    /* Posicion */
    var b3 = crear('div', 'editor__bloque');
    b3.appendChild(crear('label', 'rotulo', 'Posición habitual'));
    var ops3 = crear('div', 'opciones');
    Reparto.POSICIONES.forEach(function (p) {
      var b = crear('button', 'opcion', p.etiqueta);
      b.setAttribute('aria-pressed', String((j.posicion || '') === p.id));
      b.onclick = function () {
        j.posicion = p.id;
        invalidarReparto(); guardar(); dibujar();
      };
      ops3.appendChild(b);
    });
    b3.appendChild(ops3);
    ed.appendChild(b3);

    /* Fortalezas, hasta dos */
    var b4 = crear('div', 'editor__bloque');
    b4.appendChild(crear('label', 'rotulo', 'Fortalezas (hasta 2)'));
    var ops4 = crear('div', 'opciones');
    Reparto.FORTALEZAS.forEach(function (f) {
      var activa = j.fortalezas.indexOf(f.id) !== -1;
      var b = crear('button', 'opcion', f.etiqueta);
      b.setAttribute('aria-pressed', String(activa));
      b.disabled = !activa && j.fortalezas.length >= 2;
      b.onclick = function () {
        if (activa) {
          j.fortalezas = j.fortalezas.filter(function (x) { return x !== f.id; });
        } else if (j.fortalezas.length < 2) {
          j.fortalezas = j.fortalezas.concat([f.id]);
        }
        invalidarReparto(); guardar(); dibujar();
      };
      ops4.appendChild(b);
    });
    b4.appendChild(ops4);
    ed.appendChild(b4);

    /* Acciones */
    var acc = crear('div', 'acciones-editor');
    var listo = crear('button', 'boton boton--borde boton--chico', 'Listo');
    listo.style.flex = '1';
    listo.onclick = function () { estado.editando = null; dibujar(); };
    var borrar = crear('button', 'boton boton--peligro boton--chico', '🗑 Quitar');
    borrar.onclick = function () { eliminar(j.id); };
    acc.appendChild(listo);
    acc.appendChild(borrar);
    ed.appendChild(acc);

    return ed;
  }

  /* ---------------- Dibujo: formatos ---------------- */

  function dibujarFormatos() {
    var cont = $('#formatos');
    vaciar(cont);
    var n = estado.jugadores.length;
    var formatos = Reparto.formatosPara(n);

    $('#ayudaFormato').textContent = n + (n === 1 ? ' jugador anotado.' : ' jugadores anotados.') +
      ' Elige el formato y te digo quiénes rotan.';

    formatos.forEach(function (f) {
      var b = crear('button', 'formato');
      b.disabled = !f.alcanza;
      b.setAttribute('aria-pressed', String(estado.formatoId === f.id));

      var ico = crear('div', 'formato__icono');
      for (var i = 0; i < f.equipos; i++) ico.appendChild(crear('span', 'formato__eq'));
      b.appendChild(ico);

      var txt = crear('div', 'formato__texto');
      txt.appendChild(crear('div', 'formato__nombre', f.etiqueta));
      var nota;
      if (!f.alcanza) {
        nota = 'Faltan ' + f.faltan + (f.faltan === 1 ? ' jugador' : ' jugadores');
      } else if (f.rotan === 0) {
        nota = 'Entran todos, nadie rota';
      } else {
        nota = f.enCancha + ' en cancha · ' + f.rotan + (f.rotan === 1 ? ' rota' : ' rotan');
      }
      txt.appendChild(crear('div', 'formato__nota', nota));
      b.appendChild(txt);

      b.onclick = function () {
        estado.formatoId = f.id;
        estado.resultado = null;
        guardar();
        dibujar();
      };
      cont.appendChild(b);
    });

    var aviso = $('#avisoFormato');
    vaciar(aviso);
    if (n < 10) {
      aviso.appendChild(crear('div', 'aviso',
        'Con ' + n + ' no alcanza para ningún formato. El mínimo es 10, para 2 equipos de 5.'));
    }
  }

  /* ---------------- Dibujo: reparto ---------------- */

  function armarEquipos(semilla) {
    if (!estado.formatoId) return;
    var res = Reparto.armar(estado.jugadores, estado.formatoId, { semilla: semilla });
    if (!res.ok) { avisar(res.motivo); return; }
    estado.resultado = res;
    estado.propuesta = 0;
    estado.seleccion = null;
  }

  function escudoSVG(color, patron, idUnico) {
    var recorte = 'rec' + idUnico;
    var interior = '';
    if (patron === 'rayas') {
      interior = '<g clip-path="url(#' + recorte + ')" fill="rgba(0,0,0,.26)">' +
        '<rect x="4" y="0" width="4" height="36"/>' +
        '<rect x="13" y="0" width="4" height="36"/>' +
        '<rect x="22" y="0" width="4" height="36"/></g>';
    } else if (patron === 'banda') {
      interior = '<g clip-path="url(#' + recorte + ')" fill="rgba(0,0,0,.26)">' +
        '<polygon points="0,26 24,0 32,0 0,34"/></g>';
    }
    var d = 'M16,1.5 L30.5,6.4 V19.5 C30.5,28 16,34.5 16,34.5 C16,34.5 1.5,28 1.5,19.5 V6.4 Z';
    return '<svg viewBox="0 0 32 36" width="32" height="36" aria-hidden="true">' +
      '<defs><clipPath id="' + recorte + '"><path d="' + d + '"/></clipPath></defs>' +
      '<path d="' + d + '" fill="' + color + '"/>' + interior +
      '<path d="' + d + '" fill="none" stroke="#FFFFFF" stroke-width="2" opacity=".92"/>' +
      '</svg>';
  }

  var contadorEscudo = 0;

  function dibujarReparto() {
    var cont = $('#equipos');
    var contRot = $('#rotacion');
    vaciar(cont); vaciar(contRot);
    vaciar($('#avisoEquilibrio'));

    if (!estado.resultado) {
      $('#ayudaReparto').textContent = 'Todavía no hay equipos armados.';
      $('#alternador').hidden = true;
      $('#pistaIntercambio').hidden = true;
      return;
    }

    var res = estado.resultado;
    var prop = res.propuestas[estado.propuesta] || res.propuestas[0];

    $('#ayudaReparto').textContent = res.formato.etiqueta + ' · ' +
      res.formato.enCancha + ' en cancha' +
      (prop.rotan.length ? ' · ' + prop.rotan.length + ' rotando' : '');

    /* Alternador solo si de verdad hay dos propuestas */
    var hayDos = res.propuestas.length > 1;
    $('#alternador').hidden = !hayDos;
    $('#pistaIntercambio').hidden = false;
    if (hayDos) {
      Array.prototype.forEach.call(document.querySelectorAll('.alternador__btn'), function (b) {
        b.setAttribute('aria-pressed', String(Number(b.dataset.propuesta) === estado.propuesta));
      });
    }

    /* Aviso de equilibrio */
    var an = Reparto.analizar(prop);
    var aviso = crear('div', 'aviso-equilibrio ' +
      (an.diferencia === 0 ? 'aviso-equilibrio--ok' : 'aviso-equilibrio--roce'));
    var txt;
    if (an.diferencia === 0) txt = '⚖️ Equipos parejos: mismo nivel total.';
    else txt = '⚖️ Diferencia de ' + an.diferencia +
      (an.diferencia === 1 ? ' punto' : ' puntos') + ', lo más parejo posible con este grupo.';
    if (an.equiposSinArquero.length) {
      txt += ' Sin arquero: ' + an.equiposSinArquero.join(', ') + '.';
    }
    aviso.textContent = txt;
    $('#avisoEquilibrio').appendChild(aviso);

    /* Tarjetas de equipo */
    prop.equipos.forEach(function (eq, iEq) {
      var art = crear('article', 'equipo equipo--' + eq.patron);

      var cab = crear('div', 'equipo__cabecera');
      cab.style.background = eq.color;

      var esc = crear('span', 'equipo__escudo');
      contadorEscudo++;
      esc.innerHTML = escudoSVG(eq.color, eq.patron, contadorEscudo);
      cab.appendChild(esc);

      cab.appendChild(crear('span', 'equipo__nombre', 'Equipo ' + eq.nombre));

      var dato = crear('span', 'equipo__dato equipo__dato--nivel', 'nivel ' + eq.total);
      cab.appendChild(dato);
      art.appendChild(cab);

      var ul = crear('ul', 'equipo__lista');
      eq.jugadores.forEach(function (j, iPos) {
        ul.appendChild(fichaJugador(j, iPos, iEq, iPos));
      });
      art.appendChild(ul);
      cont.appendChild(art);
    });

    /* Rotacion */
    if (prop.rotan.length) {
      var caja = crear('div', 'rotacion');
      caja.appendChild(crear('div', 'rotacion__titulo',
        '🔁 Rotan (' + prop.rotan.length + ')'));
      var ul2 = crear('ul', 'rotacion__lista');
      prop.rotan.forEach(function (j, i) {
        var li = crear('li');
        li.style.flex = '1 1 46%';
        li.appendChild(fichaJugador(j, i, 'rotan', i, true));
        ul2.appendChild(li);
      });
      caja.appendChild(ul2);
      contRot.appendChild(caja);
    }
  }

  function fichaJugador(j, dorsal, equipo, pos, suelta) {
    var elemento = suelta ? crear('button', 'ficha') : crear('li');
    var b = suelta ? elemento : crear('button', 'ficha');

    b.type = 'button';
    var seleccionada = estado.seleccion &&
      estado.seleccion.equipo === equipo && estado.seleccion.pos === pos;
    b.setAttribute('aria-pressed', String(!!seleccionada));

    b.appendChild(crear('span', 'ficha__dorsal', String(dorsal + 1)));
    b.appendChild(crear('span', 'ficha__nombre', j.nombre));

    var iconos = crear('span', 'ficha__iconos');
    if (Reparto.esArquero(j)) iconos.appendChild(crear('span', null, '🧤'));
    if (Reparto.ataca(j)) iconos.appendChild(crear('span', null, '⚽'));
    if (Reparto.defiende(j)) iconos.appendChild(crear('span', null, '🛡️'));
    b.appendChild(iconos);

    b.onclick = function () { tocarFicha(equipo, pos); };

    if (suelta) return b;
    elemento.appendChild(b);
    return elemento;
  }

  /* Dos toques = intercambio. Funciona tambien con la rotacion. */
  function tocarFicha(equipo, pos) {
    var sel = estado.seleccion;
    if (!sel) {
      estado.seleccion = { equipo: equipo, pos: pos };
      dibujar();
      return;
    }
    if (sel.equipo === equipo && sel.pos === pos) {
      estado.seleccion = null;
      dibujar();
      return;
    }
    intercambiar(sel, { equipo: equipo, pos: pos });
    estado.seleccion = null;
    dibujar();
  }

  function bolsa(prop, equipo) {
    return equipo === 'rotan' ? prop.rotan : prop.equipos[equipo].jugadores;
  }

  function intercambiar(a, b) {
    var prop = estado.resultado.propuestas[estado.propuesta];
    var listaA = bolsa(prop, a.equipo);
    var listaB = bolsa(prop, b.equipo);
    var tmp = listaA[a.pos];
    listaA[a.pos] = listaB[b.pos];
    listaB[b.pos] = tmp;
    Reparto.recalcular(prop);
    avisar('Cambiados de sitio');
  }

  /* ---------------- Compartir ---------------- */

  function textoActual() {
    if (!estado.resultado) return '';
    var prop = estado.resultado.propuestas[estado.propuesta];
    return Reparto.textoParaCompartir(estado.resultado, prop);
  }

  function compartirWhatsApp() {
    var texto = textoActual();
    if (!texto) return;
    window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
  }

  function copiar() {
    var texto = textoActual();
    if (!texto) return;
    function alViejoEstilo() {
      var ta = document.createElement('textarea');
      ta.value = texto;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); avisar('Reparto copiado'); }
      catch (e) { avisar('No se pudo copiar en este navegador'); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(texto)
        .then(function () { avisar('Reparto copiado'); })
        .catch(alViejoEstilo);
    } else {
      alViejoEstilo();
    }
  }

  /* ---------------- Barra de accion ---------------- */

  function dibujarBarra() {
    var barra = $('#barraAccion');
    vaciar(barra);
    var n = estado.jugadores.length;

    if (estado.paso === 'jugadores') {
      var b = crear('button', 'boton boton--principal boton--ancho');
      if (n < 10) {
        b.textContent = 'Faltan ' + (10 - n) + ' para armar equipos';
        b.disabled = true;
      } else {
        b.textContent = 'Elegir formato →';
        b.onclick = function () { irA('formato'); };
      }
      barra.appendChild(b);

    } else if (estado.paso === 'formato') {
      var atras = crear('button', 'boton boton--borde', '←');
      atras.style.flex = '0 0 auto';
      atras.setAttribute('aria-label', 'Volver a jugadores');
      atras.onclick = function () { irA('jugadores'); };
      barra.appendChild(atras);

      var armar = crear('button', 'boton boton--principal');
      armar.textContent = '⚽ Armar equipos';
      armar.disabled = !estado.formatoId;
      armar.onclick = function () {
        armarEquipos(Math.floor(Math.random() * 2147483647));
        irA('reparto');
      };
      barra.appendChild(armar);

    } else {
      var atras2 = crear('button', 'boton boton--borde', '←');
      atras2.style.flex = '0 0 auto';
      atras2.setAttribute('aria-label', 'Volver al formato');
      atras2.onclick = function () { irA('formato'); };
      barra.appendChild(atras2);

      var wa = crear('button', 'boton boton--verde');
      wa.textContent = 'Compartir';
      wa.disabled = !estado.resultado;
      wa.onclick = compartirWhatsApp;
      barra.appendChild(wa);

      var cp = crear('button', 'boton boton--borde');
      cp.textContent = '📋';
      cp.style.flex = '0 0 auto';
      cp.setAttribute('aria-label', 'Copiar el reparto');
      cp.disabled = !estado.resultado;
      cp.onclick = copiar;
      barra.appendChild(cp);
    }
  }

  /* ---------------- Dibujo general ---------------- */

  function dibujar() {
    /* Pasos */
    Array.prototype.forEach.call(document.querySelectorAll('.paso'), function (p) {
      var activo = p.dataset.paso === estado.paso;
      p.setAttribute('aria-selected', String(activo));
      if (p.dataset.paso === 'formato') p.disabled = estado.jugadores.length < 10;
      if (p.dataset.paso === 'reparto') p.disabled = !estado.resultado;
    });

    $('#seccion-jugadores').hidden = estado.paso !== 'jugadores';
    $('#seccion-formato').hidden = estado.paso !== 'formato';
    $('#seccion-reparto').hidden = estado.paso !== 'reparto';

    document.body.classList.toggle('publico', estado.modoPublico);

    if (estado.paso === 'jugadores') dibujarJugadores();
    if (estado.paso === 'formato') dibujarFormatos();
    if (estado.paso === 'reparto') dibujarReparto();
    dibujarBarra();
  }

  /* ---------------- Enlaces de eventos ---------------- */

  function enlazar() {
    Array.prototype.forEach.call(document.querySelectorAll('.nivel'), function (b) {
      b.onclick = function () { agregar(b.dataset.nivel); };
    });

    $('#nombre').addEventListener('keydown', function (e) {
      /* Enter agrega como intermedio: es el caso mas comun y ahorra un toque. */
      if (e.key === 'Enter') { e.preventDefault(); agregar('intermedio'); }
    });

    Array.prototype.forEach.call(document.querySelectorAll('.paso'), function (p) {
      p.onclick = function () { if (!p.disabled) irA(p.dataset.paso); };
    });

    Array.prototype.forEach.call(document.querySelectorAll('.alternador__btn'), function (b) {
      b.onclick = function () {
        estado.propuesta = Number(b.dataset.propuesta);
        estado.seleccion = null;
        dibujar();
      };
    });

    $('#btnMezclar').onclick = function () {
      armarEquipos(Math.floor(Math.random() * 2147483647));
      avisar('Mezclado de nuevo');
      dibujar();
    };

    $('#btnModoPublico').onclick = function () {
      estado.modoPublico = !estado.modoPublico;
      $('#btnModoPublico').textContent = estado.modoPublico ? '👁 Mostrar' : '🙈 Ocultar';
      dibujar();
    };

    $('#btnBorrarTodo').onclick = function () {
      if (!window.confirm('¿Vaciar la lista completa de jugadores?')) return;
      estado.jugadores = [];
      estado.formatoId = null;
      invalidarReparto();
      guardar();
      dibujar();
      avisar('Lista vaciada');
    };
  }

  /* ================================================================
     INSTALACIÓN EN LA PANTALLA DE INICIO
     ================================================================ */

  var promesaInstalar = null;   /* el evento que guarda Chrome en Android */

  function esIOS() {
    var ua = navigator.userAgent;
    /* El iPad moderno se hace pasar por Mac: se delata por el táctil. */
    return /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function yaInstalada() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      navigator.standalone === true;
  }

  function abrirHoja(seccion) {
    var d = $('#hojaInstalar');
    /* Se destaca la guía que le toca a este teléfono, pero se muestran
       las dos: la gente presta el celular y pregunta por el del otro. */
    $('#guiaAndroid').style.order = seccion === 'ios' ? '2' : '1';
    $('#guiaIphone').style.order = seccion === 'ios' ? '1' : '2';
    if (typeof d.showModal === 'function') {
      d.showModal();
    } else {
      d.classList.add('hoja--simple');
      d.setAttribute('open', '');
    }
  }

  function cerrarHoja() {
    var d = $('#hojaInstalar');
    if (typeof d.close === 'function' && d.open) d.close();
    else d.removeAttribute('open');
  }

  function mostrarFranja() {
    if (yaInstalada()) return;
    if (sessionStorage.getItem('pichanga.franja.oculta') === '1') return;
    $('#franjaInstalar').hidden = false;
  }

  function prepararInstalacion() {
    /* Android / Chrome de escritorio: el navegador avisa cuando la app
       cumple los requisitos y deja pedir la instalación de verdad. */
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      promesaInstalar = e;
      mostrarFranja();
    });

    /* iPhone nunca lanza ese evento: Safari solo permite el camino
       manual por Compartir. Así que ahí la franja se muestra sola. */
    if (esIOS() && !yaInstalada()) mostrarFranja();

    window.addEventListener('appinstalled', function () {
      promesaInstalar = null;
      $('#franjaInstalar').hidden = true;
      avisar('Pichanga quedó instalada');
    });

    $('#btnInstalar').onclick = function () {
      if (promesaInstalar) {
        promesaInstalar.prompt();
        promesaInstalar.userChoice.then(function (r) {
          if (r && r.outcome === 'accepted') {
            $('#franjaInstalar').hidden = true;
          }
          promesaInstalar = null;
        });
      } else {
        /* Sin evento nativo: iPhone, o un navegador que no lo trae.
           Se explica el camino a mano. */
        abrirHoja(esIOS() ? 'ios' : 'android');
      }
    };

    $('#cerrarFranja').onclick = function () {
      $('#franjaInstalar').hidden = true;
      try { sessionStorage.setItem('pichanga.franja.oculta', '1'); } catch (e) {}
    };

    $('#abrirComoInstalar').onclick = function () {
      abrirHoja(esIOS() ? 'ios' : 'android');
    };
    $('#cerrarHoja').onclick = cerrarHoja;
    $('#entendidoHoja').onclick = cerrarHoja;

    /* Tocar fuera de la caja cierra la hoja. */
    $('#hojaInstalar').addEventListener('click', function (e) {
      if (e.target === $('#hojaInstalar')) cerrarHoja();
    });
  }

  /* ---------------- Sin conexión ---------------- */

  function estadoConexion() {
    var el = $('#estadoConexion');
    if (!navigator.onLine) el.textContent = '📴 Sin internet, y funcionando igual';
    else if ('serviceWorker' in navigator) el.textContent = 'Funciona sin internet';
    else el.textContent = '';
  }

  function registrarServicio() {
    if (!('serviceWorker' in navigator)) return;
    /* El service worker exige HTTPS. En localhost el navegador hace una
       excepción, por eso también funciona al probar en casa. */
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (e) {
        console.warn('No se pudo registrar el service worker:', e);
      });
    });
  }

  /* ---------------- Arranque ---------------- */

  cargar();
  enlazar();
  dibujar();
  prepararInstalacion();
  registrarServicio();
  estadoConexion();
  window.addEventListener('online', estadoConexion);
  window.addEventListener('offline', estadoConexion);

  /* Para poder probar desde la consola del navegador. */
  window.Pichanga = { estado: estado, dibujar: dibujar };

})();
