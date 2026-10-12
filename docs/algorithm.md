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
6. Rellenar el tiempo que sobra, solo hasta el objetivo de cada músculo.
7. En qué orden se hacen y con cuánto esfuerzo.
8. Qué frase explica cada decisión.

Los pasos 1 a 3 viven en `estimate.js` y `distribution.js`. El 4, en `scheduler.js`. Los pasos 5 a 7, en `workouts.js`. El 8, en `explain.js`. La forma de contar series y minutos, común a todos, vive en `volume.js` (apartado 3b).

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

## 3b. Una sola contabilidad (`js/volume.js`)

**Serie contada.** Es la unidad de volumen en todo el planificador. Para un músculo, cada serie de un ejercicio vale:

- 1 si el músculo es primario del ejercicio (la sentadilla cuenta 1 para cuádriceps y 1 para glúteos);
- `WORKOUT.secondaryCredit` (0.5) si solo ayuda (la sentadilla cuenta 0.5 para aductores);
- 0 en otro caso.

En series contadas se expresan los objetivos semanales, los rangos y máximos, el tope por sesión, `weeklyVolume()` y la auditoría. Lo usan `fitToTime`, `planDistribution`, `WorkoutBuilder`, `weeklyVolume` y `audit`, y ninguno cuenta de otra manera.

**Serie hecha.** El tiempo se mide en series hechas: una serie de sentadilla tarda lo mismo aunque cuente para tres músculos.

**Series propias.** Antes de elegir ejercicios, el plan estima cuántas series *propias* necesita cada músculo: su objetivo en series contadas menos el crédito que le darán los ejercicios esperados de los otros músculos elegidos, sin bajar de 2 (`plannedWork`, `ownSets`). Los ejercicios esperados de un músculo son los primeros de su lista, uno por movimiento, uno por cada 3 series que una sesión le daría (hasta 8): 16 series de pecho no son 16 de press en máquina, sino ese press, una apertura y un press inclinado, y solo dos de los tres le dan crédito al tríceps (`leadInfo`). Ese crédito se descuenta una sola vez, al planear. El reparto en días trabaja con series propias y el constructor de sesiones no vuelve a restar el crédito. Antes se restaba dos veces (en el presupuesto de tiempo no se contaba y en la dosis sí), y por eso las sesiones quedaban cortas.

**Crédito de los compuestos.** Un estudio de 9 semanas (Plotkin y otros, 2023) encontró que la sentadilla hace crecer el glúteo mayor tanto como el hip thrust, además de más cuádriceps y aductores, y casi nada los isquios. Eso respalda contar la sentadilla como serie completa para glúteos, como hace el catálogo. Es un solo estudio con personas sin experiencia, así que la certeza es baja.

## 4. Cuánto tarda una serie, y si cabe la semana

El tiempo de una serie no es solo el descanso. ATLAS suma:

- 0.75 min de trabajo (unas diez repeticiones controladas y ponerse bajo el peso);
- descanso de 3 min tras un compuesto o 2.5 min tras un aislado (el rango que se usa en la práctica, de 2.5 a 3; la investigación no ve beneficio claro pasados 60 a 90 segundos, así que es por rendimiento y duración realista, no una exigencia);
- 2 min de preparación por ejercicio (ir por las mancuernas, acomodarse, ajustar el spot);
- 10 min de calentamiento por sesión.

Para planear, cada serie propia de un músculo cuesta el promedio de sus ejercicios esperados: 3.75 min por serie en un compuesto o 3.25 en un aislado, más un tercio de la preparación (`plannedSetMinutes`). Son las mismas piezas con las que se cronometra la sesión terminada, así que lo presupuestado y lo cronometrado coinciden. El promedio de 4.2 min por serie (`minutesPerSet`) ya solo lo usan la estimación aproximada de la etapa Targets y la nutrición, que no conocen los ejercicios.

Los descansos de 3 y 2.5 min son una decisión del dueño del proyecto (rendimiento y duración realista), no una exigencia de la evidencia, y no se cambiaron.

**Capacidad semanal** = sesiones × (duración − 10 min de calentamiento). Con 3 sesiones de 60 min son 150 min.

Si las series propias no caben, `fitToTime` recorta de a una serie contada:

1. Primero a los músculos Normal, luego a los de Foco, siempre al que tiene más margen sobre su mínimo, sin bajar de su mínimo habitual (el extremo bajo del rango). Cada paso vuelve a empezar por los Normal, porque bajar uno de Foco puede quitarle crédito a uno Normal.
2. Solo se quita una serie si ahorra tiempo. Bajar un músculo que ya está cubierto por el crédito de otros no ahorra nada. Bajar uno cuyo ejercicio principal cubre a otro (los remos de dorsales cubren espalda alta) baja también a ese otro, si es de igual o menor prioridad, para que el ahorro sea real.
3. Si ni así cabe, baja por debajo del mínimo: primero Mantener, luego Normal, luego Foco, nunca por debajo de 2 series. La pantalla lo avisa.
4. Calcula qué lo arreglaría: un día más, o sesiones más largas.

Este recorte es una estimación hecha antes de elegir ejercicios. La verdad es la semana terminada: si sobra tiempo, el paso de relleno (apartado 7b) devuelve lo recortado, y la auditoría y las explicaciones hablan de la semana final, no de la estimación.

## 5. Cuántas veces entrena cada músculo y en qué días

`planDistribution` trabaja con posiciones de la semana (0 es el primer día de entrenamiento), no con días reales, y reparte las series propias de cada músculo (apartado 3b). Aplica estas reglas en orden:

**Frecuencia.** Cada músculo entrena las veces que haga falta para que ninguna sesión pase de 8 series contadas de ese músculo, sin superar los días disponibles, lo que permite su recuperación, ni tantas veces que una sesión se quede sin un ejercicio propio. La evidencia dice que, con el mismo volumen, entrenar una, dos o tres veces por semana da resultados parecidos (certeza media). Por eso esto es una forma de repartir el volumen, no un hallazgo.

**Días de sobra.** Si algún día queda vacío, un músculo gana una sesión más: primero los de Foco, luego los Normal, mientras cada sesión conserve al menos 4 series de ese músculo (dos ejercicios). Los de Mantener nunca ganan frecuencia.

**Colocación.** Los músculos se colocan de uno en uno, Foco primero y los más grandes primero, en el patrón de días que, por orden de importancia:

1. mantenga cada día dentro del tiempo de trabajo de una sesión;
2. cargue el músculo, y los que su ejercicio principal también entrena, en el menor número de días (glúteos el mismo día que la sentadilla de cuádriceps o el peso muerto rumano de isquios);
3. reparta las sesiones del músculo de forma pareja en la semana;
4. coincida con músculos de la misma familia (empuje, tirón, piernas, core), por ejemplo pecho con tríceps;
5. deje más ligero el día más cargado;
6. quede primero en el orden de la semana.

**Reagrupar.** Como los músculos se colocan de uno en uno, los glúteos pueden caer en días propios antes de que lleguen cuádriceps e isquios, y terminar cargados cuatro días, que la recuperación no puede espaciar. Después de colocar, un músculo que entrena una vez se mueve a otro día, o se intercambia con otro, mientras eso junte músculos que se cargan juntos y ningún día pase su tiempo.

**Equilibrio.** Si el día más pesado supera al más ligero por más de 4 series, un músculo que entrena una sola vez pasa del pesado al ligero, o se intercambia por uno menor, siempre que eso baje el día más pesado y no separe músculos que se cargan juntos. Con una diferencia menor se respeta la familia.

**Sesiones demasiado cortas.** Un día con menos de 6 series propias se reparte en los demás, si todos sus músculos caben dejando un 10 % de la sesión libre (`FOLD_MARGIN`, porque la duración del día es una estimación), y solo cuando la semana tiene tiempo de sobra (si hubo que recortar objetivos, se necesitan todos los días). Un músculo que entrenaba varias veces pierde una sesión. Por eso, por ejemplo, un principiante con pecho y tríceps en 2 días de 60 min recibe una sola sesión de unos 53 min: el crédito del press al tríceps hace que todo quepa en un día.

**Días sobrecargados.** Si un día aún supera lo que cabe en una sesión, pierde series propias, una a una: primero de los músculos Normal, luego de los de Foco, y dentro de cada grupo del que más tiene ese día, sin bajarlo de su mínimo habitual. Un día en que no cayó nada es día de descanso.

## 6. Días y horas reales

El planificador del calendario (`scheduler.js`) coloca las sesiones en días y horas libres. La regla dura es la recuperación: un músculo no vuelve a entrenarse antes de que pasen sus días de descanso (1 o 2, según la tabla del apartado 3). La evidencia sobre esto es baja: el tren inferior suele necesitar de 48 a 72 horas y el superior 24 horas o menos. Entre las opciones válidas elige por la ventana horaria preferida y evitando días muy cargados o sin margen antes y después.

## 7. Qué ejercicios lleva cada sesión

`WorkoutBuilder` recorre los músculos de la sesión, de los más grandes a los más pequeños, para que los compuestos den crédito a los pequeños. Para cada uno:

**Dosis.** En un día planeado por el reparto, da las series propias que planeó (el crédito esperado ya se descontó al planear; no se resta otra vez). En un split elegido por el usuario apunta al medio del rango, menos el crédito de la sesión. Con estos topes:

- no más de 8 series contadas de un músculo en una sesión (directas más el crédito de las de ayuda);
- no pasar su máximo semanal contando también lo que otros ejercicios le dan;
- las series donde el músculo solo ayuda cuentan la mitad (heurística; según el resumen publicado del metaanálisis de Pelland, el conteo de 0.5 predijo mejor que 1 o 0);
- al menos 2 series directas si el músculo entra en la sesión.

Los músculos se recorren del más grande al más chico y, a igual tamaño, en orden alfabético, el mismo orden con el que se estimó el crédito, para que los dorsales elijan su remo antes que la espalda alta.

**Cuántos ejercicios.** Unas 3 series por ejercicio, hasta 4 como máximo; con más series se añade otro ejercicio.

**Qué ejercicio.** Para cada hueco elige el mejor candidato que no repita ejercicio ni movimiento, ordenando por:

1. nivel (S+, S, A+, A, sin nivel), contando con estos descensos de un nivel:
   - uno si ya se usó para ese músculo esa semana (así rotan las alternativas del mismo nivel);
   - uno si además trabaja a otro músculo que se entrena otro día (no entrenarlo sin querer el día anterior);
   - uno si cansa a otro ejercicio de la sesión y este lo cansa a él (se estorban mutuamente);
   - dos si el usuario dijo que no le gusta;
   - dos si es un ejercicio de carga axial alta (sentadilla libre, peso muerto rumano, remo Pendlay) y la sesión ya tiene dos, o el día anterior o siguiente tiene uno;
   - muchos, si lo dejaría pasado de su máximo semanal;
2. cuántos de los otros músculos de la sesión también trabaja;
3. el orden de la lista.

Un ejercicio que el usuario marcó como "no puedo" no se elige nunca.

**Ajuste final.** Si una sesión cronometrada se pasa de su duración, se quitan series de los ejercicios más grandes, empezando por los últimos músculos, y solo después se quita algún ejercicio. Un músculo sin sitio queda anotado como "omitido" y se le avisa al usuario.

## 7b. Rellenar el tiempo, sin pasarse

Cuando todas las sesiones están armadas, dos pasadas más usan la semana completa:

**Un ejercicio propio para cada músculo elegido.** Aunque los compuestos ya le den crédito, cada músculo que el usuario eligió recibe al menos un ejercicio propio de 2 series a la semana: en sus sesiones o en otra de su familia. Si su máximo semanal no deja sitio, un ejercicio de otro músculo que le da crédito se cambia por una variante que no se lo da (por ejemplo, el encogimiento con mancuernas, que carga antebrazos, por el de polea). Si ninguna sesión tiene tiempo, sus sesiones ceden series de músculos que están por encima de su mínimo. Si aun así no cabe, la auditoría lo dice ("no-direct-work").

**Relleno hasta el objetivo.** El tiempo que sobra va a los músculos que siguen por debajo del objetivo que piden su experiencia y prioridad (antes del recorte por tiempo), y a nada más: primero Foco, luego Normal, luego Mantener, y dentro de cada uno al que está más lejos. Cada paso es el más barato que ayuda: una serie más en uno de sus ejercicios (hasta 3), un ejercicio nuevo, y luego una serie más hasta 4. Se respetan todos los topes de la primera pasada, ahora como límites duros: duración, máximo semanal de cada músculo que la serie toca, tope por sesión, recuperación y carga axial.

Si los músculos de una sesión ya llegaron a su objetivo, la sesión termina antes y lo dice ("termina unos N min antes"). Añadir series por encima del objetivo tiende a sumar fatiga más rápido que crecimiento, y el criterio es el volumen útil, no los minutos. Esta política es una preferencia del dueño del proyecto. Un músculo que queda corto queda anotado con el límite que lo frenó (`shortfalls`), y la auditoría lo usa como causa.

## 8. Orden dentro de la sesión y esfuerzo

El orden aplica tres reglas, cada una solo desempata lo que dejó la anterior:

1. **Un ejercicio va antes que los que entrenan sus músculos ayudantes.** El press de pecho trabaja el tríceps como ayudante, así que va antes que la extensión de tríceps. Así el tríceps no llega cansado al press y el press no depende de la fatiga de otro ejercicio.
2. **Los músculos de Foco van primero, los de Mantener al final.**
3. **Los compuestos antes que los aislados (y, entre compuestos, los de carga axial alta primero, mientras la espalda baja está fresca), luego el mejor nivel, luego el orden en que se eligieron.**

Si dos ejercicios se cansan mutuamente, ninguno puede ir primero sin estorbar al otro. Por eso al elegirlos se evita juntarlos y, si no hay otra opción, se mantiene el orden de elección. Si un músculo es de Foco pero otro ejercicio lo cansa como ayudante, gana la dependencia.

**Esfuerzo.** Cada serie de un compuesto se detiene dejando 1 a 2 repeticiones en reserva; en un aislado, 0 a 1, y la última serie puede llegar al fallo. La investigación asocia las series más cercanas al fallo con más crecimiento, pero con certeza baja, y también con más tiempo de recuperación. Los valores son heurísticas, no cifras de un estudio. Repeticiones: 6 a 10 en compuestos y 10 a 15 en aislados.

## 9. Las explicaciones

`explain.js` genera una frase corta por decisión, a partir de los números reales del plan, así que nunca puede contradecirlo. Dice qué se hizo y por qué, sin prometer resultados, con "suele" o "tiende a" donde la evidencia es débil. Va plegada bajo "Why this week" y "Why this session". Cubre la experiencia, el volumen de cada músculo de Foco, los músculos en Mantener, si la semana no cabe (según la semana final, no la estimación previa), a qué músculos fue el tiempo sobrante, por qué va primero el primer ejercicio, el nivel de los ejercicios, el esfuerzo, las series del día frente a las de la semana, por qué un músculo se reparte en varias sesiones y por qué una sesión termina 10 min o más antes de su duración.

## 10. De dónde vienen los niveles de ejercicios

Las listas de nivel (S+, S, A+, A) de pecho, tríceps, espalda, hombros, cuádriceps, bíceps y glúteos coinciden con las listas de Jeff Nippard. Son la opinión de un solo entrenador: ordenan ejercicios, no miden cuánto músculo da cada uno. Trapecios, antebrazos, isquiotibiales, aductores, pantorrillas, abdomen, oblicuos y lumbar no tienen lista; sus ejercicios se ofrecen sin nivel, después de los que sí lo tienen. Detalles en `docs/tier-list-sources.md`.

## 11. Registro de series y ejercicios descartados

Sin pantalla todavía, `js/log.js` define lo que se guardará: por serie la carga, las repeticiones, las repeticiones en reserva, la dificultad y si se hizo; por sesión la fecha y el cumplimiento (series hechas entre series planeadas). Los ejercicios descartados guardan el motivo: "no me gusta" solo los baja de prioridad y "no puedo" los saca de la selección hasta que el usuario los reactive. Todo se guarda con el plan, y un guardado viejo o dañado se restaura sin romperse.

## 12. Qué no hace

- No promete resultados. El avance de cada persona depende del sueño, la comida, la historia de entrenamiento y la genética, que la app no conoce.
- No ajusta la semana según lo que se registró; eso es de versiones futuras.
- No elige ejercicios por equipo disponible ni lesiones; eso es de la V2. La fatiga solo se trata con la categoría de carga axial y las reglas de recuperación, no con un puntaje.
- Los tiempos por serie, los descansos, la tabla de fracciones, los rangos de series y los descensos por nivel son heurísticas razonables, no mediciones.

## 13. Dónde está cada cosa

| Tema | Archivo |
|---|---|
| Etiquetas de origen, evidencia y valores ajustables | `js/evidence.js` |
| Serie contada, minutos por serie, series propias, carga axial | `js/volume.js` |
| Objetivo semanal y ajuste al tiempo | `js/estimate.js` |
| Frecuencia, días y equilibrio | `js/distribution.js` |
| Días y horas reales, recuperación | `js/scheduler.js` |
| Ejercicios, orden, esfuerzo y relleno | `js/workouts.js` |
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

## Exercise metadata and selection by function

`js/exercise-meta.js` adds to each exercise that works chest, shoulders, upper back, traps, lats or glutes: an **action** (the joint action: hip-extension, knee-dominant, shoulder-abduction, horizontal-abduction, overhead-press, horizontal-row, face-pull...), the **regions** of each muscle it loads most (shoulders: anterior/lateral/posterior; chest: clavicular/sternal; glutes: maximus/medius; upper back: retractors/external-rotators; traps: upper/middle/lower), a **confidence** (`anatomy` follows from the joint action; `convention` is the usual coaching classification with mixed EMG evidence; `uncertain` is unsettled and must carry a note), and `review: "pending"`. The classification is the author's reading of functional anatomy, not a citation per exercise; every entry stays "pending" until someone checks it against sources. Deliberately not recorded: muscle-length claims and any stimulus or fatigue score.

Two exercises are the **same job** for a muscle when they share the action and, if both name a part of that muscle, a part in common (`Exercise.sameJobAs`). Candidates are ranked by tier plus separate, named penalties (`repeat`, `interference`, `dislike`, `recovery`, `same-job`, `weekly-maximum`), kept on `entry.penalties`. `same-job` (`functionRepeatDemotion`, heuristic, 2 tier steps) applies when the session already has that job for the muscle. For a Focus muscle the tie-break "works more of the day's other muscles" is dropped because it favoured broader, less specific lifts. "Cannot" is never chosen; "dislike" is its own penalty. Tiers remain a general preference signal, not a measure of fit for one region.

The audit adds `regions` to each row: parts trained directly, parts only assisted, parts missing, and parts no catalogue exercise trains directly (`unreachable`, never blamed on the plan). For a Focus muscle the week explanation says which part no exercise reached.

Limits: the lats have no regions; "upper back" is two functional groups, not anatomical heads; the catalogue has no direct front-delt or lower-trap exercise, so those parts show as assisted-only or unreachable. Whether hip thrust appears for Focus glutes is still decided by tier, since the tiers are the only quality signal.

## Volumen: fuentes, unidades y tope por sesión

**Unidades.** Todo el volumen se cuenta en *series contadas* (apartado 3b, `js/volume.js`): cada serie vale 1 para los músculos primarios del ejercicio y `WORKOUT.secondaryCredit` (0.5) para los que solo ayudan. Todas las etapas usan esa misma función. `distribution.js` reparte series propias, es decir, el objetivo contado menos el crédito esperado, descontado una sola vez. Un ejercicio con varios músculos primarios (la sentadilla para cuádriceps y glúteos) cuenta una serie completa para cada uno; Plotkin 2023 respalda ese conteo para los glúteos.

**Qué respalda cada parámetro** (detalle y estado de verificación en `docs/volume-sources.md`):

| Parámetro | Origen | Estado |
|---|---|---|
| Forma de la curva semanal (más series ayudan, con rendimientos decrecientes) | evidencia | respaldada; las cifras de la versión publicada de Pelland están pendientes de verificar (V1) |
| `secondaryCredit` = 0.5 | heurística | la fuente publicada que lo respalda solo se leyó en su resumen (V1 parcial); la revisión de 2019 trata otra pregunta y no lo contradice (V4 cerrada); pasará a evidencia al cerrar V1 |
| `maxSetsPerSession` = 8 | heurística | la ficha `per-session-volume` es un preprint (≈11 series fraccionales sin ventaja detectable); 8 queda dentro del rango 6 a 11, del lado conservador. Ahora se aplica en series contadas en todas las etapas. No se cambió: con el relleno y el nuevo reparto, el tope solo frena en semanas de 1 o 2 días |
| `maxAxialPerSession` = 2, `axialDemotion` = 2 | heurística | Belcher 2019 (12 hombres entrenados) no encontró recuperación más lenta tras el peso muerto que tras la sentadilla o el press de banca. El límite es una precaución práctica ante la carga lumbar acumulada, no una cifra de estudio |
| Rangos semanales por músculo y factores `f` por experiencia | heurística | la forma está respaldada, los números son extrapolaciones; músculos poco estudiados (trapecios, antebrazos, aductores, lumbar) son los menos fiables |
| `indirectRecoveryFraction` = 0.5 | heurística | es una fracción de recuperación entre sesiones, no de conteo de series; la evidencia de volumen no la respalda |

**Prueba de sensibilidad del tope por sesión** (`tools/sensitivity/per-session-cap.mjs`, resultados en `docs/sensitivity/`). Se corrió la lógica real con tope 8, 10 y 11 en 11 perfiles sintéticos. Sin efecto en 6; en 3 mejora el Foco entre 1 y 3 series a cambio de 4 a 16 minutos más por sesión (dos veces llega al límite de 90 min); en uno quita volumen a otros músculos. Se conserva 8. Con 11 perfiles no se demuestra que 8 sea el valor correcto, solo que 10 u 11 no es claramente mejor. Un tope variable para el Foco no se implementa.

**Sensibilidad del plan al tiempo.** En 4 días de 60 min, intermedio y avanzado dan el mismo plan: cuando el tiempo manda, el ajuste de tiempo domina y los factores `f` no alcanzan a diferenciar. El parámetro que más decide en esos perfiles es `minutesPerSet` (4.2), no los factores por experiencia.
