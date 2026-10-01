# Piloto de la AR (F2)

Material para probar la tarjeta impresa con 3 a 5 personas antes de enlazar la AR desde el sitio. Viene de la fase F2 de `~/projects/edificio-106-AR-PLAN.md`.

- `guion.md`: preparación, el guion de 10 segundos, el protocolo con cada persona, lo que no hay que decir y cómo medir el tiempo.
- `registro.html`: la hoja de observación. Se imprime en A4 o carta, o se abre en el celular o el computador y se llena ahí. Funciona sin conexión, trae un cronómetro por fila, calcula el resumen y exporta CSV.

Nada de esta carpeta lo usa `ar/index.html`. No hay que armar nada.

## Cómo se usa

1. Leer `guion.md` entero una vez antes de la sesión.
2. Imprimir la tarjeta (`ar/tarjeta/tarjeta.pdf`) al 100 % en papel mate y preparar la mesa como dice la lista.
3. Abrir `registro.html` en un dispositivo que no sea el de la persona (o imprimirlo).
4. Una persona a la vez, sin público. Guion, cronómetro, temblor, tres preguntas.
5. Al terminar, «Exportar CSV» y guardar el archivo. Si la hoja fue en papel, pasar los números a `registro.html` para que saque el resumen.

## Cómo leer los resultados

- **Lo ven sin ayuda en 30 s o menos.** Es la medida principal. Meta: 80 %, o sea 4 de 5 (con 3 personas, 3 de 3). Con tan pocas personas, una sola cambia el resultado en 20 o 33 puntos: el número sirve para decidir si hay un problema, no para dar una cifra precisa.
- **Cámara contra edificio.** Si la mayor parte del tiempo pasa antes de tocar «Abrir la cámara», el problema está en llegar a la página (el código, el texto de la tarjeta, el permiso, la carga). Si pasa después, está en el rastreo (luz, papel, distancia, el plano).
- **Pedidos de ayuda.** Leer en comentarios qué preguntaron. La misma pregunta en dos personas es un arreglo seguro en la tarjeta o en la pantalla de inicio.
- **Primer gesto.** Si varias personas no escanean el código y apuntan directo al plano, o buscan un enlace, la instrucción de la tarjeta no se lee o no se entiende.
- **Temblor.** Promedio de 1 o menos: bien. Un 2 o un 3 en cualquier celular: anotar el modelo y el navegador, porque puede ser ese equipo. Un 2 o un 3 en la mayoría: hay que volver al filtro (`filterMinCF`) o considerar lo que el plan deja para F3.
- **«No lo vio».** Cada caso se revisa uno por uno: navegador dentro de WhatsApp o Instagram, permiso negado, celular sin soporte, error en pantalla. Son los mensajes de error y ayuda que siguen pendientes.

## Regla de decisión (del plan)

**Primero se corrige lo que falle y después se decide si se enlaza desde el sitio.**

- Si se cumple la meta, casi nadie pide ayuda y nadie da temblor 2 o 3: la tarjeta está lista, y LM decide si se enlaza desde el sitio.
- Si no se cumple: se corrige lo que mostró el piloto (texto de la tarjeta, pantalla de inicio, mensajes, filtro) y se repite el piloto con personas nuevas, que no hayan visto la tarjeta. No se enlaza hasta que pase.
- Si se cambia la imagen del plano, cambia `plano.mind`: las tarjetas impresas antes dejan de servir y hay que reimprimir para el siguiente piloto.
- Si el problema está en un solo modelo de celular, se anota en el plan y no frena el enlace.
