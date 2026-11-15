'use strict';
/*
 * reparto.js — el cerebro de Pichanga.
 *
 * Vive aparte de la interfaz a proposito: asi se puede probar con node
 * sin abrir un navegador (ver test/probar_reparto.js).
 *
 * Funciona en el navegador (deja window.Reparto) y en node (module.exports).
 */
(function (raiz, fabrica) {
  var api = fabrica();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  else { raiz.Reparto = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  /* ---------- Vocabulario ---------- */

  var PUNTOS = { principiante: 1, intermedio: 2, avanzado: 3 };

  var NIVELES = [
    { id: 'principiante', etiqueta: 'Principiante', corto: 'Prin',  puntos: 1 },
    { id: 'intermedio',   etiqueta: 'Intermedio',   corto: 'Inter', puntos: 2 },
    { id: 'avanzado',     etiqueta: 'Avanzado',     corto: 'Avan',  puntos: 3 }
  ];

  var POSICIONES = [
    { id: '',          etiqueta: 'Sin preferencia' },
    { id: 'arquero',   etiqueta: 'Arquero' },
    { id: 'defensa',   etiqueta: 'Defensa' },
    { id: 'medio',     etiqueta: 'Medio' },
    { id: 'delantero', etiqueta: 'Delantero' }
  ];

  var FORTALEZAS = [
    { id: 'marca', etiqueta: 'Marca bien' },
    { id: 'juego', etiqueta: 'Arma juego' },
    { id: 'goles', etiqueta: 'Mete goles' }
  ];

  var FORMATOS = [
    { id: '2x5', equipos: 2, porEquipo: 5 },
    { id: '2x6', equipos: 2, porEquipo: 6 },
    { id: '3x5', equipos: 3, porEquipo: 5 },
    { id: '3x6', equipos: 3, porEquipo: 6 }
  ];

  var EQUIPOS = [
    { nombre: 'Rojo',    color: '#D7263D', emoji: '🔴', patron: 'solido' },
    { nombre: 'Crema',   color: '#E8B33C', emoji: '🟡', patron: 'rayas'  },
    { nombre: 'Celeste', color: '#2E86C1', emoji: '🔵', patron: 'banda'  }
  ];

  /* ---------- Lectura de un jugador ---------- */

  function puntos(j) { return PUNTOS[j.nivel] || 1; }
  function tiene(j, f) { return Array.isArray(j.fortalezas) && j.fortalezas.indexOf(f) !== -1; }
  function esArquero(j) { return j.puedeTapar === true || j.posicion === 'arquero'; }
  function defiende(j) { return j.posicion === 'defensa' || tiene(j, 'marca'); }
  function ataca(j)    { return j.posicion === 'delantero' || tiene(j, 'goles'); }
  function arma(j)     { return j.posicion === 'medio' || tiene(j, 'juego'); }

  function etiquetaFormato(f) { return f.equipos + ' equipos de ' + f.porEquipo; }

  /* Que formatos entran con N jugadores, y cuantos quedan rotando. */
  function formatosPara(n) {
    return FORMATOS.map(function (f) {
      var enCancha = f.equipos * f.porEquipo;
      return {
        id: f.id,
        equipos: f.equipos,
        porEquipo: f.porEquipo,
        etiqueta: etiquetaFormato(f),
        enCancha: enCancha,
        rotan: Math.max(0, n - enCancha),
        faltan: Math.max(0, enCancha - n),
        alcanza: n >= enCancha
      };
    });
  }

  /* ---------- Azar con semilla ---------- */
  /* Con semilla fija el reparto es reproducible: las pruebas pueden
     comprobar siempre el mismo caso. "Mezclar de nuevo" pasa otra. */

  function azar(semilla) {
    var a = semilla >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function barajar(lista, rnd) {
    var a = lista.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- Medir lo bueno que es un reparto ---------- */

  function rango(nums) {
    if (!nums.length) return 0;
    var mx = nums[0], mn = nums[0];
    for (var i = 1; i < nums.length; i++) {
      if (nums[i] > mx) mx = nums[i];
      if (nums[i] < mn) mn = nums[i];
    }
    return mx - mn;
  }

  function contar(equipo, prueba) {
    var c = 0;
    for (var i = 0; i < equipo.length; i++) if (prueba(equipo[i])) c++;
    return c;
  }

  function sumaNivel(equipo) {
    var s = 0;
    for (var i = 0; i < equipo.length; i++) s += puntos(equipo[i]);
    return s;
  }

  function esAvanzado(j) { return j.nivel === 'avanzado'; }

  /*
   * Los pesos ordenan las prioridades:
   *
   *  - Un punto de diferencia de nivel cuesta 600.
   *  - Un equipo sin nadie que pueda tapar cuesta 1200, o sea DOS puntos
   *    de desequilibrio. Es decir: preferimos un reparto algo mas desigual
   *    antes que dejar a un equipo sin arquero.
   *  - El reparto de avanzados pesa poco (25) a proposito. Si pesara mucho,
   *    el algoritmo forzaria el mismo numero de avanzados por equipo y
   *    estropearia el equilibrio real. Con 3 avanzados y 2 equipos NO se
   *    pueden repartir en partes iguales, y la unica salida buena es
   *    compensar con intermedios. Por eso manda la suma, no el conteo.
   */
  var PESOS = {
    nivel: 600,
    sinArquero: 1200,
    arquerosApilados: 60,
    defensa: 30,
    ataque: 30,
    armado: 20,
    avanzados: 25
  };

  function costo(equipos, totalArqueros) {
    var sumas = [], arqueros = [], def = [], atq = [], arm = [], avz = [];
    for (var i = 0; i < equipos.length; i++) {
      var e = equipos[i];
      sumas.push(sumaNivel(e));
      arqueros.push(contar(e, esArquero));
      def.push(contar(e, defiende));
      atq.push(contar(e, ataca));
      arm.push(contar(e, arma));
      avz.push(contar(e, esAvanzado));
    }

    var conArquero = 0;
    for (var m = 0; m < arqueros.length; m++) if (arqueros[m] > 0) conArquero++;
    var objetivo = Math.min(totalArqueros, equipos.length);

    var c = rango(sumas) * PESOS.nivel;
    c += Math.max(0, objetivo - conArquero) * PESOS.sinArquero;
    /* Repartir arqueros sobrantes solo tiene sentido si sobran. */
    if (totalArqueros >= equipos.length) c += rango(arqueros) * PESOS.arquerosApilados;
    c += rango(def) * PESOS.defensa;
    c += rango(atq) * PESOS.ataque;
    c += rango(arm) * PESOS.armado;
    c += rango(avz) * PESOS.avanzados;
    return c;
  }

  /* ---------- Construir un reparto ---------- */

  /* Quien se queda fuera esta vez. Se prefiere sentar a quien NO tapa,
     para no dejar a los equipos sin arquero antes de empezar. */
  function elegirBanca(jugadores, enCancha, rnd) {
    var mezcla = barajar(jugadores, rnd);
    var sobran = mezcla.length - enCancha;
    if (sobran <= 0) return { seleccion: mezcla, banca: [] };

    var noTapan = [], tapan = [];
    for (var i = 0; i < mezcla.length; i++) {
      if (esArquero(mezcla[i])) tapan.push(mezcla[i]); else noTapan.push(mezcla[i]);
    }
    var banca = [];
    while (banca.length < sobran && noTapan.length) banca.push(noTapan.pop());
    while (banca.length < sobran && tapan.length) banca.push(tapan.pop());

    var fuera = {};
    for (var b = 0; b < banca.length; b++) fuera[banca[b].id] = true;
    var seleccion = mezcla.filter(function (j) { return !fuera[j.id]; });
    return { seleccion: seleccion, banca: banca };
  }

  /* Reparto serpiente: 1-2-3-3-2-1. Da un equilibrio decente de salida. */
  function repartoSerpiente(seleccion, nEquipos, rnd) {
    var orden = barajar(seleccion, rnd).sort(function (a, b) { return puntos(b) - puntos(a); });
    var equipos = [];
    for (var i = 0; i < nEquipos; i++) equipos.push([]);
    var idx = 0, dir = 1;
    for (var p = 0; p < orden.length; p++) {
      equipos[idx].push(orden[p]);
      if (dir === 1) { if (idx === nEquipos - 1) dir = -1; else idx++; }
      else { if (idx === 0) dir = 1; else idx--; }
    }
    return equipos;
  }

  /*
   * Afinado: prueba intercambios de a dos y se queda con los que mejoran.
   * Incluye intercambios con la banca, que es justo lo que permite
   * compensar una cantidad impar de avanzados.
   */
  function afinar(equipos, banca, totalArqueros, maxPasadas) {
    var mejor = costo(equipos, totalArqueros);
    var pasada = 0;
    while (pasada < maxPasadas) {
      var cambio = false;

      for (var a = 0; a < equipos.length; a++) {
        for (var b = a + 1; b < equipos.length; b++) {
          for (var i = 0; i < equipos[a].length; i++) {
            for (var j = 0; j < equipos[b].length; j++) {
              var x = equipos[a][i], y = equipos[b][j];
              equipos[a][i] = y; equipos[b][j] = x;
              var c = costo(equipos, totalArqueros);
              if (c < mejor) { mejor = c; cambio = true; }
              else { equipos[a][i] = x; equipos[b][j] = y; }
            }
          }
        }
      }

      for (var t = 0; t < equipos.length; t++) {
        for (var ii = 0; ii < equipos[t].length; ii++) {
          for (var bb = 0; bb < banca.length; bb++) {
            var dentro = equipos[t][ii], fuera = banca[bb];
            equipos[t][ii] = fuera; banca[bb] = dentro;
            var c2 = costo(equipos, totalArqueros);
            if (c2 < mejor) { mejor = c2; cambio = true; }
            else { equipos[t][ii] = dentro; banca[bb] = fuera; }
          }
        }
      }

      if (!cambio) break;
      pasada++;
    }
    return mejor;
  }

  function firma(equipos) {
    return equipos.map(function (e) {
      return e.map(function (j) { return j.id; }).sort().join(',');
    }).sort().join('|');
  }

  function vestir(bruto) {
    return {
      costo: bruto.costo,
      equipos: bruto.equipos.map(function (e, i) {
        return {
          indice: i,
          nombre: EQUIPOS[i].nombre,
          color: EQUIPOS[i].color,
          emoji: EQUIPOS[i].emoji,
          patron: EQUIPOS[i].patron,
          jugadores: e.slice(),
          total: sumaNivel(e),
          arqueros: contar(e, esArquero),
          defensa: contar(e, defiende),
          ataque: contar(e, ataca)
        };
      }),
      rotan: bruto.banca.slice()
    };
  }

  /* Recalcula los totales despues de un intercambio manual. */
  function recalcular(propuesta) {
    propuesta.equipos.forEach(function (eq) {
      eq.total = sumaNivel(eq.jugadores);
      eq.arqueros = contar(eq.jugadores, esArquero);
      eq.defensa = contar(eq.jugadores, defiende);
      eq.ataque = contar(eq.jugadores, ataca);
    });
    return propuesta;
  }

  function analizar(propuesta) {
    var totales = propuesta.equipos.map(function (e) { return e.total; });
    var sinArquero = propuesta.equipos.filter(function (e) { return e.arqueros === 0; });
    return {
      diferencia: rango(totales),
      totales: totales,
      equiposSinArquero: sinArquero.map(function (e) { return e.nombre; })
    };
  }

  /*
   * armar() — el punto de entrada.
   *
   *   jugadores  lista completa (los que rotan salen de aqui)
   *   formatoId  '2x5' | '2x6' | '3x5' | '3x6'
   *   opciones   { semilla, intentos }
   */
  function armar(jugadores, formatoId, opciones) {
    opciones = opciones || {};

    var formato = null;
    for (var i = 0; i < FORMATOS.length; i++) {
      if (FORMATOS[i].id === formatoId) formato = FORMATOS[i];
    }
    if (!formato) throw new Error('Formato desconocido: ' + formatoId);

    var enCancha = formato.equipos * formato.porEquipo;
    if (jugadores.length < enCancha) {
      return {
        ok: false,
        motivo: 'Faltan ' + (enCancha - jugadores.length) +
                ' jugador(es) para armar ' + etiquetaFormato(formato) + '.'
      };
    }

    var rnd = azar(opciones.semilla == null ? (Date.now() & 0x7fffffff) : opciones.semilla);
    var intentos = opciones.intentos || 140;
    var totalArqueros = jugadores.filter(esArquero).length;

    var candidatos = [];
    for (var t = 0; t < intentos; t++) {
      var corte = elegirBanca(jugadores, enCancha, rnd);
      var equipos = repartoSerpiente(corte.seleccion, formato.equipos, rnd);
      var banca = corte.banca.slice();
      var c = afinar(equipos, banca, totalArqueros, 8);
      candidatos.push({
        costo: c,
        equipos: equipos.map(function (e) { return e.slice(); }),
        banca: banca.slice(),
        firma: firma(equipos)
      });
    }

    candidatos.sort(function (a, b) { return a.costo - b.costo; });

    /* Dos propuestas DISTINTAS: la mejor, y la mejor que no sea la misma. */
    var elegidas = [candidatos[0]];
    for (var k = 1; k < candidatos.length && elegidas.length < 2; k++) {
      if (candidatos[k].firma !== elegidas[0].firma) elegidas.push(candidatos[k]);
    }

    return {
      ok: true,
      formato: {
        id: formato.id,
        equipos: formato.equipos,
        porEquipo: formato.porEquipo,
        etiqueta: etiquetaFormato(formato),
        enCancha: enCancha
      },
      totalArqueros: totalArqueros,
      propuestas: elegidas.map(vestir)
    };
  }

  /* ---------- Mensaje para compartir ---------- */
  /* Nombres y rotacion si. Calificaciones NO: son del organizador. */

  function textoParaCompartir(resultado, propuesta) {
    var lineas = [];
    lineas.push('⚽ PICHANGA — ' + resultado.formato.etiqueta);
    lineas.push('');
    propuesta.equipos.forEach(function (eq) {
      lineas.push(eq.emoji + ' EQUIPO ' + eq.nombre.toUpperCase());
      eq.jugadores.forEach(function (j, i) {
        lineas.push('  ' + (i + 1) + '. ' + j.nombre);
      });
      lineas.push('');
    });
    if (propuesta.rotan.length) {
      lineas.push('🔁 Rotan (' + propuesta.rotan.length + '): ' +
        propuesta.rotan.map(function (j) { return j.nombre; }).join(', '));
    } else {
      lineas.push('🔁 Entran todos, nadie rota.');
    }
    return lineas.join('\n');
  }

  return {
    PUNTOS: PUNTOS,
    NIVELES: NIVELES,
    POSICIONES: POSICIONES,
    FORTALEZAS: FORTALEZAS,
    FORMATOS: FORMATOS,
    EQUIPOS: EQUIPOS,
    puntos: puntos,
    esArquero: esArquero,
    defiende: defiende,
    ataca: ataca,
    arma: arma,
    formatosPara: formatosPara,
    armar: armar,
    recalcular: recalcular,
    analizar: analizar,
    textoParaCompartir: textoParaCompartir
  };
});
