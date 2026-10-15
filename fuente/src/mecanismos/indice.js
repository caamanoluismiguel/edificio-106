// Índice de los mecanismos del 106, en el orden del catálogo.
//
// Contrato: cada módulo exporta `crear(ctx)` y `meta` ({ clave, n, titulo }).
//   ctx = { THREE, linea, dibujar, rotulo, colores }, más opcionales que da el anfitrión:
//     perfil() → { grados: número | null, rotulo, motivo } | undefined   (alero: el sol del 106; undefined = sin fecha)
//     llueve() → { llueve: boolean, fuente: 'era5'|'albrook'|'pronostico'|'mes'|'aguacero' }  (teja: si la escena
//                dibuja lluvia y de qué fuente; la frase la escribe el módulo. 'albrook' solo con parte de observador:
//                de 23 a 5 h el 106 usa ERA5 y la fuente es 'era5'. 'mes' (año típico) es la lluvia del mes, no de la hora)
//     rosa()   → [[rumbo, fracción], …]                                  (gablete: la rosa de la temporada)
//     familias = datos/familias.json                                      (guillotina: recorrido, tope, ancho y piezas)
//   linea(puntos, { enfasis, sol, opacidad, discontinua, guion, segmentos, cerrada })
//   dibujar(geometría, { enfasis, vidrio, umbral, discontinua, poche, papel })
//     · discontinua: sin relleno y aristas en trazo discontinuo (lo que es principio del tipo)
//     · sol: el único ámbar, solo para el rayo de sol
//   rotulo(texto, [x, y, z], enfasis)
// crear(ctx) devuelve:
//   { objeto, actualizar(m, dt) → texto | [textos], camara: { pos, obj }, caja?, etiqueta, escala, rotulo, certeza,
//     morfologia, sello, ubicacion: { pieza: [[x0,z0],[x1,z1]], texto }, inicial?, animado?,
//     cifras?() → [{ clave, valor, certeza, fuente }], despiece?(f), opciones?: [{ id, nombre, valores, inicial }],
//     elegir?(id, valor) }
// `certeza` = [{ que, nivel, nota? }] con los niveles de datos/di/fichas.json (foto, medido, modelo, equipo, general)
// más «nosabe» (no se sabe) y «calculo» (cifra que calcula el 106, como el ángulo de perfil). El texto de cada nivel está
// en CERTEZA.
import * as teja from './teja.js';
import * as alfeizar from './alfeizar.js';
import * as tubo from './tubo.js';
import * as letrero from './letrero.js';
import * as bloque from './bloque.js';
import * as mensula from './mensula.js';
import * as alero from './alero.js';
import * as baranda from './baranda.js';
import * as puerta from './puerta.js';
import * as guillotina from './guillotina.js';
import * as principal from './puerta-principal.js';
import * as celosia from './celosia.js';
import * as gabinete from './gabinete.js';
import * as condensadora from './condensadora.js';
import * as poste from './poste.js';
import * as gablete from './gablete.js';
import * as rampa from './rampa.js';

export { CERTEZA } from './comun.js';
export { svgUbicacion } from './ubicacion.js';

const lista = [teja, alfeizar, tubo, letrero, bloque, mensula, alero, baranda, puerta, guillotina, principal, celosia, gabinete, condensadora, poste, gablete, rampa];
export const MECANISMOS = Object.fromEntries(lista.map((m) => [m.meta.clave, m]));
