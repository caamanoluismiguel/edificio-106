# Analítica de visitas

Fuente única del esquema de conteo de visitas del visor del Edificio 106 y del piloto interior (`caamanoluismiguel.github.io/edificio-106/` y `/piloto/`). El repo `piloto` remite aquí. Decisión y debate del panel: `ORGANIZACION/ANALITICA-TRAFICO.md` en la carpeta de trabajo de LM (no está en el repo).

## Qué se usa

[GoatCounter](https://www.goatcounter.com/), cuenta `caamano`, con el script oficial `count.js` (unos 3,3 kB comprimido, cargado con `async` al final de la página, sin preconexión). Un solo sitio de GoatCounter cubre los dos repos; se distinguen por la ruta (`/edificio-106/…` y `/piloto/…`) y por el prefijo de los eventos (`106-…` y `piloto-…`).

- Sin cookies. La analítica no guarda nada en el navegador de quien visita salvo la clave `skipgc`, y solo si la persona pide excluirse. El visor tiene sus propias preferencias locales (como `e106-visto`), ajenas a la analítica.
- GoatCounter usa la IP y el navegador solo en memoria para agrupar una visita durante 8 horas con un identificador al azar; no guarda ni la IP ni el texto del navegador.
- El panel de GoatCounter es privado (sin sesión redirige al inicio de sesión) y el contador público está apagado (responde 403). Ninguna página muestra cifras ni enlaza al panel.
- No hay CSP en ninguno de los dos sitios. Si algún día se agrega, necesita `script-src https://gc.zgo.at` y `connect-src https://caamano.goatcounter.com`.

## Dónde está el código

| Repo | Archivo | Qué lleva |
|---|---|---|
| edificio-106 | `fuente/cuerpo.html` (al final; `index.html` se arma con `fuente/armar-raiz.sh`) | fragmento común, acciones del visor, nota de privacidad en «Fuentes y método» |
| edificio-106 | `ar/index.html`, `ar/quicklook/index.html`, `gnomon/index.html` | fragmento común |
| edificio-106 | `fuente/src/main.js`, `enlaceMomento(ref)` | `?ref=enlace` en los enlaces copiados y `?ref=qr-imagen` en el QR de la imagen PNG |
| piloto | las 9 páginas de la galería y los recorridos | fragmento común; en los recorridos, el evento del minimapa |

No se cuentan: `ar/tarjeta.html` (generador de la tarjeta impresa), `ar/piloto/registro.html` (interno), y en el piloto `edificio/preguntas/` y `edificio/guia-fotos.html` (documentos de trabajo).

## Rutas

La ruta es solo `location.pathname`, sin `index.html` y sin la consulta: `/edificio-106/`, `/edificio-106/ar/`, `/edificio-106/gnomon/`, `/piloto/edificio/A/05-recorrido/`. Los parámetros del visor (`?edificio=`, `#m-…`) no crean páginas nuevas.

El referente de otro sitio se guarda solo como dominio (`https://www.linkedin.com/`), sin la ruta ni la consulta. Nota: `count.js` envía siempre `location.search` aparte; GoatCounter solo lee de ahí `ref`, `src`, `source`, `utm_source`, `campaign` y `utm_campaign`. En el visor y en el gnomon la consulta lleva estado de la vista (fecha, hora, edificio), nunca datos de la persona.

## Marcas de procedencia (`?ref=`)

Cada enlace que LM reparte lleva `?ref=` con uno de estos valores, en minúsculas y sin tildes. No se usan `utm_*`.

| ref | dónde se usa |
|---|---|
| `linkedin` | publicaciones y perfil de LinkedIn |
| `correo` | correos y firmas |
| `whatsapp` | mensajes de WhatsApp |
| `clase` | material de clase, aulas virtuales |
| `cv` | hoja de vida y portafolio |
| `doi` | página de Zenodo o del DOI |
| `github` | README y página del repo |
| `qr-tarjeta` | QR de la tarjeta impresa de AR (la tarjeta actual no lo lleva; la próxima con `node ar/generar-tarjeta.mjs --url=https://caamanoluismiguel.github.io/edificio-106/ar/?ref=qr-tarjeta`, comprobando que `plano.mind` no cambie) |
| `enlace` | lo pone solo el visor al copiar un enlace («Copiar enlace», «Copiar vista», ficha de un edificio) |
| `qr-imagen` | lo pone solo el visor en el QR de la imagen PNG |

Para un lanzamiento con fecha se agrega `&campaign=` (por ejemplo `?ref=linkedin&campaign=lanzamiento-2026`, `?ref=doi&campaign=doi-2026`): una campaña por postulación o anuncio.

Ejemplo: `https://caamanoluismiguel.github.io/edificio-106/?ref=linkedin&campaign=lanzamiento-2026`.

Copiar la dirección desde la barra del navegador no se puede detectar y no se intenta: no se escuchan eventos de copia de texto. Lo que se mide es la llegada desde enlaces marcados.

## Eventos

GoatCounter cuenta cada evento como mucho una vez por visita. Solo se cuentan toques reales (`event.isTrusted`), sin texto libre, coordenadas ni valores.

| Evento | Cuándo |
|---|---|
| `106-lente-<id>` | se elige una forma de ver en la barra «Ver» (`foto`, `sol`, `lluvia`, `viento`, `sombras`, `partes`; en Diseño industrial `di-piezas`, `di-construir`, `di-mecanismos`) |
| `106-reloj-mover` | primera vez que se mueve la hora, el día del año o el mes |
| `106-enlace-copiar` | «Copiar enlace», «Copiar vista» o el enlace de la ficha |
| `106-imagen-guardar` | «Guardar imagen (PNG)» |
| `106-ar-abrir` | «Abrir la cámara» (AR, solo en pantallas táctiles) |
| `106-tarjeta-pdf` | «Descargar la tarjeta (PDF)» |
| `106-gnomon-abrir` | enlace a la hoja de campo del gnomon |
| `106-divisor-abrir` | enlace al visor de diseño industrial |
| `106-creditos-abrir` | se abre «Fuentes y método» |
| `piloto-mapa-abrir` | se abre el minimapa de un recorrido |
| `106-permanencia-30s`, `-2min`, `-5min` y lo mismo con `piloto-` | la página lleva 30 s, 2 min o 5 min visible (el tiempo en otra pestaña no suma) |

La apertura del piloto y de cada recorrido se ve como visita a su página, no como evento. No hay botón propio de compartir con `navigator.share`; queda propuesto como fase 2 y, si se agrega, no muestra ninguna cifra.

## Qué no se mide

Movimientos de cámara, zoom, desplazamiento, cada paso del reloj, tiempo exacto en página, texto copiado, grabaciones de sesión, mapas de calor, huellas del navegador o del dispositivo, y cualquier dato que identifique a una persona. Lo usan estudiantes.

## Cómo leer las cifras

- Son visitas (sesiones de hasta 8 horas), no personas, y son un mínimo: los bloqueadores de anuncios y quien se excluye no cuentan.
- Con menos de unas 30 visitas se dan solo números absolutos; el ruido es del orden de la raíz de N.
- Un evento se lee como «X de N visitas al sitio». Los eventos comunes (la permanencia, con el mismo nombre en las cuatro páginas del 106 o en las nueve del piloto, y `piloto-mapa-abrir`, igual en los cuatro recorridos) se cuentan una vez por visita y no se pueden atribuir a una página. Los del visor (lentes, AR, enlace, tarjeta) sí se leen contra las visitas al visor.
- El tráfico de GitHub (interés en el código) no se suma a GoatCounter; se archiva aparte, a diario, en la carpeta `trafico-repos/` de LM (fuera del repo).

## Excluir un navegador

Abrir cualquier página con `#toggle-goatcounter` al final, una vez, deja ese navegador sin contar (avisa en español); otra vez lo vuelve a contar. Vale para todo `caamanoluismiguel.github.io` en ese navegador. LM lo hace en cada navegador y dispositivo propio.

## Privacidad (Ley 81 de 2019, Panamá)

Ponderación del interés legítimo (Decreto Ejecutivo 285 de 2021, art. 17.7), escrita aquí como pide el panel:

- **Finalidad**: saber cuánto y desde dónde se usa un proyecto académico abierto, para documentarlo ante pares y postulaciones.
- **Necesidad**: no hay forma de contar visitas sin procesar la IP un instante; GoatCounter la usa solo en memoria y guarda totales disociados (art. 3.5 de la ley excluye el dato anonimizado).
- **Equilibrio**: quienes visitan pueden ser estudiantes, algunos menores. Por eso no hay cookies, ni identificadores persistentes, ni grabaciones, ni texto libre, ni cifras públicas, y hay una forma simple de excluirse.
- **Aviso**: la nota «Visitas» de «Fuentes y método» del visor y el pie del piloto (portada y `edificio/`) dicen quién lo gestiona, para qué se cuenta y enlazan aquí, siguiendo el aviso por capas del Decreto 285 (art. 16); este documento es la segunda capa. Las páginas secundarias (`ar/`, `ar/quicklook/`, `gnomon/` y siete páginas del piloto) cuentan sin nota propia; para cubrir del todo el art. 16 se les puede añadir el mismo pie con enlace (decisión pendiente de LM).

Responsable: Luis Miguel Caamaño. Consultas por los Issues del repositorio `edificio-106` en GitHub.

## Informes

Desde la computadora de LM, fuera de los repos:

- `python3 trafico-repos/informe_goatcounter.py --dias=30` (también `--sitio=edificio-106|piloto`, `--desde`, `--hasta`, `--csv=`). Lee el token de solo lectura de la configuración de GoatCounter de LM, que nunca entra a un repo.
- `trafico-repos/archivar_trafico.py`, a diario a las 9:15 con el LaunchAgent `com.caamano.trafico-repos`.
