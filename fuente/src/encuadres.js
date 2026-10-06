// Encuadres (Capas → «Encuadres»): planos fijos para conocer Ciudad del Saber y una vista aérea de toda la ciudad. Los eligió un
// panel simulado (cinematógrafo, director de fotografía, fotógrafo de arquitectura, arquitecto fotógrafo y diseñador de la
// interfaz; ~/projects/edificio-106-ciudad-revision/encuadres/PANEL.md), con cada cuadro dibujado y mirado en el visor.
//   · pos y tgt: la cámara y el punto que mira, en metros de la escena (+X noreste, +Z sureste; el 106 en el origen);
//   · fov: el lente vertical en grados para pantallas apaisadas (en las verticales manda el de siempre, 58°, y la cámara se
//     aleja por la misma línea para que quepa lo mismo a lo ancho; movil: [x, y, z] la fija a mano);
//   · fecha y hora: un momento real de la serie ERA5 2001–2025 sin lluvia y con sol directo de más de 650 W/m², elegido por la luz; luz: por qué;
//   · ciudad: el encuadre muestra edificios de la ciudad (con la ciudad apagada no se ofrece); aerea: la vista de toda la ciudad
//     (sin desenfoque y con un giro lento al llegar); foco: radio en metros de la franja nítida alrededor del punto que se mira
//     (sin foco, la de siempre: el 106 entero nítido).
// Los textos van al verificador (.claude/agents/verificador.md): cada dato sale de docs/ciudad/edificios.json, CIUDAD.md o
// CERL (tipologias-cerl.md), y la altura y el rumbo del sol de sol.js para ese minuto.
export const ENCUADRES = [
  {
    id: 'ciudad', nombre: 'Toda la ciudad', aerea: true, ciudad: true,
    pos: [425.4, 640, 1003.4], tgt: [300, 0, -190], fov: 38, fecha: '2020-02-29', hora: '16:30',
    texto: 'Ciudad del Saber, el antiguo Fort Clayton, con el canal hacia el Lago Miraflores al fondo a la izquierda. Solo el 106 está medido: los demás edificios son una maqueta aproximada.',
    luz: '29 de febrero de 2020, 16:30, estación seca: el sol está a 28° de altura hacia el oeste (256°) y cada sombra mide casi el doble de la altura de lo que la proyecta.',
  },
  {
    id: '106', nombre: 'El 106 y sus vecinos',
    pos: [-3.9, 41, 85.8], tgt: [30, 6, -50], fov: 38, fecha: '2022-02-21', hora: '09:00',
    texto: 'El 106, el único edificio medido, entre cuarteles de tres pisos. Con la ciudad encendida, el 103 y el 107 repiten su volumen y el 100, el 101 y el 102 se arman con el kit de piezas; con la ciudad apagada, los cinco son copias del 106.',
    luz: '21 de febrero de 2022, 9:00: el sol está a 34° de altura hacia el este (109°) e incide en las fachadas sureste y noreste; la noroeste y la suroeste quedan a la sombra.',
  },
  {
    id: 'cuarteles', nombre: 'Cuarteles de cuatro niveles', ciudad: true, foco: 140,
    pos: [-161.7, 8, -895.8], tgt: [45, -2, -795], fov: 30, fecha: '2017-01-25', hora: '16:30',
    texto: 'Diecisiete cuarteles de tres pisos sobre una planta baja de servicio, alrededor de una misma manzana; aquí se ven del 221 al 225. Según el informe CERL, en 1987 las mediaguas de los cuarteles del área 200 del Ejército pasaron a tejas rojas de fibra de vidrio. Se identifican con estos por la cantidad, la forma y el lugar, no por el número, porque la numeración de CERL no es la de Ciudad del Saber.',
    luz: '25 de enero de 2017, 16:30: el sol de la tarde está a 25° de altura hacia el suroeste (244°) e incide en las fachadas largas, que miran al sur, y en los extremos que miran al oeste.',
  },
  {
    id: 'cenit', nombre: 'Dúplex en el día sin sombra', ciudad: true, foco: 120,
    pos: [162.5, 98, -275.1], tgt: [300, 3, -375], fov: 34, fecha: '2016-04-12', hora: '12:19',
    texto: 'Las filas de dúplex que, según el informe CERL, se conocían como «tropical duplexes», un tipo construido de 1939 a 1943 en el istmo (p. 5-7): dos pisos de vivienda sobre pilotes de concreto, con el estacionamiento abajo, mediagua y techo de teja a cuatro aguas.',
    luz: '12 de abril de 2016, 12:19: el sol está a 90° de altura, casi exactamente en el cenit, y cada casa queda sobre su propia sombra. A esta latitud pasa dos veces al año, en abril y en agosto.',
  },
  {
    id: 'duplex', nombre: 'Una fila de dúplex', ciudad: true, foco: 90,
    pos: [179.7, 17, -470.1], tgt: [258, 3, -354], fov: 26, fecha: '2023-02-21', hora: '16:30',
    texto: 'Una fila de dúplex vista a lo largo: el techo a cuatro aguas, la mediagua y la planta baja sobre pilotes, con un cuarto al centro y un estacionamiento a cada lado, se repiten casa tras casa.',
    luz: '21 de febrero de 2023, 16:30: el sol está a 28° de altura hacia el oeste (253°) y entra unos metros bajo el piso de arriba por el extremo oeste; más adentro, la planta baja queda a la sombra.',
  },
  {
    id: 'colonels', nombre: 'Colonels’ Row', ciudad: true, foco: 70,
    pos: [607.5, 9, 363.1], tgt: [640, 4, 290], fov: 30, fecha: '2017-01-25', hora: '16:30',
    texto: 'Las casas de la calle Aroldo Cano, del tipo que el informe CERL llama Colonels’ Row y fecha en 1932 y 1933: la vivienda va un piso arriba, sobre pilares de concreto, y abajo quedan el servicio, la bodega y el estacionamiento.',
    luz: '25 de enero de 2017, 16:30: el sol está a 25° de altura hacia el suroeste (244°); bajo la casa, entre los pilares, queda la sombra.',
  },
  {
    id: 'oficiales', nombre: 'Casas de oficiales', ciudad: true, foco: 60,
    pos: [1057.8, 26, -308], tgt: [1150, 20, -285], fov: 34, movil: [1057.8, 26, -308], fecha: '2010-12-21', hora: '09:00',
    texto: 'Casas de oficiales de un tipo construido de 1939 a 1943 en el istmo según CERL (p. 5-7): dos pisos de vivienda sobre una planta baja con cochera y techo de teja a dos aguas. El tipo de estas casas se asigna por la forma y el tamaño de la huella, porque la numeración de CERL no es la de Ciudad del Saber.',
    luz: '21 de diciembre de 2010, 9:00, solsticio de diciembre: el sol sale más al sur que en todo el año y a esta hora está a 32° de altura hacia el sureste (125°).',
  },
  {
    id: 'nco', nombre: 'Casas tipo NCO de 1949', ciudad: true, foco: 50,
    pos: [573.7, 22, -330.2], tgt: [580, 13, -420], fov: 36, fecha: '2016-01-11', hora: '09:00',
    texto: 'Casas de un piso sobre losa, del tipo que CERL describe como las de suboficiales (NCO) de 1949: el primer diseño del fuerte sin piso elevado, con techo de pendiente baja de asbesto corrugado rojo que imita la teja. El tipo se asigna por la forma, porque la numeración de CERL no es la de Ciudad del Saber.',
    luz: '11 de enero de 2016, 9:00: el sol está a 31° de altura hacia el sureste (122°). Sin mediaguas, el sol incide en el muro sureste por debajo de la franja que sombrea el alero.',
  },
  {
    id: 'crance', nombre: 'Calle Gonzalo Crance', ciudad: true, foco: 60,
    pos: [99.1, 8, 363.8], tgt: [172, 3, 320], fov: 36, movil: [99.1, 8, 363.8], fecha: '2012-02-14', hora: '16:30',
    texto: 'Dieciséis bloques de dos pisos con techo de lámina a dos aguas a lo largo de la calle Gonzalo Crance.',
    luz: '14 de febrero de 2012, 16:30: el sol de la tarde está a 27° de altura hacia el oeste (250°) e incide casi de frente en los extremos que miran al suroeste; las fachadas largas que miran al sureste quedan a la sombra.',
  },

];
