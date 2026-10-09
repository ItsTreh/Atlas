# El algoritmo de ATLAS, paso a paso

Este documento explica cómo ATLAS arma una semana de entrenamiento: qué decide, en qué orden y por qué. Describe lo que está implementado en la primera versión (pasos 0 a 8 del diseño en `docs/atlas-design.md`).

Dos ideas lo recorren de principio a fin:

- **No hay optimizador ni puntajes.** Cada paso es una regla fija que se aplica en orden. Con las mismas entradas siempre sale la misma semana.
- **Cada número tiene una etiqueta de origen.** Un valor puede venir de evidencia, de una heurística, de una preferencia del usuario, de una optimización o de seguridad. Ningún valor se presenta como "ciencia" si no lo es. Todo vive en `js/evidence.js`, y los números que ve el usuario son estimaciones.

## 1. Qué entra y qué sale

**Entradas:** los músculos elegidos, la prioridad de cada uno (Mantener, Normal o Foco), la experiencia (menos de 6 meses, de 6 meses a 2 años, más de 2 años), los días libres de la semana, cuántas sesiones se quieren, cuánto dura cada una (45, 60, 75 o 90 min), la ventana horaria preferida y, si se elige, un split fijo.

**Salida:** una semana con sesiones en días y horas concretos. Cada sesión trae sus ejercicios ordenados, con series, repeticiones, descanso y repeticiones en reserva. Cada decisión trae una frase corta que la explica.

Si no se dice la experiencia, el plan asume la de principiante.

## 2. La cadena completa

1. Cuántas series por semana necesita cada músculo (el objetivo semanal).
2. Si todo cabe en el tiempo disponible; si no, qué se recorta.
3. Cuántas veces entrena cada músculo y en qué días.
4. Qué día y a qué hora cae cada sesión, respetando la recuperación.
5. Qué ejercicios lleva cada sesión y cuántas series.
6. En qué orden se hacen y con cuánto esfuerzo.
7. Qué frase explica cada decisión.

Los pasos 1 a 3 viven en `estimate.js` y `distribution.js`. El 4, en `scheduler.js`. Los pasos 5 y 6, en `workouts.js`. El 7, en `explain.js`.

## 3. Objetivo semanal por músculo

Cada músculo tiene un rango de series duras por semana, tomado como una lectura común de la investigación de volumen. La idea mejor respaldada, con certeza alta, es que más series semanales ayudan pero con rendimientos decrecientes. Los números concretos del rango no salen de un solo estudio.

| Músculo | Rango semanal | Descanso entre sesiones |
|---|---|---|
| Pecho, espalda alta, dorsales, cuádriceps | 8 a 16 series | 2 días |
| Hombros, isquiotibiales, glúteos | 6 a 12 | 2 días |
| Tríceps, bíceps, pantorrillas, abdomen | 4 a 10 | 1 día |
| Trapecios | 4 a 8 | 1 día |
| Antebrazos, aductores, oblicuos | 2 a 6 | 1 día |
| Lumbar | 2 a 6 | 2 días |

El objetivo se coloca dentro del rango según la prioridad y la experiencia:

> objetivo = bajo + f × (alto − bajo), redondeado y siempre dentro del rango

La fracción `f` sale de esta tabla (es una heurística, no un valor de estudio):

| Experiencia | Mantener | Normal | Foco |
|---|---|---|---|
| Principiante | 0 | 0 | 0.5 |
| Intermedio | 0 | 0.5 | 0.8 |
| Avanzado | 0 | 0.5 | 1.0 |

Ejemplo: pecho en Foco con experiencia intermedia es 8 + 0.8 × 8 = 14.4, es decir 14 series por semana. Mantener siempre es el mínimo del rango.

## 4. Cuánto tarda una serie, y si cabe la semana

El tiempo de una serie no es solo el descanso. ATLAS suma:

- 0.75 min de trabajo (unas diez repeticiones controladas y ponerse bajo el peso);
- descanso de 3 min tras un compuesto o 2.5 min tras un aislado (el rango que se usa en la práctica, de 2.5 a 3; la investigación no ve beneficio claro pasados 60 a 90 segundos, así que es por rendimiento y duración realista, no una exigencia);
- 2 min de preparación por ejercicio (ir por las mancuernas, acomodarse, ajustar el spot);
- 10 min de calentamiento por sesión.

Para planear se usa un promedio de 4.2 min por serie. El tiempo real de cada sesión se calcula ejercicio por ejercicio.

**Capacidad semanal** = sesiones × (duración − 10 min de calentamiento). Con 3 sesiones de 60 min son 150 min, unas 35 series.

Si la suma de los objetivos no cabe, `fitToTime` recorta en este orden:

1. Primero a los músculos Normal, luego a los de Foco, de a una serie, siempre al que tiene más margen sobre su mínimo, sin bajar de su mínimo habitual (el extremo bajo del rango).
2. Si ni así cabe, baja por debajo del mínimo: primero Mantener, luego Normal, luego Foco, nunca por debajo de 2 series directas. Así ningún músculo queda sin entrenar. La pantalla lo avisa.
3. Calcula qué lo arreglaría: un día más, o sesiones más largas.

## 5. Cuántas veces entrena cada músculo y en qué días

`planDistribution` trabaja con posiciones de la semana (0 es el primer día de entrenamiento), no con días reales. Aplica estas reglas en orden:

**Frecuencia.** Cada músculo entrena las veces que haga falta para que ninguna sesión pase de 8 series de ese músculo, sin superar los días disponibles ni lo que permite su recuperación. La evidencia dice que, con el mismo volumen, entrenar una, dos o tres veces por semana da resultados parecidos (certeza media). Por eso esto es una forma de repartir el volumen, no un hallazgo.

**Días de sobra.** Si algún día queda vacío, un músculo gana una sesión más: primero los de Foco, luego los Normal, mientras cada sesión conserve al menos 4 series de ese músculo (dos ejercicios). Los de Mantener nunca ganan frecuencia.

**Colocación.** Los músculos se colocan de uno en uno, Foco primero y los más grandes primero, en el patrón de días que, por orden de importancia:

1. mantenga cada día dentro del tiempo de trabajo de una sesión;
2. reparta las sesiones del músculo de forma pareja en la semana;
3. coincida con músculos de la misma familia (empuje, tirón, piernas, core), por ejemplo pecho con tríceps;
4. deje más ligero el día más cargado;
5. quede primero en el orden de la semana.

**Equilibrio.** Si el día más pesado supera al más ligero por más de 4 series (unos 17 min), un músculo que entrena una sola vez pasa del pesado al ligero, o se intercambia por uno menor, siempre que eso baje el día más pesado. Con una diferencia menor se respeta la familia.

**Sesiones demasiado cortas.** Un día con menos de 6 series (unos 35 min con el calentamiento) se reparte en los demás, si todos sus músculos caben. Un músculo que entrenaba varias veces pierde una sesión.

**Días sobrecargados.** Si un día aún supera lo que cabe en una sesión, pierde series, una a una, del músculo que más tiene ese día, sin bajarlo de su mínimo habitual. Un día en que no cayó nada es día de descanso.

## 6. Días y horas reales

El planificador del calendario (`scheduler.js`) coloca las sesiones en días y horas libres. La regla dura es la recuperación: un músculo no vuelve a entrenarse antes de que pasen sus días de descanso (1 o 2, según la tabla del apartado 3). La evidencia sobre esto es baja: el tren inferior suele necesitar de 48 a 72 horas y el superior 24 horas o menos. Entre las opciones válidas elige por la ventana horaria preferida y evitando días muy cargados o sin margen antes y después.

## 7. Qué ejercicios lleva cada sesión

`WorkoutBuilder` recorre los músculos de la sesión, de los más grandes a los más pequeños, para que los compuestos den crédito a los pequeños. Para cada uno:

**Dosis.** Intenta las series que planeó el reparto, menos lo que ya aportan los ejercicios de la sesión, con estos topes:

- no más de 8 series de un músculo en una sesión;
- no pasar su máximo semanal contando también lo que otros ejercicios le dan;
- las series donde el músculo solo ayuda cuentan la mitad (heurística; los estudios dicen que contarlas 1 a 1 distorsiona el volumen);
- al menos 2 series directas si el músculo entra en la sesión.

**Cuántos ejercicios.** Unas 3 series por ejercicio, hasta 4 como máximo; con más series se añade otro ejercicio.

**Qué ejercicio.** Para cada hueco elige el mejor candidato que no repita ejercicio ni movimiento, ordenando por:

1. nivel (S+, S, A+, A, sin nivel), contando con estos descensos de un nivel:
   - uno si ya se usó para ese músculo esa semana (así rotan las alternativas del mismo nivel);
   - uno si además trabaja a otro músculo que se entrena otro día (no entrenarlo sin querer el día anterior);
   - uno si cansa a otro ejercicio de la sesión y este lo cansa a él (se estorban mutuamente);
   - dos si el usuario dijo que no le gusta;
   - muchos, si lo dejaría pasado de su máximo semanal;
2. cuántos de los otros músculos de la sesión también trabaja;
3. el orden de la lista.

Un ejercicio que el usuario marcó como "no puedo" no se elige nunca.

**Ajuste final.** Como el presupuesto usa el promedio de 4.2 min y la sesión real se cronometra por ejercicio, si la sesión se pasa de su duración se quitan series de los ejercicios más grandes, empezando por los últimos músculos, y solo después se quita algún ejercicio. Un músculo sin sitio queda anotado como "omitido" y se le avisa al usuario.

## 8. Orden dentro de la sesión y esfuerzo

El orden aplica tres reglas, cada una solo desempata lo que dejó la anterior:

1. **Un ejercicio va antes que los que entrenan sus músculos ayudantes.** El press de pecho trabaja el tríceps como ayudante, así que va antes que la extensión de tríceps. Así el tríceps no llega cansado al press y el press no depende de la fatiga de otro ejercicio.
2. **Los músculos de Foco van primero, los de Mantener al final.**
3. **Los compuestos antes que los aislados, luego el mejor nivel, luego el orden en que se eligieron.**

Si dos ejercicios se cansan mutuamente, ninguno puede ir primero sin estorbar al otro. Por eso al elegirlos se evita juntarlos y, si no hay otra opción, se mantiene el orden de elección. Si un músculo es de Foco pero otro ejercicio lo cansa como ayudante, gana la dependencia.

**Esfuerzo.** Cada serie de un compuesto se detiene dejando 1 a 2 repeticiones en reserva; en un aislado, 0 a 1, y la última serie puede llegar al fallo. La investigación asocia las series más cercanas al fallo con más crecimiento, pero con certeza baja, y también con más tiempo de recuperación. Los valores son heurísticas, no cifras de un estudio. Repeticiones: 6 a 10 en compuestos y 10 a 15 en aislados.

## 9. Las explicaciones

`explain.js` genera una frase corta por decisión, a partir de los números reales del plan, así que nunca puede contradecirlo. Dice qué se hizo y por qué, sin prometer resultados, con "suele" o "tiende a" donde la evidencia es débil. Va plegada bajo "Why this week" y "Why this session". Cubre la experiencia, el volumen de cada músculo de Foco, los músculos en Mantener, si la semana no cabe, por qué va primero el primer ejercicio, el nivel de los ejercicios, el esfuerzo, las series del día frente a las de la semana y por qué un músculo se reparte en varias sesiones.

## 10. De dónde vienen los niveles de ejercicios

Las listas de nivel (S+, S, A+, A) de pecho, tríceps, espalda, hombros, cuádriceps, bíceps y glúteos coinciden con las listas de Jeff Nippard. Son la opinión de un solo entrenador: ordenan ejercicios, no miden cuánto músculo da cada uno. Trapecios, antebrazos, isquiotibiales, aductores, pantorrillas, abdomen, oblicuos y lumbar no tienen lista; sus ejercicios se ofrecen sin nivel, después de los que sí lo tienen. Detalles en `docs/tier-list-sources.md`.

## 11. Registro de series y ejercicios descartados

Sin pantalla todavía, `js/log.js` define lo que se guardará: por serie la carga, las repeticiones, las repeticiones en reserva, la dificultad y si se hizo; por sesión la fecha y el cumplimiento (series hechas entre series planeadas). Los ejercicios descartados guardan el motivo: "no me gusta" solo los baja de prioridad y "no puedo" los saca de la selección hasta que el usuario los reactive. Todo se guarda con el plan, y un guardado viejo o dañado se restaura sin romperse.

## 12. Qué no hace

- No promete resultados. El avance de cada persona depende del sueño, la comida, la historia de entrenamiento y la genética, que la app no conoce.
- No ajusta la semana según lo que se registró; eso es de versiones futuras.
- No elige ejercicios por equipo disponible, lesiones o fatiga; eso es de la V2.
- Los tiempos por serie, los descansos, la tabla de fracciones, los rangos de series y los descensos por nivel son heurísticas razonables, no mediciones.

## 13. Dónde está cada cosa

| Tema | Archivo |
|---|---|
| Etiquetas de origen, evidencia y valores ajustables | `js/evidence.js` |
| Objetivo semanal y ajuste al tiempo | `js/estimate.js` |
| Frecuencia, días y equilibrio | `js/distribution.js` |
| Días y horas reales, recuperación | `js/scheduler.js` |
| Ejercicios, orden y esfuerzo | `js/workouts.js` |
| Catálogo y listas de nivel | `js/exercises.js` |
| Frases de explicación | `js/explain.js` |
| Registro y descartes | `js/log.js` |
| Pruebas | `tests/` |

## Audit and recovery (added after the V1 audit)

**Volume ledger (`js/audit.js`, `routine.audit()`).** For every muscle the plan reports `targetSets`, `plannedSets`, `finalDirectSets`, `finalIndirectSets`, `finalIndirectCredit` and `finalTotalCredit`. Direct sets and indirect credit are never merged into one unlabelled number. Any gap to the target carries a cause (`time-fit`, `fewer-sessions`, `session-capacity`, `session-time`, `weekly-maximum`, `session-set-limit`, `minimum-exercise`, `no-eligible-exercise`, `user-restriction`, `not-placed`); a gap nobody explains is reported as `unexplained` and a test fails on it. Focus muscles under target and muscles under their minimum are listed in `audit.issues`, which the week explanation prints. `WORKOUT.secondaryCredit` is a heuristic, not a finding.

**Recovery (`js/recovery.js`).** Two sessions that both load a muscle directly need its full `recoveryDays`. If either only assists the muscle (secondary), the gap is `ceil(recoveryDays × indirectRecoveryFraction)` (0.5, a heuristic). Exercise choice avoids breaking this (`recoveryConflict`) and `recoveryCheck` reports any exposure that still does. Tests: Mon shoulders / Tue row / Wed shoulders; Tue back extension / Wed Romanian deadlift.

**Order.** Each exercise records the rule that placed it (`orderRule`: dependency, priority, compound, tier, pick-order, only-option); the session explanation names it, including when a helper lift goes before a Focus muscle's exercise.

**Time message.** The session note states estimated minutes against available minutes and whether anything was cut. It makes no claim about fatigue versus results.

**Known limits.** `session-capacity` trimming can leave a Focus muscle short when many Focus muscles share few consecutive days; the scheduler's predicted exposure (`loadedMuscles`) can make some 5-session weeks infeasible. Both are reported, not hidden. The catalogue has no region/portion metadata, so it cannot tell lateral from rear delts or lats from upper back; this is not yet modelled.
