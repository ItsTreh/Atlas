# Rediseño del planificador: una sola contabilidad y relleno hasta el objetivo

Estado a 2026-10-11, rama `atlas-planner-time-fill`. Lo que cambió está descrito en `docs/algorithm.md` (apartados 3b, 4, 5, 7 y 7b). Este documento guarda las mediciones.

## Cómo se midió

- **Caso de referencia:** 13 músculos (hombros, tríceps, trapecios, espalda alta, dorsales, bíceps, antebrazos, cuádriceps, isquios, glúteos, aductores, pantorrillas, lumbar), intermedio, 4 días de 90 min, todo en Normal, ventana de tarde.
- **Barrido:** `tools/sensitivity/planner-sweep.mjs`, con 3 696 semanas: 11 selecciones (la de referencia y los 10 programas) × 1 a 7 días × 45/60/75/90 min × 3 experiencias × 4 prioridades (todo Mantener, todo Normal, todo Foco, y mixto: los dos primeros músculos en Foco y los dos últimos en Mantener).
- **Antes:** el código de `HEAD` antes del cambio (`65725b7`), extraído con `git archive`. **Después:** la rama.
- Tabla completa por grupo: `planner-fill-table.md`. Una fila por semana: `planner-fill.csv`.

## Caso de referencia

| | Antes | Después |
|---|---|---|
| Minutos por sesión | 59 · 57 · 62 · 76 | 89 · 70 · 75 · 85 |
| Uso del tiempo | 70.6 % | **88.6 %** |
| Series hechas en la semana | 52 | 67 |
| Ejercicios por sesión | 4 · 4 · 4 · 6 | 6 · 5 · 6 · 6 |
| Recorte por tiempo (`fitToTime`) | de 102 a 76 series | ninguno (cabe) |
| Series "perdidas" por `covered` | 19 | 0 (el crédito se descuenta una sola vez) |
| Días | tirón · piernas · tirón · piernas+hombros+tríceps | piernas · piernas+hombros · tirón · tirón+tríceps |

Ninguna sesión pasa de 90 min. El día de piernas que queda en 5 ejercicios (70 min) lo explica: isquios no puede recibir más sin pasar el máximo semanal de glúteos (el peso muerto rumano los carga) ni repetir el movimiento del curl femoral. Los demás músculos de ese día ya están en su objetivo.

## Barrido completo (antes → después)

| Métrica | Antes | Después |
|---|---|---|
| Uso del tiempo (media) | 69.5 % | 76.4 % |
| Uso del tiempo (percentil 10) | 51.7 % | 54.4 % |
| Semanas con ≥15 min libres por sesión y algún músculo bajo su objetivo | 1 043 | 219 |
| Sesiones que pasan su duración | 0 | 0 |
| Semanas con algún músculo sobre su máximo (con crédito) | 7 (hasta +1.5) | **0** |
| Pares músculo-semana dentro de su rango | 75.8 % | 82.2 % |
| Pares músculo-semana bajo su mínimo | 24.2 % | 17.8 % |
| Pares músculo-semana en su objetivo (experiencia y prioridad) | 54.6 % | 65.9 % |
| Semanas con algún músculo elegido sin ejercicio propio | 740 | 513 |
| …de esas, sin aviso de la auditoría | 568 | **0** |
| Semanas en que `fitToTime` recorta | 1 513 | 1 092 |
| Sesiones colocadas en total | 10 600 | 10 121 |

**Por qué el uso medio no llega al 88 % en todo el barrido.** La meta es el volumen útil, no los minutos (preferencia del dueño del proyecto): una sesión cuyos músculos ya llegaron a su objetivo termina antes. En selecciones pequeñas (pecho y tríceps, núcleo, hombros y brazos) el objetivo se cumple con sesiones de 40 a 60 min, y eso es lo esperado. Las 219 semanas que aún dejan tiempo libre con algún músculo bajo su objetivo quedan así por un máximo semanal (302 casos: todo ejercicio de espalda alta carga dorsales o trapecios que ya están en su máximo), por el tope de 8 series por sesión en semanas de 1 o 2 días (22), o porque no queda un movimiento distinto (2).

**Menos sesiones.** 560 semanas tienen menos sesiones que antes y 124 tienen más. En 406 de esas 560, todos los músculos están en su objetivo: el volumen pedido cabe en menos días, porque el crédito ya no se cuenta de más. En las otras 154, la falta es de 1 serie o menos en 136 de ellas. Esto sale de la regla que ya existía (un día de menos de 6 series propias se junta con otro) y de que la frecuencia ya no reparte un músculo cubierto en sesiones de 1 serie.

**Músculo sin ejercicio propio.** Los 513 casos que quedan son todos semanas de 1 a 5 días con sesiones de 45 a 60 min (y algunas de 75 a 90 con 1 o 2 días), donde un ejercicio más para cada músculo no cabe sin bajar a otros por debajo de su mínimo. Todas tienen aviso en la auditoría (`no-direct-work` o `below-minimum`).

## Criterios de aceptación

| Criterio | Resultado |
|---|---|
| Referencia ≥ 88 % sin pasar 90 min | 88.6 %; sesiones de 70 a 89 min |
| Día de piernas de 90 min con los 3 grupos grandes: ≥ 6 ejercicios o explicado | se cumple en todo el barrido (test `planner-fill.test.js`); los de menos de 6 dicen "termina unos N min antes" y por qué |
| Ningún músculo sin ejercicio ni bajo su mínimo sin aviso | 0 casos sin aviso |
| Ningún músculo sobre su máximo contando el crédito | 0 casos; el test de barrido ya no tolera +4 |
| Determinismo | mismas entradas, misma semana, también en una copia nueva de la app (test) |
| `npm test` | 469 tests pasan |

## Lo que es evidencia y lo que es diseño

- **Evidencia (certeza baja):** contar 0.5 para las series de ayuda es lo que mejor predijo según el resumen publicado de Pelland 2026 (el texto completo sigue pendiente, V1). Contar la sentadilla como serie completa para glúteos tiene el respaldo de Plotkin 2023. El peso muerto no mostró recuperación más lenta que la sentadilla en Belcher 2019.
- **Diseño:** las series propias y el crédito esperado, la regla de rellenar solo hasta el objetivo, el ejercicio propio para cada músculo elegido, la categoría de carga axial y sus límites (2 por sesión, ninguno en días seguidos), el reagrupado de músculos que un ejercicio carga juntos y el margen de 90 % para juntar días. Cada uno está registrado en `js/evidence.js` con su origen.
