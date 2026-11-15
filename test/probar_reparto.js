'use strict';
/*
 * Pruebas del reparto. Se corren con:   node test/probar_reparto.js
 *
 * No usan ningun framework a proposito: una dependencia menos y se puede
 * correr en cualquier maquina que tenga node.
 */

var Reparto = require('../js/reparto.js');

var fallos = 0, pruebas = 0;

function comprobar(condicion, descripcion, detalle) {
  pruebas++;
  if (condicion) {
    console.log('   ok   ' + descripcion);
  } else {
    fallos++;
    console.log('   FALLA ' + descripcion + (detalle ? '  ->  ' + detalle : ''));
  }
}

/* ---------- Fabrica de planteles ---------- */

var NOMBRES = ['Beto', 'Caro', 'Dani', 'Erick', 'Flor', 'Gato', 'Hugo', 'Ivan',
  'Jhon', 'Kevin', 'Lucho', 'Mati', 'Nico', 'Omar', 'Pulpo', 'Quique', 'Raul',
  'Sandro', 'Tito', 'Ulises', 'Vico', 'Willy'];

/*
 * plantel(total, avanzados, intermedios, arqueros)
 * El resto se completa con principiantes.
 */
function plantel(total, avanzados, intermedios, arqueros) {
  var lista = [];
  for (var i = 0; i < total; i++) {
    var nivel = 'principiante';
    if (i < avanzados) nivel = 'avanzado';
    else if (i < avanzados + intermedios) nivel = 'intermedio';
    lista.push({
      id: 'j' + i,
      nombre: NOMBRES[i % NOMBRES.length] + (i >= NOMBRES.length ? '-' + i : ''),
      nivel: nivel,
      puedeTapar: false,
      posicion: '',
      fortalezas: []
    });
  }
  /* Los arqueros se reparten salteados, no en bloque, para que la prueba
     no sea mas facil de lo que seria en la vida real. */
  for (var k = 0; k < arqueros && k * 3 < total; k++) {
    lista[k * 3].puedeTapar = true;
  }
  /* Algunas fortalezas y posiciones, para ejercitar ese reparto. */
  for (var m = 0; m < total; m++) {
    if (m % 4 === 1) { lista[m].posicion = 'defensa'; lista[m].fortalezas = ['marca']; }
    if (m % 4 === 2) { lista[m].posicion = 'delantero'; lista[m].fortalezas = ['goles']; }
    if (m % 5 === 3) { lista[m].fortalezas = ['juego']; }
  }
  return lista;
}

function contarArqueros(lista) {
  return lista.filter(Reparto.esArquero).length;
}

/* ---------- Comprobaciones comunes a cualquier reparto ---------- */

function revisarPropuesta(etiqueta, jugadores, resultado, propuesta) {
  var fmt = resultado.formato;

  var tamanosOk = propuesta.equipos.every(function (e) {
    return e.jugadores.length === fmt.porEquipo;
  });
  comprobar(tamanosOk, etiqueta + ': todos los equipos tienen ' + fmt.porEquipo,
    propuesta.equipos.map(function (e) { return e.jugadores.length; }).join('/'));

  /* Nadie repetido, nadie perdido. */
  var vistos = {}, repetido = null, totalVistos = 0;
  propuesta.equipos.forEach(function (e) {
    e.jugadores.forEach(function (j) {
      if (vistos[j.id]) repetido = j.nombre;
      vistos[j.id] = true; totalVistos++;
    });
  });
  propuesta.rotan.forEach(function (j) {
    if (vistos[j.id]) repetido = j.nombre;
    vistos[j.id] = true; totalVistos++;
  });
  comprobar(repetido === null, etiqueta + ': ningun jugador esta dos veces', repetido);
  comprobar(totalVistos === jugadores.length,
    etiqueta + ': estan los ' + jugadores.length + ' jugadores',
    'contados ' + totalVistos);

  comprobar(propuesta.rotan.length === jugadores.length - fmt.enCancha,
    etiqueta + ': rotan ' + (jugadores.length - fmt.enCancha),
    'rotan ' + propuesta.rotan.length);

  var an = Reparto.analizar(propuesta);
  comprobar(an.diferencia <= 2,
    etiqueta + ': diferencia de nivel <= 2 (es ' + an.diferencia + ')',
    'totales ' + an.totales.join(' / '));

  var arq = contarArqueros(jugadores);
  if (arq >= fmt.equipos) {
    comprobar(an.equiposSinArquero.length === 0,
      etiqueta + ': cada equipo tiene quien tape',
      'sin arquero: ' + an.equiposSinArquero.join(', '));
  } else {
    console.log('   --   ' + etiqueta + ': solo hay ' + arq + ' arquero(s) para ' +
      fmt.equipos + ' equipos, no se exige uno por equipo');
  }

  return an;
}

/* El mensaje no debe filtrar las calificaciones. */
function revisarMensaje(etiqueta, resultado, propuesta) {
  var texto = Reparto.textoParaCompartir(resultado, propuesta);
  var filtra = /principiante|intermedio|avanzado|nivel|puntos/i.test(texto);
  comprobar(!filtra, etiqueta + ': el mensaje no revela las calificaciones');

  var nombresEnMensaje = propuesta.equipos.every(function (e) {
    return e.jugadores.every(function (j) { return texto.indexOf(j.nombre) !== -1; });
  });
  comprobar(nombresEnMensaje, etiqueta + ': el mensaje trae todos los nombres');

  if (propuesta.rotan.length) {
    var rotanEnMensaje = propuesta.rotan.every(function (j) {
      return texto.indexOf(j.nombre) !== -1;
    });
    comprobar(rotanEnMensaje, etiqueta + ': el mensaje dice quienes rotan');
  }
}

/* ---------- Casos ---------- */

var casos = [
  {
    titulo: '12 jugadores — 3 avanzados (impar), 2 arqueros',
    jugadores: plantel(12, 3, 4, 2)
  },
  {
    titulo: '15 jugadores — 5 avanzados (impar), 1 solo arquero',
    jugadores: plantel(15, 5, 5, 1)
  },
  {
    titulo: '17 jugadores — 7 avanzados (impar), 3 arqueros',
    jugadores: plantel(17, 7, 6, 3)
  },
  {
    titulo: '18 jugadores — 4 avanzados, NADIE puede tapar',
    jugadores: plantel(18, 4, 8, 0)
  },
  {
    titulo: '12 jugadores — el caso del enunciado: 3 avanzados, 1 intermedio, 8 principiantes',
    jugadores: plantel(12, 3, 1, 2)
  },
  {
    titulo: '10 jugadores — el minimo justo, nadie rota',
    jugadores: plantel(10, 3, 3, 2)
  }
];

console.log('');
console.log('================================================');
console.log('  PICHANGA — pruebas del reparto equilibrado');
console.log('================================================');

var resumen = [];
var arranque = Date.now();

casos.forEach(function (caso) {
  console.log('');
  console.log('--- ' + caso.titulo + ' ---');
  var n = caso.jugadores.length;
  var disponibles = Reparto.formatosPara(n).filter(function (f) { return f.alcanza; });

  comprobar(disponibles.length > 0, 'hay al menos un formato posible con ' + n);

  disponibles.forEach(function (f) {
    var t0 = Date.now();
    /* Semilla fija: el mismo caso se comprueba siempre igual. */
    var resultado = Reparto.armar(caso.jugadores, f.id, { semilla: 20260101 + n });
    var ms = Date.now() - t0;

    comprobar(resultado.ok, f.etiqueta + ': se pudo armar', resultado.motivo);
    if (!resultado.ok) return;

    comprobar(resultado.propuestas.length === 2,
      f.etiqueta + ': ofrece 2 propuestas distintas',
      'ofrece ' + resultado.propuestas.length);

    if (resultado.propuestas.length === 2) {
      var a = JSON.stringify(resultado.propuestas[0].equipos.map(function (e) {
        return e.jugadores.map(function (j) { return j.id; }).sort();
      }));
      var b = JSON.stringify(resultado.propuestas[1].equipos.map(function (e) {
        return e.jugadores.map(function (j) { return j.id; }).sort();
      }));
      comprobar(a !== b, f.etiqueta + ': las 2 propuestas no son iguales');
    }

    var an = null;
    resultado.propuestas.forEach(function (p, i) {
      var et = f.etiqueta + ' / propuesta ' + (i + 1);
      var r = revisarPropuesta(et, caso.jugadores, resultado, p);
      if (i === 0) an = r;
      revisarMensaje(et, resultado, p);
    });

    resumen.push({
      caso: n + ' jug.',
      formato: f.etiqueta,
      rotan: f.rotan,
      totales: an.totales.join(' / '),
      dif: an.diferencia,
      arqueros: contarArqueros(caso.jugadores),
      ms: ms
    });
  });
});

/* ---------- Reparto manual: intercambiar dos jugadores ---------- */

console.log('');
console.log('--- Intercambio manual entre equipos ---');
var js = plantel(12, 3, 4, 2);
var res = Reparto.armar(js, '2x6', { semilla: 7 });
var prop = res.propuestas[0];
var antesA = prop.equipos[0].total, antesB = prop.equipos[1].total;
var x = prop.equipos[0].jugadores[0];
var y = prop.equipos[1].jugadores[0];
prop.equipos[0].jugadores[0] = y;
prop.equipos[1].jugadores[0] = x;
Reparto.recalcular(prop);
var esperadoA = antesA - Reparto.puntos(x) + Reparto.puntos(y);
comprobar(prop.equipos[0].total === esperadoA,
  'tras intercambiar, los totales se recalculan',
  'esperaba ' + esperadoA + ', dio ' + prop.equipos[0].total);
comprobar(prop.equipos[0].jugadores.length === 6 && prop.equipos[1].jugadores.length === 6,
  'tras intercambiar, los equipos siguen de 6');

/* ---------- Formato que no alcanza ---------- */

console.log('');
console.log('--- Formato que no alcanza ---');
var pocos = plantel(9, 2, 3, 1);
var negado = Reparto.armar(pocos, '2x6', { semilla: 1 });
comprobar(negado.ok === false, 'con 9 jugadores rechaza 2 equipos de 6');
comprobar(/Faltan 3/.test(negado.motivo || ''), 'y dice cuantos faltan', negado.motivo);

/* ---------- Resumen ---------- */

console.log('');
console.log('================================================');
console.log('  RESUMEN DE REPARTOS');
console.log('================================================');
console.log('');
console.log(' Plantel   Formato            Rotan  Arq  Totales        Dif   ms');
console.log(' --------  -----------------  -----  ---  -------------  ----  ----');
resumen.forEach(function (r) {
  console.log(
    ' ' + r.caso.padEnd(9) +
    r.formato.padEnd(19) +
    String(r.rotan).padEnd(7) +
    String(r.arqueros).padEnd(5) +
    r.totales.padEnd(15) +
    String(r.dif).padEnd(6) +
    String(r.ms)
  );
});

console.log('');
console.log('================================================');
console.log('  ' + (pruebas - fallos) + ' de ' + pruebas + ' comprobaciones pasaron' +
  (fallos ? '  —  ' + fallos + ' FALLARON' : '  —  todo en orden'));
console.log('  tiempo total: ' + (Date.now() - arranque) + ' ms');
console.log('================================================');
console.log('');

process.exit(fallos ? 1 : 0);
