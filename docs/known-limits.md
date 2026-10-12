# Límites conocidos y pendientes

Estado a 2026-10-11. Lo que sigue no es un error escondido: es lo que el plan o la evidencia todavía no resuelven.

## Del volumen

- **El 0.5 de las series indirectas es plano** para cualquier ejercicio y músculo. Graduarlo queda pendiente por falta de datos que lo respalden, y su respaldo publicado solo se leyó en el resumen (V1 parcial en `docs/volume-sources.md`; V4 cerrada).
- **Un ejercicio con varios músculos primarios cuenta serie completa para cada uno** (la sentadilla para cuádriceps y glúteos). Para los glúteos lo respalda un ensayo (Plotkin 2023); para otros pares no hay datos. Puede inflar el volumen de un músculo cubierto, aunque el máximo semanal ya se respeta contando ese crédito.
- **La evidencia de volumen viene sobre todo de músculos grandes** y de poblaciones específicas (hombres jóvenes en su mayoría). Los rangos de trapecios, antebrazos, aductores y lumbar son extrapolaciones.
- **El tope de 8 series fraccionales por sesión** es una decisión con evidencia parcial (preprint). La prueba con 11 perfiles no demuestra que 8 sea el valor correcto; ver `docs/sensitivity/per-session-cap.md`.

## Del planificador de la semana (rediseño del 2026-10-11)

- **Crédito esperado contra crédito real.** Las series propias se estiman con el ejercicio principal de cada músculo (`exercisesFor(id)[0]`). Si el constructor elige otro (por rotación, preferencias o recuperación), el crédito real difiere. El relleno corrige lo que falta, y lo que sobra queda dentro del máximo, pero un músculo puede terminar hasta unas 2 series por encima de su objetivo.
- **Tiempo libre que no se usa.** En el barrido, 219 de 3 696 semanas dejan ≥15 min libres por sesión con algún músculo bajo su objetivo. Casi siempre es porque un máximo semanal lo impide (todos los ejercicios de espalda alta cargan dorsales o trapecios ya en su máximo) o por el tope por sesión en semanas de 1 o 2 días. La auditoría da la causa.
- **Un movimiento por sesión.** Los tres encogimientos comparten movimiento, igual que los dos curls femorales, así que trapecios e isquios no pasan de 4 series por sesión si no hay otro movimiento en el catálogo.
- **Músculo sin ejercicio propio.** En semanas muy cortas (sobre todo de 1 a 3 días de 45 a 60 min con muchos músculos) no cabe un ejercicio para cada músculo elegido sin bajar a otros de su mínimo. La auditoría lo avisa (`no-direct-work`).
- **Días que se juntan.** Con poco volumen (por ejemplo, principiante), un día de menos de 6 series propias se junta con otro, y la semana puede tener menos sesiones de las pedidas. Era la regla de antes; ahora pasa más porque el crédito se cuenta bien.
- **Carga axial.** Es una lista corta de ejercicios con nombre, no una medida. No distingue cargas, ni rangos de repeticiones, ni el remo con apoyo del remo libre más allá de esa lista.

## Descargas y progresión (nota; no implementado)

El plan es de una semana. Descargas, progresión de cargas y mesociclos quedan fuera a propósito, porque requieren el registro de entrenamiento (`log.js`) con pantalla y una regla de progresión con fuente. Cuando existan, lo razonable sería: subir series o carga según el cumplimiento y las repeticiones en reserva registradas, y una semana más ligera cada cierto tiempo o cuando el rendimiento cae. Hoy nada de eso tiene respaldo suficiente en el proyecto para fijar números.

## Hallazgos de la prueba de sensibilidad

- **Meta rebasada:** en intermedio, 3 días de 60 min, cuerpo completo, con cuádriceps y glúteos en Foco, el plan da 17 series de Foco contra una meta de 7 tras el ajuste de tiempo. Hipótesis sin confirmar: el piso de series por sesión (`MIN_SESSION_SETS = 6`), el mínimo de series por ejercicio, o el consolidado de sesiones pequeñas. Se investiga en una rama aparte; la auditoría no debe mostrar una meta que el plan no respeta sin explicar por qué.
- **Tiempo antes que experiencia:** a 4 días de 60 min, intermedio y avanzado daban el mismo plan. `minutesPerSet` ya no decide la semana (apartado 4 de `algorithm.md`); falta repetir esta comparación con el planificador nuevo.
- **Principiante, cuerpo completo, 60 min:** con 16 músculos elegidos, 9 quedan bajo su mínimo. La auditoría lo dice; falta revisar si la app aconseja con claridad elegir menos músculos o más tiempo (tema de producto).

## Pendientes fuera de alcance, por riesgo

1. **Nutrición:** el gasto calórico se estima sin estatura, edad ni sexo, y el piso de 1 200 kcal es fijo. Falta una fórmula de gasto basal con fuente y un piso que dependa de la persona (etiqueta `safety`).
2. **Selección de ejercicios:** los niveles son la opinión de un solo entrenador y cubren 7 grupos. Pasar a criterios explícitos y dejar las listas como desempate.
3. **Datos del usuario:** lesiones y equipo disponible; después edad y sexo; después sueño y estrés.
4. **Revisión humana** de los 67 metadatos de ejercicio (`review: "pending"`) y de los rangos de los músculos menos estudiados, por un entrenador o fisioterapeuta.
5. **Población objetivo:** la figura es solo masculina y la mayoría de la evidencia es de hombres jóvenes.
6. **Registro de entrenamiento con pantalla**, para cerrar el ciclo de retroalimentación.
7. **Seguridad del producto:** avisos de que todo es estimación, límites a déficits agresivos y señal de "consulta a un profesional".
8. **Sensibilidad del resto de parámetros** (factores `f`, pesos de `SCORE`, `maxAxialPerSession`).
