# Límites conocidos y pendientes

Estado a 2026-10-10. Lo que sigue no es un error escondido: es lo que el plan o la evidencia todavía no resuelven.

## Del volumen

- **El 0.5 de las series indirectas es plano** para cualquier ejercicio y músculo. Graduarlo queda pendiente por falta de datos que lo respalden, y su respaldo publicado aún no está verificado (V1, V4 en `docs/volume-sources.md`).
- **Un ejercicio con varios músculos primarios cuenta serie completa para cada uno** (la sentadilla para cuádriceps y glúteos). Puede inflar el volumen total. Prioridad baja.
- **La evidencia de volumen viene sobre todo de músculos grandes** y de poblaciones específicas (hombres jóvenes en su mayoría). Los rangos de trapecios, antebrazos, aductores y lumbar son extrapolaciones.
- **El tope de 8 series fraccionales por sesión** es una decisión con evidencia parcial (preprint). La prueba con 11 perfiles no demuestra que 8 sea el valor correcto; ver `docs/sensitivity/per-session-cap.md`.

## Hallazgos de la prueba de sensibilidad

- **Meta rebasada:** en intermedio, 3 días de 60 min, cuerpo completo, con cuádriceps y glúteos en Foco, el plan da 17 series de Foco contra una meta de 7 tras el ajuste de tiempo. Hipótesis sin confirmar: el piso de series por sesión (`MIN_SESSION_SETS = 6`), el mínimo de series por ejercicio, o el consolidado de sesiones pequeñas. Se investiga en una rama aparte; la auditoría no debe mostrar una meta que el plan no respeta sin explicar por qué.
- **Tiempo antes que experiencia:** a 4 días de 60 min, intermedio y avanzado dan el mismo plan. Investigar `minutesPerSet` rinde más que investigar los factores `f`.
- **Principiante, cuerpo completo, 60 min:** con 16 músculos elegidos, 9 quedan bajo su mínimo. La auditoría lo dice; falta revisar si la app aconseja con claridad elegir menos músculos o más tiempo (tema de producto).

## Pendientes fuera de alcance, por riesgo

1. **Nutrición:** el gasto calórico se estima sin estatura, edad ni sexo, y el piso de 1 200 kcal es fijo. Falta una fórmula de gasto basal con fuente y un piso que dependa de la persona (etiqueta `safety`).
2. **Selección de ejercicios:** los niveles son la opinión de un solo entrenador y cubren 7 grupos. Pasar a criterios explícitos y dejar las listas como desempate.
3. **Datos del usuario:** lesiones y equipo disponible; después edad y sexo; después sueño y estrés.
4. **Revisión humana** de los 67 metadatos de ejercicio (`review: "pending"`) y de los rangos de los músculos menos estudiados, por un entrenador o fisioterapeuta.
5. **Población objetivo:** la figura es solo masculina y la mayoría de la evidencia es de hombres jóvenes.
6. **Registro de entrenamiento con pantalla**, para cerrar el ciclo de retroalimentación.
7. **Seguridad del producto:** avisos de que todo es estimación, límites a déficits agresivos y señal de "consulta a un profesional".
8. **Sensibilidad del resto de parámetros** (`minutesPerSet`, factores `f`, pesos de `SCORE`).
