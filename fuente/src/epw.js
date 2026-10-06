// Archivo de clima EPW (EnergyPlus Weather) de un año de la serie 2001–2025, para abrirlo en EnergyPlus, CBE Clima, Ladybug u otros.
// Formato: EnergyPlus, «Auxiliary Programs», cap. 2.9 (campos de datos 1 a 35). La hora h del EPW (1–24) es la hora que termina
// a las h:00, igual que la marca de Open-Meteo: la radiación y la lluvia son de la hora anterior, la temperatura del instante.
// Sale de los mismos datos del visor: temperatura y humedad ajustadas a Albrook (clima.th), salvo con ?era5=crudo.
// Lo que ERA5 no trae se calcula (punto de rocío, radiación global) o se pone como faltante (9999 y otros, según el formato).
import { posicionSol, LAT, LON } from './sol.js';

const ALTURA = 24;                                                     // m, la de la celda de ERA5 que devuelve Open-Meteo
const P = Math.round(101325 * (1 - 2.25577e-5 * ALTURA) ** 5.25588);   // presión estándar a esa altura, Pa
const BANDERAS = '?9?9?9?9E0?9?9?9?9?9?9?9?9?9?9?9?9?9?9?9*9*9?9?9?9';
const DIAS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Punto de rocío (°C) con la fórmula de Magnus (Alduchov y Eskridge, 1996), la misma constante que ajuste.js. */
const rocio = (t, rh) => { const g = Math.log(Math.max(1, rh) / 100) + 17.625 * t / (243.04 + t); return 243.04 * g / (17.625 - g); };

/** Texto EPW del año y (2001–2025). Deja fuera el 29 de febrero, como un año típico de 8.760 horas. */
export function epw(clima, y) {
  const ajustado = !!clima.ajuste, filas = [];
  for (let m = 1; m <= 12; m++) {
    const dm = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (let d = 1; d <= dm; d++) {
      if (m === 2 && d === 29) continue;
      for (let h = 1; h <= 24; h++) {
        const i = Math.min(clima.n - 1, clima.indice({ y, m, d }, 0) + h);   // la marca h:00 del mismo día (24 = 0:00 del siguiente)
        const [t, rh] = clima.th(i);
        const dni = clima.valor('dni', i), dhi = clima.valor('difusa', i);
        const alt = posicionSol({ y, m, d, h: h - 1, min: 30 }, LAT, LON).alt; // sol a la mitad de la hora
        const ghi = Math.round(dni * Math.max(0, Math.sin(alt * Math.PI / 180)) + dhi);
        const nub = Math.round(clima.valor('nubes', i) / 10);                // décimas de cielo
        const lluvia = clima.valor('lluvia', i);
        filas.push([y, m, d, h, 60, BANDERAS, t.toFixed(1), rocio(t, rh).toFixed(1), Math.round(rh), P,
          9999, 9999, 9999, ghi, Math.round(dni), Math.round(dhi), 999999, 999999, 999999, 9999,
          Math.round(clima.valor('dir', i)) % 360, (clima.valor('viento', i) / 3.6).toFixed(1), nub, nub, 9999, 99999, 9, 999999999,
          999, 0.999, 0, 88, 999, lluvia.toFixed(1), 1].join(','));
      }
    }
  }
  const fuente = ajustado ? 'temperatura y humedad ajustadas a Albrook MPMG 2017-2025' : 'temperatura y humedad sin ajustar';
  const cab = [
    `LOCATION,Edificio 106 Ciudad del Saber (ERA5),Panama,PAN,ERA5 Open-Meteo,000000,${LAT},${LON},-5.0,${ALTURA}`,
    'DESIGN CONDITIONS,0',
    'TYPICAL/EXTREME PERIODS,0',
    'GROUND TEMPERATURES,0',
    'HOLIDAYS/DAYLIGHT SAVINGS,No,0,0,0',
    `COMMENTS 1,Reanalisis ERA5 (Copernicus C3S) via Open-Meteo (CC BY 4.0) celda 9.000 N 79.500 O; ${fuente}. No es una medicion en el sitio.`,
    `COMMENTS 2,Ano ${y} sin el 29 de febrero. Radiacion global = DNI x seno de la altura del sol + difusa. Presion estandar a ${ALTURA} m. Edificio 106 Isthmus: https://caamanoluismiguel.github.io/edificio-106/`,
    `DATA PERIODS,1,1,Data,${DIAS[new Date(Date.UTC(y, 0, 1)).getUTCDay()]}, 1/ 1,12/31`,
  ];
  return cab.concat(filas).join('\r\n') + '\r\n';
}
