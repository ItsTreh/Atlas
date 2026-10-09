# ATLAS: evidencia y diseño del planificador

Oct 8, 2026 · @Emiliano

## Objetivo

ATLAS debe armar cada semana con la frecuencia, el volumen y la recuperación mejor respaldados por la evidencia para cada músculo, ajustados al tiempo libre del usuario y a los músculos que quiere desarrollar.

La evidencia manda donde está bien establecida (cuántas veces por semana y cuántas series por músculo) y el usuario manda donde no se puede forzar (qué días y a qué hora puede entrenar). Donde la ciencia no es clara, el algoritmo usa valores intermedios y lo dice.

Lo que no promete: un físico concreto en una fecha. Los estudios describen promedios de grupos, y el resultado de una persona depende además del sueño, la alimentación, el historial de entrenamiento y la genética, que la app no conoce. Todo número que muestre sigue siendo una estimación con su explicación, como ya exige `CLAUDE.md`.

## Evidencia

La evidencia respalda con confianza una sola idea: más series semanales por músculo ayudan, con rendimientos decrecientes. En frecuencia, descanso, cercanía al fallo y rango de movimiento el respaldo es más débil. Casi todos los estudios duran semanas y pocos incluyen personas muy entrenadas, así que ningún número de abajo es una ley.

| Variable | Qué dice la evidencia | Certeza (mi lectura) | Fuente |
| --- | --- | --- | --- |
| Volumen semanal por músculo | Crecimiento gradual con las series: menos de 5 series/semana ≈ 5.4 %, 5 a 9 ≈ 6.6 %, 10 o más ≈ 9.8 %. Pocos estudios pasaron de 12 series y solo 2 eran de personas entrenadas. Un meta-análisis más reciente (67 estudios, 2058 personas) confirma la tendencia con rendimientos decrecientes, sin dar un tope. | Alta en la dirección, baja en el número exacto | [Schoenfeld, Ogborn y Krieger 2016](https://paulogentil.com/pdf/Dose-response%20relationship%20between%20weekly%20resistance%20training%20volume%20and%20increases%20in%20muscle%20mass%20-%20A%20systematic%20review%20and%20metaanalysis.pdf); [Pelland et al. 2024](https://sportrxiv.org/index.php/server/preprint/view/460) (preprint, sin revisión por pares en la página) |
| Frecuencia por músculo | Con el volumen igualado, entrenar un músculo 1, 2 o 3 veces por semana da resultados parecidos. Un ensayo de 2 vs 4 sesiones semanales no halló diferencias (21 personas, poca potencia). El efecto de la frecuencia es compatible con ser despreciable. | Media | [Grgic, Schoenfeld y Latella 2019](https://ro.ecu.edu.au/ecuworkspost2013/5665); [Hamarsland et al. 2022](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2021.789403/pdf); [Pelland et al. 2024](https://sportrxiv.org/index.php/server/preprint/view/460) |
| Cercanía al fallo | Cuanto más cerca del fallo (menos repeticiones en reserva), más hipertrofia; en fuerza la relación es despreciable. Análisis exploratorio, con las repeticiones en reserva estimadas a partir de las descripciones de cada estudio. | Media a baja | [Robinson et al. 2024](https://rke.abertay.ac.uk/en/publications/exploring-the-dose-response-relationship-between-estimated-resist/) |
| Descanso entre series | Descansar más de 60 s da un beneficio pequeño y no hay diferencias apreciables después de 90 s. Los intervalos de credibilidad de las comparaciones controladas cruzan el cero. | Baja | [Singer et al. 2024](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1429789/text) |
| Rango de movimiento | Diferencias de triviales a pequeñas. El rango completo o largo puede dar algo más; los parciales con el músculo estirado muestran un posible beneficio, pero solo en un análisis exploratorio con intervalo que incluye el cero. | Baja | [Wolf et al. 2023](https://doaj.org/article/99e86b317bec40f5abc2f0008358737e) |
| Recuperación entre sesiones del mismo músculo | El tren inferior suele necesitar 48 a 72 h y el superior 24 h o menos. El fallo, el volumen alto y los ejercicios multiarticulares alargan la recuperación. Los autores dicen que la literatura todavía no permite prescribir con confianza. | Baja a media | [Sousa et al. 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11057610) (revisión narrativa de 24 estudios) |
| Cómo contar las series de ejercicios multiarticulares | Una sentadilla o un press no activan por igual a todos los músculos que asisten. Esta revisión aconseja contar 1 a 1 mientras no haya más datos; el meta-análisis de 2024 ajustó mejor con un conteo fraccionario (por ejemplo 0.5 para la serie en que el músculo solo asiste). | Baja | [Schoenfeld et al. 2019](https://doaj.org/article/784eec50dc3d43a4b8b0d235d4c5845c); [Pelland et al. 2024](https://sportrxiv.org/index.php/server/preprint/view/460) |

Tres límites de esta sección. No pude abrir el meta-análisis de frecuencia de 2016 ni las guías de volumen de 2018 (PubMed y PMC bloquearon la lectura), así que no los cito. Tampoco encontré una fuente primaria para el tope de 8 series por sesión que usa ATLAS, así que lo trato como un valor práctico sin respaldo verificado. Y la columna de certeza es mi lectura de cada fuente, no una calificación de los autores.

## ATLAS hoy frente a la evidencia

ATLAS ya dosifica el volumen por rango semanal en los splits que elige el usuario, pero el modo Automatic (el predeterminado) reparte por tiempo de sesión, no por objetivo semanal, y no existen prioridad, nivel ni cercanía al fallo. Revisé la rama `atlas-week-splits`.

| Tema | Qué hace ATLAS hoy | Frente a la evidencia |
| --- | --- | --- |
| Volumen en splits | Apunta al punto medio del rango semanal de cada músculo dividido entre las veces que se entrena, y nunca pasa el máximo (`doseSets` en `workouts.js`). Rangos en `model.js`, por ejemplo pecho y cuádriceps 8 a 16, pantorrillas 4 a 10. | Coherente con la dirección de la evidencia. Los números exactos son una lectura común del tema, sin fuente citada en el código. |
| Volumen en Automatic | Cada músculo recibe series según su parte del tiempo de sesión (`targetSets`), limitadas por su máximo semanal. Una sesión corta da menos series aunque el músculo esté lejos de su objetivo. | Brecha: el volumen debería depender del objetivo semanal, no solo del reloj. |
| Frecuencia | `ESTIMATE.timesPerWeek = 2` ("how often each muscle is best trained"). El modo Automatic no repite más de 2 veces un bloque, pero tampoco garantiza que cada músculo llegue a 2. | La evidencia no sostiene que 2 sea óptimo por sí mismo; sirve para repartir el volumen. El texto del código exagera. Brecha en el reparto del día extra. |
| Prioridad del usuario | No existe. Todos los músculos elegidos valen lo mismo. | Brecha: es la pieza que falta para adaptar el plan a la meta. |
| Recuperación | `recoveryDays` de 1 o 2 por músculo, en días enteros, e incluye los músculos que un ejercicio trabaja de apoyo (`loadedMuscles`). | Razonable y conservadora para tren superior. No considera fallo ni volumen, que alargan la recuperación. |
| Series de apoyo | Un músculo que solo asiste cuenta 0.5 serie (`WORKOUT.secondaryCredit`). | Coherente con el mejor ajuste del meta-análisis de 2024. Hay discrepancia entre fuentes, así que debe ser un valor fácil de cambiar. |
| Cercanía al fallo | No se menciona en ninguna parte. | Brecha: es de las pocas variables con efecto positivo en hipertrofia. |
| Descanso y repeticiones | Compuestos 6 a 10 repeticiones con 2 a 3 min; aislados 10 a 15 con 60 a 90 s (`LIFT_KINDS`). | Compatible: la evidencia solo exige más de 60 s y no ve diferencia pasados 90 s. |
| Tope por sesión | `maxSetsPerSession = 8`, descrito como punto medio de "6 a 10 series duras". | Sin fuente primaria verificada. |
| Selección de ejercicios | Listas por niveles (S+, S, A+, A) "copiadas tal como se suministraron" para 8 músculos. Trapecios, antebrazos, isquiotibiales, aductores, pantorrillas, abdominales, oblicuos y espalda baja no tienen nivel. Solo los bíceps tienen una variante con el músculo estirado. | El origen de las listas no está documentado. El rango de movimiento no es un criterio. |
| Datos del usuario | Usa horas libres, días disponibles, ventana preferida y duración de sesión. No usa nivel de experiencia ni objetivo. | Brecha parcial: el nivel y la prioridad son los dos datos de mayor valor que faltan. |

## Qué datos pedir al usuario

Bastan dos datos nuevos: qué músculos están en foco y cuánta experiencia tiene la persona. El resto ya se pide o puede esperar. Así el usuario no siente un interrogatorio: el foco se marca con un toque en la pantalla donde ya elige músculos, y la experiencia es una sola pregunta con tres opciones.

| Dato | Cómo se pide | Qué cambia en el plan | Estado |
| --- | --- | --- | --- |
| Músculos en foco | Un toque sobre un músculo ya elegido lo alterna entre normal y foco, en la etapa Targets. Sin pantalla nueva. | Más frecuencia y más volumen dentro de su rango semanal; el día extra se reparte primero a los músculos en foco. | Nuevo |
| Experiencia | Una pregunta, tres opciones (menos de 6 meses, 6 meses a 2 años, más de 2 años), junto a la duración de sesión. Se pregunta una vez y se guarda. | Volumen de partida: quien empieza arranca en la parte baja de cada rango y sube de forma gradual, como aconsejan los autores de la revisión de recuperación. | Nuevo |
| Tiempo, días y horas libres | Ya existe: cuadrícula de disponibilidad, días por semana, días libres y ventana preferida. | Decide dónde cae cada sesión y cuántas hay. | Existente |
| Meta de nutrición | Ya existe (por ejemplo pérdida de grasa). | Hoy solo cambia calorías y proteína. No se usa en el entrenamiento hasta tener evidencia revisada. | Existente |
| Recuperación personal (sueño, estrés, edad) | No preguntar al inicio. Cuando haya datos, una pregunta opcional al cerrar la primera semana: "¿cómo fue tu recuperación?". | Subir o bajar el volumen de la semana siguiente. | Después: aún no revisé evidencia sobre cómo ajustar por estos datos |
| Limitaciones y ejercicios a evitar | No preguntar al inicio. La X que ya existe en cada ejercicio podría recordar lo que la persona descarta. | Evita proponer de nuevo un ejercicio rechazado. | Después |

Lo que no pediremos: peso, estatura ni edad para entrenar, porque no revisé evidencia que justifique cambiar el plan con esos datos y cada pregunta cuesta confianza.

## Diseño del algoritmo

El planificador fija primero un objetivo de series semanales por músculo, comprueba que cabe en el tiempo del usuario, y solo después decide cuántas veces entrena cada músculo y en qué días. Hoy el orden es el contrario: agrupa por familia y deja que el tiempo fije el volumen. Los números de abajo son valores de partida para probar, no resultados de la evidencia.

**1. Objetivo semanal por músculo.** Cada músculo ya tiene un rango de series (`weeklySets`). El objetivo cae dentro de ese rango según la experiencia y el foco:

```latex
\text{objetivo} = \text{bajo} + f \cdot (\text{alto} - \text{bajo})
```

| Experiencia | f sin foco | f con foco |
| --- | --- | --- |
| Menos de 6 meses | 0 | 0.5 |
| 6 meses a 2 años | 0.5 | 0.8 |
| Más de 2 años | 0.5 | 1.0 |

**2. Comprobar el tiempo.** Se suman las series de todos los músculos × 2.5 min, más 10 min de calentamiento por sesión, y se compara con las sesiones y minutos disponibles. Si no cabe, primero baja lo que no está en foco, sin pasar de su mínimo; después baja el foco. Si aún no cabe, la app lo dice y ofrece las dos salidas: un día más o sesiones más largas.

**3. Frecuencia.** Un músculo se entrena las veces necesarias para no pasar de 8 series por sesión (valor provisional). La frecuencia sale de dividir el volumen entre ese tope, de la recuperación, de los días disponibles y del foco; no es una cifra fija. Un músculo en foco con mucho volumen suele acabar en 2 o más sesiones, pero porque así se reparten sus series, no porque 2 sea óptimo.

**4. Reparto de días.** Se arman las sesiones para cumplir esas frecuencias con los días elegidos, equilibrando la duración (ninguna sesión se aleja más de 15 % de la duración media). Cada día sobrante va al músculo en foco con más frecuencia pendiente, y si no hay foco, al que lleve menos sesiones. Los splits que el usuario elige a mano (Upper · Lower, Push · Pull · Legs, Full body) siguen funcionando como hoy.

**5. Recuperación.** En la primera versión no cambia: se mantienen los días de recuperación actuales. La evidencia sugiere 48 a 72 h para el tren inferior y 24 h o menos para el superior, con poca certeza, así que queda anotado para revisar cuando haya más datos.

**6. Dentro de la sesión.** El músculo en foco se entrena primero, cuando hay más energía. Entre ejercicios de igual nivel se prefiere el que trabaja el músculo estirado, solo como desempate. Cada ejercicio muestra una guía de esfuerzo: terminar con 2 o 3 repeticiones en reserva en los compuestos y con 0 a 2 en los aislados. El fallo se deja para aislados y máquinas porque alarga la recuperación. Son valores iniciales, y más adelante deben cambiar según lo que el usuario reporte.

**7. Qué queda fuera por ahora.** La progresión semana a semana (ATLAS no guarda lo que levanta el usuario) y el ajuste por sueño, estrés y edad.

Las pruebas que el algoritmo debe cumplir siempre están en la sección Reglas de V1, más abajo.

Cada regla del algoritmo lleva una etiqueta de origen: evidencia (cita su fuente y su certeza), heurística (valor de partida sin respaldo directo), preferencia del usuario, decisión de optimización o regla de seguridad. Cuando la evidencia no permite decir que una opción es mejor, la app lo dice, por ejemplo: "La evidencia no permite afirmar que 3 sesiones sean mejores que 2 para este músculo; elegimos 3 para repartir tu volumen."

## Reglas de V1

La V1 no genera varios planes para puntuarlos: aplica reglas deterministas y jerarquizadas para construir un único plan válido. La optimización con varios objetivos queda para una versión posterior. Así se evita implementar sin querer un optimizador con pesos arbitrarios.

**Jerarquía de decisiones.** Cuando dos reglas chocan, gana la de arriba. Es el orden propuesto para V1 y se ajusta con las pruebas.

1. Seguridad: el máximo semanal de series por músculo.
2. Restricciones duras del usuario: días no disponibles y ejercicios que no puede hacer.
3. Tiempo y disponibilidad.
4. Recuperación mínima entre sesiones del mismo músculo.
5. Objetivo (en V1, hipertrofia).
6. Prioridad: el foco.
7. Dosis semanal dentro del rango de la evidencia.
8. Preferencias, como los ejercicios que no le gustan.
9. Heurísticas y desempates.

Ejemplo: si la dosis ideal pide 70 min y el usuario tiene 60, gana el tiempo. La app baja primero lo que no está en foco, sin pasar de su mínimo, y lo avisa.

**Invariantes.** El planificador garantiza lo siguiente, y las pruebas lo comprueban:

1. Nunca excede la disponibilidad del usuario.
2. Nunca viola sus restricciones duras.
3. Todo músculo seleccionado recibe al menos una sesión.
4. Un músculo en foco no recibe menos dosis que el mismo músculo sin foco, con todo lo demás igual.
5. Ningún músculo supera su máximo semanal configurado.
6. La frecuencia nunca se asigna por una regla fija de dos veces por semana.
7. Los splits manuales no se modifican.
8. Toda decisión que no se base directamente en evidencia lleva etiqueta.
9. Si no existe una solución válida, la app lo comunica en vez de devolver un plan que incumple algo.

**Reglas de ingeniería.**

- No inventar evidencia. Ningún parámetro puede etiquetarse como respaldado por evidencia si no existe una fuente documentada que justifique específicamente esa decisión. Hoy el tope de 8 series por sesión es una heurística.
- Evidencia y configuración se guardan por separado. La evidencia dice qué sabemos y con qué certeza, por ejemplo que la frecuencia no muestra una ventaja clara cuando el volumen es igual. La configuración dice qué decisión práctica tomamos, por ejemplo un máximo de 8 series por sesión, y cita la evidencia que la motiva sin heredar su certeza.

## Explicación de cada decisión

Cada decisión lleva una frase corta que dice qué se hizo y por qué, sin prometer resultados. Aparece plegada bajo el título de cada sesión y de la semana, para que la pantalla siga limpia. Donde la evidencia es débil la frase usa "suele" o "por lo general", y los números se muestran como estimaciones.

| Decisión | Frase que ve el usuario |
| --- | --- |
| Foco con 2 sesiones | "Piernas, 2 veces por semana: es tu foco, y repartir las series en dos sesiones las mantiene más cortas." |
| Volumen de un músculo | "Hombros: 12 series por semana, cerca del tope de su rango (6 a 12), por ser tu foco." |
| La semana no cabe | "No cabe todo en 3 sesiones de 60 min. Dejé abdominales y antebrazos en su mínimo; con un día más recuperas unas 8 series." |
| Experiencia | "Como estás empezando, arrancamos en la parte baja del rango y subimos poco a poco." |
| Recuperación | "Cuádriceps de nuevo el jueves: pasan 2 días desde la última sesión." |
| Orden en la sesión | "Hombros primero: es tu foco y llegas con más energía." |
| Esfuerzo | "Deja 2 o 3 repeticiones en reserva; en aislados puedes acercarte más al fallo." |
| Ejercicio elegido | "Curl inclinado: trabaja el bíceps con el músculo estirado, y puede dar resultados parecidos o algo mejores que un curl de pie." |

## Plan de implementación

Nueve pasos (0 a 8), cada uno en su propia rama con su propio PR hacia `main`, y cada uno con pruebas antes del siguiente. Así se puede revisar y volver atrás un cambio a la vez, como prefiere el proyecto. Los archivos son una estimación a partir de la lectura del código.

| # | Paso | Archivos probables | Pruebas nuevas |
| --- | --- | --- | --- |
| 0 | Etiquetas de origen y archivo de evidencia: cada regla del planificador (tope por sesión, crédito de 0.5, repeticiones en reserva, días de recuperación) lleva un tipo, su fuente, su certeza y la fecha de revisión. La evidencia (qué sabemos y con qué certeza) y la configuración (qué decisión práctica tomamos, con sus valores ajustables) van en lugares separados; la configuración cita la evidencia que la motiva y no hereda su certeza. | evidence.js (nuevo), workouts.js, estimate.js, model.js | Todo parámetro del planificador tiene etiqueta; los marcados como evidencia citan una fuente; cambiar un valor cambia el plan. |
| 1 | Prioridad por músculo: dato en `MuscleSelection`, guardado local y un toque en Targets para alternar normal y foco. Todavía no cambia el plan. | `selection.js`, `targets.js`, `storage.js` | La prioridad se guarda y se restaura; quitar un músculo limpia su foco. |
| 2 | Experiencia y objetivo semanal: la pregunta de tres opciones y la fórmula del objetivo por músculo. | `routine.js`, `estimate.js`, `app.js`, `index.html` | Ningún objetivo sale del rango; foco ≥ sin foco para cada nivel. |
| 3 | Comprobación de tiempo y avisos de "no cabe", con las dos salidas. | `routine.js`, `workout-view.js` | Una semana que no cabe avisa; una que cabe no avisa. |
| 4 | Frecuencia derivada del volumen y reparto de días en Automatic, con el día sobrante para el foco. | `routine.js`, `scheduler.js` | Todo músculo elegido se entrena; piernas en foco con volumen alto y 4 días se reparten en 2 sesiones; duraciones equilibradas. |
| 5 | Orden en la sesión (foco primero) y guía de esfuerzo en cada ejercicio. | `workouts.js`, `workout-view.js` | El foco va primero; los splits manuales siguen igual. |
| 6 | Frases de explicación plegadas por sesión y por semana. | `workout-view.js`, `render.js`, `css/styles.css` | Cada decisión con frase; ninguna promete un resultado. |
| 7 | Fuentes y niveles: guardar este documento en `docs/`, y buscar un origen para las listas de niveles de los músculos que no tienen. | `docs/`, `exercises.js` | Los ejercicios sin nivel siguen apareciendo. |
| 8 | Datos preparados para el registro, sin pantalla: carga, repeticiones, repeticiones en reserva, cumplimiento y dificultad por serie. Y en los ejercicios descartados, distinguir "no me gusta" de "no puedo". | storage.js, routine.js, workout-view.js | Un plan guardado y restaurado conserva los campos nuevos; descartar por preferencia no elimina el ejercicio de forma permanente. |

Decisiones que necesito de ti antes del paso 1:

- ¿La pregunta de experiencia va junto a la duración de sesión (etapa Week plan) o en Targets?
- ¿El nuevo reparto reemplaza al modo Automatic actual, o se agrega como un modo más? Mi recomendación es reemplazarlo, porque el actual no cumple su propia regla de dos veces por semana.
- ¿Guardamos este documento en `docs/` del repositorio al terminar?

## Después de la primera versión

La primera versión (pasos 0 a 8) cubre dosis, tiempo, frecuencia y distribución. Esta hoja de ruta sale de un feedback externo sobre este documento; se adopta como dirección, no como alcance inmediato. El principio que la guía: generar el plan que maximiza el resultado esperado para esta persona, con la mejor evidencia disponible y siendo explícito sobre la incertidumbre.

| Versión | Qué agrega | Qué necesita antes | Riesgo a vigilar |
| --- | --- | --- | --- |
| V2: motor de ejercicios | Elegir ejercicios por adecuación al usuario: equipo, preferencias, restricciones, coste de fatiga y de preparación, en categorías (bajo, medio, alto) y no en puntajes. | Un origen documentado para las listas de niveles; el equipo disponible en el perfil. | Inventar números sin base. Cada atributo lleva la etiqueta de heurística. |
| V3: registro y progresión | Guardar carga, repeticiones, repeticiones en reserva y cumplimiento; sugerir progresión de carga, de repeticiones o de volumen. | El esquema de datos del paso 8 y una pantalla de registro. | Fricción: debe ser opcional y rápido. |
| V4: adaptación semanal | Un chequeo corto (¿completaste?, rendimiento, recuperación, molestias, volumen bajo o alto) que ajusta la semana siguiente. | V3. | No subir el volumen solo porque "más series crece más"; observar la respuesta. |
| V5: motor de nutrición | Calorías, proteína, grasa, carbohidratos, reparto, preferencias, presupuesto y actividad. | Una revisión de evidencia propia, que este documento no cubre. | Es un proyecto del tamaño del planificador. |
| V6: respuesta personal | Aprender qué volumen, frecuencia y ejercicios le funcionan a cada persona. | Semanas de historial de V3 y V4. | Con pocos datos por persona las conclusiones serán débiles. |

Tres ideas del feedback quedan pospuestas a propósito. Un vector de objetivos con pesos (hipertrofia 0.8, fuerza 0.3…) y un optimizador que genera y puntúa planes necesitarían pesos arbitrarios, y hoy el entrenamiento solo soporta la hipertrofia como meta. Los puntajes numéricos de estímulo y fatiga por ejercicio no tienen datos que los respalden. Y una meta de fuerza exige práctica específica de cada movimiento, algo que habría que diseñar aparte.
