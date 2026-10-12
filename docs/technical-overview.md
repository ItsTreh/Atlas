# ATLAS — Documento técnico del proyecto

> Levantamiento técnico para análisis y propuesta de mejoras.
> Fecha: 2026-10-10 · Rama revisada: `atlas-exercise-metadata` · Último commit: `a7ceb03`
> Fuente: lectura directa del repositorio (código, docs, `CLAUDE.md`, `.claude/`, tests, tools) y del historial de git.

**Alcance y límites de este levantamiento.** Leí por completo la documentación (`README.md`, `CLAUDE.md`, `docs/*`), `index.html`, `package.json`, `model.js`, `selection.js`, `storage.js`, `app.js`, `evidence.js`, `tests/load-app.js` y `anatomy-regions.js`. Del resto del código leí las cabeceras y la estructura (clases, funciones, constantes), no cada línea. **No pude ejecutar la suite de pruebas** (ver §11), y no abrí el sitio en un navegador, así que nada aquí está verificado en ejecución. Las cifras de conteo salen de cargar los scripts de lógica en Node.

---

## 1. Qué es

ATLAS es un planificador semanal de entrenamiento que corre 100 % en el navegador (sin cuenta, sin servidor, sin build). Tres etapas:

1. **Targets** — el usuario elige músculos sobre una figura anatómica interactiva (o parte de un programa), con prioridad por músculo (Mantener / Normal / Foco).
2. **Nutrition** — calorías y proteína derivadas del entrenamiento, objetivo, peso y gasto diario.
3. **Week plan** — una cuadrícula de 7 días × 18 horas; el usuario pinta su disponibilidad y la app coloca sesiones, ejercicios y comidas.

Principios de producto que el código hace cumplir:

- Toda cifra de calorías, proteína o progreso es una **estimación** y muestra cómo se calculó; nunca promete un físico en una fecha.
- Cada parámetro del planificador lleva una **etiqueta de origen** (`evidence`, `heuristic`, `preference`, `optimization`, `safety`); nada se presenta como ciencia sin fuente documentada.
- El planificador es **determinista**: sin optimizador ni puntajes ponderados en la selección de ejercicios; mismas entradas, misma semana.

## 2. Restricciones duras (de `CLAUDE.md`)

| Restricción | Consecuencia técnica |
|---|---|
| La página abre desde `file://` | Scripts clásicos, sin módulos ES, sin bundler, sin servidor, sin `fetch` de datos. Los modelos 3D generados también son scripts clásicos. |
| Datos separados de la UI | Las vistas leen/escriben estado compartido (`routine`, `routine.selection`). `MuscleSelection` es la única fuente de verdad de los objetivos. |
| Toda cifra es estimación | Texto de UI y `explain.js` generan frases con "suele/tiende a" donde la evidencia es débil. |
| No relajar tests de tamaño, triángulos o regiones sin avisar | Hay tests que fijan esos invariantes del modelo anatómico. |

## 3. Stack

| Capa | Tecnología |
|---|---|
| App | HTML + CSS + JavaScript plano (scripts clásicos, un único ámbito global compartido) |
| 3D | WebGL2 escrito a mano (shaders propios en `anatomy-sculpture.js`), cámara ortográfica; fallback a SVG |
| Persistencia | `localStorage` (clave `atlas.routine.v1`, snapshot `version: 1`) |
| Tests de lógica | Vitest ^5.0.1 (sobre `node:vm`, cargando los archivos reales de la app) |
| Herramientas de assets | Node (`.mjs`) + `meshoptimizer` ^1.3.0; Python dentro de Blender 5.2.2 (headless) |
| Fuente de la escultura | `assets/anatomy/Male_Body.blend` (Blender), pintada a mano por regiones |
| Repo | GitHub `ItsTreh/Atlas` (el `package.json` aún apunta a `Routine-Organizer`) |

Dependencias de desarrollo: solo `vitest` y `meshoptimizer`. No hay dependencias de runtime. No encontré en la raíz configuración de linter/formatter ni carpeta `.github` (CI).

## 4. Estructura del repositorio

```
index.html            las tres etapas; carga los scripts en orden fijo (30 scripts)
css/styles.css        tokens de tema (claro/oscuro), layout, 927 líneas, 3 media queries
js/                   lógica + vistas + modelos 3D generados (ver §5)
tests/                16 suites Vitest + load-app.js (cargador de la app en Node)
docs/                 algorithm.md, atlas-design.md, anatomy-levels.md,
                      metadata-sources.md, tier-list-sources.md
assets/anatomy/       Male_Body.blend, .paint.json, .manifest.json, .glb; torso-study (retirado)
prototype/male-body/  derivación previa del cuerpo (referencia)
lab/                  anatomy-authored.html (página de desarrollo, fuera de la app)
tools/anatomy/        build.mjs, build-authored.mjs, sdf/mesh/glb/occlusion/sculpture.mjs
tools/anatomy/authored/  scripts Python de Blender (importador, refinado, guardas, tests)
tools/claude/         session-context.sh (hook SessionStart)
.claude/              settings.json + 8 agentes especializados
```

Tamaño aproximado del código fuente (líneas): ~15 200 entre `js/`, `css/`, `index.html`, `tools/` y `lab/`. Los tres `js/anatomy-model*.js` son datos generados (7.99 MB, 0.92 MB y 0.79 MB) y están marcados `linguist-generated=true -diff` en `.gitattributes`.

## 5. Arquitectura de la aplicación

### 5.1 Modelo de carga

Todo comparte un único ámbito global. El orden de `<script>` en `index.html` **es** el grafo de dependencias:

```
model → programs → selection → evidence → estimate → nutrition → foods →
exercises → exercise-meta → log → recovery → workouts → distribution →
routine → scheduler → anatomy-model → [anatomy-model-male-body*] →
anatomy-regions → anatomy → anatomy-sculpture → anatomy-stage →
render → storage → targets → audit → explain → workout-view →
nutrition-view → paint → app
```

\* El modelo `male-body` (≈7.5–8 MB) se inyecta con `document.write` solo si la URL trae `?anatomy=male-body`. Sin la bandera se usa la figura procedural.

Las pruebas replican esto: `tests/load-app.js` lee `index.html`, extrae los `<script src>`, descarta los "VIEW_FILES" (los que tocan DOM/WebGL) y ejecuta el resto en un único contexto `vm`. Los globales que las pruebas ven se declaran en una lista `EXPORTS`.

### 5.2 Capas

| Capa | Archivos | Responsabilidad |
|---|---|---|
| Datos / dominio | `model.js`, `programs.js`, `exercises.js`, `exercise-meta.js`, `foods.js`, `evidence.js` | Catálogos inmutables (`Object.freeze`), validados al cargar con `console.error` |
| Estado | `selection.js` (`MuscleSelection`), `routine.js` (`WeeklyRoutine`), `nutrition.js` (`NutritionPlan`), `log.js` | Estado compartido y serializable (`snapshot()` / `restore()`) |
| Algoritmos | `estimate.js`, `distribution.js`, `scheduler.js`, `workouts.js`, `recovery.js`, `audit.js`, `explain.js` | Planificación determinista, auditoría y texto |
| Vistas | `render.js`, `targets.js`, `nutrition-view.js`, `workout-view.js`, `paint.js`, `app.js` | Dibujo con `innerHTML` + `esc()`, y cableado de eventos |
| Anatomía | `anatomy-stage.js`, `anatomy-sculpture.js`, `anatomy.js`, `anatomy-regions.js`, `anatomy-model*.js` | Escena 3D / fallback SVG, picking, mapa región→músculo |

### 5.3 Patrones recurrentes

- **Observador mínimo**: `selection.onChange(fn)` devuelve función de baja; `emit()` recorre listeners. Varias vistas se suscriben (resumen, estimación, guardado, avisos de semana obsoleta).
- **Snapshot/restore**: solo se guardan **entradas** (selección, prioridades, nutrición, preferencias de agenda, cuadrícula pintada, log, ejercicios descartados). Las sesiones y entrenamientos se **regeneran** con `generate()` al restaurar (determinista). Los cambios manuales dentro de una sesión (swaps) **no** se restauran.
- **Detección de semana obsoleta** (`app.js`): `planInputs()` concatena las entradas relevantes en una cadena; si difiere de `generatedFor`, se avisa que hay que regenerar.
- **Contrato de renderer**: `new Renderer(mount, selection, { model, onHover, onFail })` + `preview(ids)`; `AnatomyStage` monta el primero soportado y pasa al siguiente si falla (WebGL2 → SVG).
- **Config separada de evidencia**: `EVIDENCE` (qué se sabe y con qué certeza) vs `PLANNER_CONFIG` (qué decide ATLAS), y `configValue(key)` falla fuerte si falta una clave.

## 6. Modelo de dominio

### 6.1 Catálogos (conteos reales al cargar)

| Catálogo | Cantidad | Notas |
|---|---|---|
| Músculos (`MUSCLES`) | 16 | id, nombre, familia (push/pull/legs/core), minutos/sesión, días de recuperación, rango de series/semana |
| Ejercicios (`EXERCISES`) | 112 | 44 patrones de movimiento (`MOVEMENTS`); primarios y secundarios |
| Listas de nivel (`EXERCISE_RATINGS`) | 7 | S+ / S / A+ / A; pecho, tríceps, espalda, hombros, cuádriceps, bíceps, glúteos |
| Metadatos de ejercicio (`EXERCISE_META`) | 67 | acción articular, regiones, confianza (`anatomy`/`convention`/`uncertain`), `review: "pending"` |
| Programas | 10 | 3 grupos (cuerpo completo, Push·Pull·Legs, pares clásicos) |
| Splits | 4 | `auto`, `upper-lower`, `push-pull-legs`, `full-body` |
| Alimentos / ideas de comida | 36 / 22 | por 100 g; dietas: any, pescatarian, vegetarian, vegan |
| Objetivos / actividad | 4 / 4 | lose, gain, maintain, fitness · seated, light, active, intense |
| Hallazgos de evidencia | 7 | weekly-volume, frequency, proximity-to-failure, rest-interval, range-of-motion, recovery-between-sessions, indirect-set-counting |
| Parámetros del planificador | 20 | `PLANNER_CONFIG`, más `PLANNER_TABLES` para tablas aún en otros archivos |

Los músculos 16 y sus rangos semanales (series duras) más relevantes: pecho, espalda alta, dorsales y cuádriceps 8–16; hombros, isquios, glúteos 6–12; tríceps, bíceps, pantorrillas, abdomen 4–10; trapecios 4–8; antebrazos, aductores, oblicuos, lumbar 2–6.

### 6.2 Clases principales

| Clase | Archivo | Rol |
|---|---|---|
| `Muscle` | model.js | Valor inmutable del catálogo |
| `TrainingBlock` | model.js | Conjunto de músculos entrenados juntos; derivado y desechable; puede traer `plannedSets` (reparto del módulo de distribución) |
| `TimeSlot`, `WorkoutSession`, `PlannedMeal` | model.js | Celda de la cuadrícula (FREE/BUSY/WORKOUT/MEAL), sesión colocada, comida colocada |
| `MuscleSelection` | selection.js | Selección + prioridades + programa de origen; `source()` distingue program / modified / custom / empty |
| `WeeklyRoutine` | routine.js | Raíz agregada: cuadrícula, selección, nutrición, log, preferencias; `generate()`, `weekFit()`, `weeklyVolume()`, mover/quitar sesiones |
| `NutritionPlan` | nutrition.js | Objetivo, ajuste calórico, proteína, comidas y horarios |
| `WorkoutBuilder` / `Workout` / `WorkoutEntry` | workouts.js | Construye y edita el entrenamiento de cada sesión |
| `Scheduler` / `Placement` | scheduler.js | Elige el mejor hueco por puntaje |
| `TrainingLog`, `SessionLog`, `ExerciseLog`, `SetLog`, `ExercisePreferences` | log.js | Esquema de registro (aún sin pantalla) y descartes ("dislike" vs "cannot") |
| `Exercise` | exercises.js | Incluye `sameJobAs(other, muscleId)` para detectar ejercicios redundantes |

## 7. Pipeline de planificación

Descripción completa en `docs/algorithm.md` (en español). Resumen técnico:

`routine.generate()`:

1. `clearGenerated()` limpia la semana anterior.
2. `planBlocks()` / `distributedBlocks()` arman bloques por día usando `weekFit()` → `fitToTime()`.
3. `Scheduler.plan(requested)` coloca cada bloque en el mejor hueco. Si el modo es `auto` y no todos los bloques encuentran día, reintenta con menos bloques (`planBlocks(n)`) y se queda con el intento que pierde menos series de músculos Foco → menos series en total → más sesiones.
4. Se crean `WorkoutSession`s y se ocupan los slots.
5. `WorkoutBuilder.build()` elige ejercicios, dosis y orden.
6. `placeMeals()` coloca comidas si `showMeals` y la nutrición es válida.
7. Devuelve `{ placed, requested, free, meals, reason, limit }`; `reason ∈ ok | rest | days | partial | no-muscles | no-exercises | no-room | no-blocks | no-valid-combination` y `app.js` lo traduce a mensajes.

### 7.1 Objetivo semanal por músculo (`estimate.js`)

`objetivo = bajo + f × (alto − bajo)`, con `f` según experiencia y prioridad:

| Experiencia | Maintain | Normal | Focus |
|---|---|---|---|
| beginner (por defecto) | 0 | 0 | 0.5 |
| intermediate | 0 | 0.5 | 0.8 |
| advanced | 0 | 0.5 | 1.0 |

Tiempo por serie planificado: `minutesPerSet = 4.2` (0.75 trabajo + media de descansos 3 / 2.5 + 2 min de preparación repartidos entre 3 series); calentamiento 10 min/sesión. `fitToTime` recorta en orden Normal → Foco hasta el mínimo habitual, luego Maintain → Normal → Foco hasta un piso de 2 series directas, y calcula qué lo arreglaría (un día más o sesiones más largas).

### 7.2 Distribución (`distribution.js`)

Cadena de reglas fijas: frecuencia (tope `maxSetsPerSession = 8`), días sobrantes (Foco → Normal; Maintain nunca gana frecuencia; mínimo 4 series por sesión extra), colocación por patrón de días (cinco criterios en cascada), equilibrio (`BALANCE_SLACK = 4` series), consolidación de sesiones < 6 series (`MIN_SESSION_SETS`) y recorte de días sobrecargados.

### 7.3 Scheduler (`scheduler.js`)

Evalúa cada hueco posible con pesos (`SCORE`, origen `optimization`, no basados en investigación):

| Peso | Valor | Peso | Valor |
|---|---|---|---|
| inWindow | 40 | nextDay | 15 |
| windowDrift (por hora) | 6 | muscleNextDay | 20 |
| dayLoad (por hora ocupada) | 2 | sameStart | 6 |
| noBufferBefore / After | 8 / 8 | reuse (por vez que el bloque ya se colocó) | 25 |
| oddHour (antes de 7 o después de 22) | 8 | volume (por minuto) | 0.1 |
| mealClash | 12 | | |

Un día admite una sola sesión. Se coloca un bloque a la vez; todo bloque se coloca una vez antes de repetir.

### 7.4 Recuperación (`recovery.js`)

Dos sesiones que cargan un músculo **directamente** necesitan `recoveryDays` completos (1 o 2 según el músculo). Si una solo lo asiste, el hueco es `ceil(recoveryDays × 0.5)` (`indirectRecoveryFraction`, heurística). Antes de elegir ejercicios, el scheduler solo puede predecir exposición directa (`loadedMuscles` en `routine.js`); después, `recoveryCheck` informa de lo que quede en conflicto.

### 7.5 Selección y orden de ejercicios (`workouts.js`)

- Dosis por músculo con topes: 8 series/sesión, máximo semanal, series de apoyo a 0.5, mínimo 2 directas.
- ~3 series por ejercicio (máx. 4); un solo ejercicio por patrón de movimiento por sesión.
- Ranking por nivel (S+→A) con **penalizaciones nombradas** guardadas en `entry.penalties`: `repeat`(1), `interference`(1), `dislike`(2), `recovery`(1), `same-job`(2), `weekly-maximum`. "Cannot" jamás se elige.
- Orden en sesión: dependencia (quien fatiga a otro va antes), prioridad (Foco primero), compuestos antes que aislados, nivel, orden de elección. Cada entrada guarda `orderRule`.
- Esfuerzo: RIR "1–2" en compuestos, "0–1" en aislados; reps 6–10 / 10–15; descansos 3 / 2.5 min.
- Ajuste final por duración real (se recortan series de los ejercicios más grandes antes de quitar ejercicios); un músculo sin sitio queda "omitido" y se avisa.

### 7.6 Auditoría y explicaciones

- `audit.js` (`auditPlan`) suma, por músculo, `requestedSets → targetSets → plannedSets → finalDirectSets/Indirect/TotalCredit` y asigna **causa** a cada diferencia (`time-fit`, `fewer-sessions`, `session-capacity`, `session-time`, `weekly-maximum`, `session-set-limit`, `minimum-exercise`, `no-eligible-exercise`, `user-restriction`, `not-placed`). Una diferencia sin causa se reporta como `unexplained` y **hay un test que exige cero**.
- `explain.js` genera una frase por decisión a partir de los números reales del plan; mostradas plegadas en "Why this week / Why this session".

## 8. Nutrición (`nutrition.js`, `foods.js`, `nutrition-view.js`)

- Gasto diario: valor del usuario o estimación a partir de peso y nivel de actividad + carga de entrenamiento del plan (`TRAINING_ENERGY`: 3–5 kcal/kg·h, semana pesada = 6 h).
- Objetivo → ajuste porcentual sobre el gasto (`lose` −20 a −15 %, `gain` +5 a +12 %, `maintain`/`fitness` 0), con ajuste dentro del rango según carga o cobertura muscular; proteína por objetivo (rangos de g/kg: 1.8–2.7, 1.6–2.2, 1.6–2.2, 1.2–1.8). Límites duros: ajuste [−30 %, +20 %], proteína [1.2, 3.0] g/kg, piso de 1 200 kcal, peso 30–250 kg (UI acepta hasta 550), gasto 1 000–6 000.
- Comidas: patrones de N comidas al día en una ventana primera/última, repartidas uniformemente y movibles; ~40 g de proteína por comida (`PROTEIN_PER_MEAL`).
- Ideas de comida: se escalan por porción a las kcal de cada comida; el encaje con la dieta se **calcula** a partir de los alimentos (no se etiqueta a mano).
- El plan de nutrición lee el entrenamiento por un callback (`() => ({ muscles, sessionsPerWeek, sessionMinutes, weeklySets })`), de modo que no duplica estado.

## 9. Anatomía 3D (el área con más trabajo actual)

### 9.1 Pipeline de la escultura Male_Body

```
assets/anatomy/Male_Body.blend         escultura editada a mano (fuente de verdad)
  + Male_Body.paint.json               color pintado → id de región (más de 50 colores)
  ▼  tools/anatomy/authored/male_body.py   (Blender headless; solo LEE el .blend)
assets/anatomy/male-body.glb           una primitiva por región
  ▼  tools/anatomy/build-authored.mjs + male-body.manifest.json
js/anatomy-model-male-body.js          lo que carga la página
  ▼  js/anatomy-regions.js             id de región → id de músculo de la app (16)
```

Origen de la región de cada cara (prioridad): (1) **pintada** en Vertex Paint — cada esquina toma el color listado más cercano, la cobertura se difumina ≈1 cm por distancia y las caras que cruza un borde se **cortan** a lo largo del contorno suave; (2) **materiales por región** escritos antes por `male_body_regions.py` (superado); (3) **prestada** de la figura procedural (infraespinoso, redondo mayor, erector, mientras no se pinten), con las manos siempre como `body`.

Modelo actual: **35 regiones**, 165 022 vértices, 306 456 triángulos; vértice de 14 bytes (posición 3×uint16 sobre límites, normal octaédrica 2×int16, región, oclusión, costura). Incluye oclusión ambiental precalculada por ray casting (BVH propio), distancia a costuras, *landmarks* ligados a triángulos por coordenadas baricéntricas y *morphs*. Se simplifica con meshoptimizer preservando bordes de región.

Pintado hasta ahora: pecho, abdomen, oblicuos, serrato, deltoides, trapecio, todo el brazo (bíceps, tríceps, braquial, coracobraquial y antebrazo músculo por músculo), dorsal ancho, erector espinal, romboides, infraespinoso y redondo mayor. Pendiente: resto de espalda, cadera y piernas (hoy son regiones de relleno).

### 9.2 Renderer WebGL2 (`anatomy-sculpture.js`, 971 líneas)

- Cámara ortográfica con un solo ángulo `yaw` (frente 0°, espalda 180°), órbita por arrastre ±25° (con "holgura" de 6° y retorno elástico).
- Dibuja solo cuando cambia algo (selección, puntero, tamaño, tema, giro); transiciones por *easing* (`hoverIn` 35 ms, `hoverOut` 90 ms, `select` 60 ms).
- **Picking** por segundo pase offscreen que escribe la región por píxel; se lee al redimensionar y cuando el cuerpo queda quieto tras un giro (no hay hover mientras gira).
- Accesibilidad: una casilla por músculo en cada vista, en orden de catálogo; enfocar una del otro lado gira el cuerpo hacia ella.
- Fallback: `AnatomyFigure` en SVG (figura procedural dibujada como datos, un lado espejado) cuando no hay WebGL2 o falla un shader/contexto.

### 9.3 Reglas anatómicas acordadas

Cada área clicable selecciona el músculo realmente debajo; donde no hay músculo (hueso, tendón, rótula, olécranon) no es seleccionable. IDs de región estables y regiones de grupo (`quadriceps-femoris`, `hamstrings`, `adductors`) donde la escultura muestra una masa. **El serrato anterior es excepción deliberada**: pintado y presente en el modelo pero mapeado a `null` (dibujado, no clicable) hasta que exista la vista con zoom. También `null`: coraco­braquial, iliopsoas y esternocleidomastoideo. Plan de tres niveles (entrenamiento / anatomía / relación ejercicio) en `docs/anatomy-levels.md`; aún no construido.

## 10. Persistencia

- Un solo objeto en `localStorage["atlas.routine.v1"]`, escrito tras cada cambio relevante (`saveRoutine`) y envuelto en `try/catch` (modo privado, cuota, datos corruptos → arranca limpio).
- `restore()` valida campo por campo (ids de músculo desconocidos se descartan, prioridades solo `maintain|focus`, splits/experiencia contra listas conocidas) y regenera la semana si `hadPlan`.
- El arranque aterriza en `plan`, `nutrition` o `targets` según lo restaurado.
- No hay migración de versiones: existe `version: 1` pero no vi código que lea versiones anteriores.

## 11. Pruebas y calidad

| Aspecto | Estado |
|---|---|
| Suites Vitest | 16 archivos, ≈247 casos (conteo de `test(`/`it(`; algunos pueden ser parametrizados) |
| Cobertura de áreas | datos, selección, nutrición, distribución, scheduler/recuperación, entrenamiento, orden, auditoría, explicaciones, log, evidencia, metadatos, y modelos anatómicos (3 suites) |
| No cubierto por Vitest | Todas las vistas y el renderer (excluidos vía `VIEW_FILES`); la verificación visual se hace a mano o con el agente `qa` en navegador real |
| Tests Python | `test_refine_guard.py`, `test_male_body_regions.py` en `tools/anatomy/authored/`; **no** forman parte de `npm test` |
| Invariantes destacados | auditoría sin `unexplained`; todo parámetro con etiqueta de origen; los marcados `evidence` citan fuente; los grupos de `PLANNER_CONFIG` coinciden con `WORKOUT`/`ESTIMATE`; cada músculo seleccionado recibe sesión |
| Linter / CI | No encontrados en la raíz |

**Entorno de ejecución de las pruebas (observado hoy):** al intentar `npx vitest run` desde el entorno Linux de esta sesión falla con *Cannot find native binding*, porque `node_modules` contiene solo los binarios `darwin-arm64` de rolldown y lightningcss (instalados en tu Mac). No es un fallo del proyecto, pero implica que **hoy no pude confirmar que las pruebas pasen**. Hay que ejecutarlas en tu Mac con `npm test`.

## 12. Flujo de trabajo y herramientas del proyecto

- **Ramas**: una rama por cambio, PR a `main`. Rama actual `atlas-exercise-metadata`; existen ≥16 ramas locales (p. ej. `atlas-evidence-layer`, `atlas-frequency-days`, `atlas-time-fit`, `atlas-week-splits`, `atlas-function-selection`) y una de respaldo (`backup/atlas-week-splits-before-review`).
- **Historial**: 107 commits entre 2026-09-23 y 2026-10-09. Últimos: metadatos de ejercicio (acciones, regiones, confianza), selección por función con penalizaciones nombradas, auditoría de consistencia, documentación del algoritmo, registro de entrenamiento, fuentes de niveles.
- **Hook SessionStart** (`tools/claude/session-context.sh`): imprime la rama actual y las regiones ya pintadas (leyendo `Male_Body.paint.json` con `jq`), para que no se anoten a mano en `CLAUDE.md`.
- **Agentes** (`.claude/agents/`): `anatomy`, `anatomy-implementation`, `architect`, `nutrition`, `qa`, `schedule`, `training`, `ui-ux`. Regla del proyecto: solo se lanzan los que el usuario nombra; una línea combinada ("Training/Nutrition/Schedule") cuenta como un agente.
- **Reglas de colaboración** (`CLAUDE.md`): empezar a trabajar solo cuando se pide explícitamente; prototipos pequeños que se detienen en la primera versión que responde la pregunta; commit/push solo a petición; cargar el skill `frontend-design` antes de trabajo visual.
- **Comandos**: `npm test`; `npm run build:anatomy` (figura procedural); `npm run build:anatomy-authored assets/anatomy/male-body.manifest.json` (escultura). Blender no está en el PATH: `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python <script>` con `PYTHONDONTWRITEBYTECODE=1`.
- **Para agregar un músculo pintado**: pintar y guardar en Blender → añadir color a `paint.json` → asegurar la región en `male-body.manifest.json` (quitar `"source": "borrowed"`) y en `anatomy-regions.js` → correr `male_body.py` → build authored → `npm test` → verificar en navegador real.

## 13. Documentación existente

| Archivo | Contenido | Idioma |
|---|---|---|
| `README.md` | Producto, cómo correrlo, estructura, estado y hoja de ruta | Inglés |
| `CLAUDE.md` | Restricciones, pipeline anatómico, reglas de colaboración | Inglés |
| `docs/atlas-design.md` | Evidencia y diseño del planificador, plan de pasos 0–8, versiones V2–V6 | Español |
| `docs/algorithm.md` | Algoritmo paso a paso + auditoría, recuperación y metadatos | Español (secciones finales en inglés) |
| `docs/anatomy-levels.md` | Tres niveles de anatomía y reglas | Inglés |
| `docs/metadata-sources.md`, `docs/tier-list-sources.md` | Fuentes de metadatos y de niveles | — |

**Hoja de ruta declarada**: ✅ tema base, escenario anatómico dedicado, giro frente/espalda; ⏳ escultura 3D (pintado en curso, tras bandera), estados hover/selección refinados + vista lateral + zoom, rieles laterales (programas y demanda), nutrición y plan semanal rediseñados. Producto: V2 motor de ejercicios (equipo/preferencias), V3 registro y progresión, V4 adaptación semanal, V5 motor de nutrición, V6 respuesta personal.

## 14. Límites conocidos (reconocidos por el propio proyecto)

- Los tiempos por serie, descansos, fracciones de objetivo, rangos de series, tope de 8 series/sesión y descensos de nivel son **heurísticas**, no mediciones. El tope de 8 no tiene fuente primaria verificada.
- Las listas de niveles (S+…A) son la opinión de un solo entrenador y solo cubren 7 grupos; trapecios, antebrazos, isquios, aductores, pantorrillas, abdomen, oblicuos y lumbar no tienen lista.
- Los metadatos de ejercicio (67 entradas) son la lectura anatómica del autor y están todos en `review: "pending"`. No hay ejercicio directo de deltoide frontal ni de trapecio inferior; los dorsales no tienen regiones.
- `session-capacity` puede dejar corto a un músculo Foco cuando varios comparten pocos días; algunas semanas de 5 sesiones pueden ser inviables por la exposición predicha. Se reporta, no se oculta.
- Cambios manuales de ejercicios no sobreviven a una recarga.
- La progresión semana a semana, el equipo disponible, lesiones y el ajuste por sueño/estrés/edad no están implementados.
- El log de entrenamiento está modelado pero sin pantalla.
- Contribuciones por ejercicio (Nivel 3 de anatomía) y zoom/cartografía: planeados, no construidos.

## 15. Observaciones para el análisis de mejoras

Son hechos observados en el repositorio que conviene revisar; **no son propuestas todavía**.

**Arquitectura y mantenibilidad**
1. Un solo ámbito global con 30 scripts y orden de carga implícito: añadir un archivo exige conocer el orden; la lista `EXPORTS` de `load-app.js` y `VIEW_FILES` se mantienen a mano.
2. Los archivos más grandes concentran lógica: `anatomy-sculpture.js` (971 líneas), `routine.js` (594), `workouts.js` (492), `nutrition-view.js`/`workout-view.js` (~410). `routine.js` mezcla estado, generación, validación de splits, movimiento de sesiones y colocación de comidas.
3. Parte de la configuración sigue fuera de `PLANNER_CONFIG` (`PLANNER_TABLES` apunta a `model.js`, `workouts.js`, `scheduler.js`, `exercises.js`); el propio código lo marca como "paso posterior".
4. Los pesos de `SCORE` (scheduler) son ajustados "entre sí" sin respaldo; hay tests de comportamiento (`schedule.test.js`, 461 líneas) pero no una forma de ver cómo cambia la semana al variarlos.
5. Hay dos fuentes parciales de verdad para rangos y minutos: `MUSCLE_SEED` y la documentación de `algorithm.md`/`atlas-design.md`; el diseño original usaba 2.5 min/serie y la implementación usa 4.2, así que `atlas-design.md` ya no refleja el código en ese punto.

**Calidad y pruebas**
6. Las vistas (≈2 000 líneas entre `render`, `targets`, `workout-view`, `nutrition-view`, `app`, `paint`) y el renderer WebGL no tienen pruebas automatizadas; dependen de QA manual.
7. No hay linter, formateador ni CI que corra `npm test` en cada PR.
8. Los tests Python de Blender no están integrados al flujo de `npm test`.
9. Con `node_modules` instalado solo para macOS arm64, las pruebas no corren en otro entorno (CI, Linux, Windows) sin reinstalar.

**Rendimiento y entrega**
10. El modelo `male-body` pesa ≈8 MB como script y se carga con `document.write` (bloqueante) bajo bandera; cuando sustituya a la figura procedural será el costo de carga principal de una app que hoy es casi estática. Los tres modelos 3D generados suman ≈9.7 MB en el repo.
11. El repositorio pesa ≈188 MiB empaquetado (historial de `.blend`/`.glb` binarios sin Git LFS; solo `Male_Body.blend` ≈13 MB y el `.glb` ≈7 MB, más copias en `prototype/` y `torso-study`). Además hay archivos `tmp_obj_*` y `tmp_pack_*` sueltos en `.git/objects` (restos de operaciones interrumpidas; `git count-objects` los reporta como basura).
12. `.DS_Store` aparece sin seguimiento y no está en `.gitignore`.
13. Nombres inconsistentes: paquete `sd-routine`, URL del repo `Routine-Organizer` en `package.json` frente a `Atlas` en el README y el remoto real.

**Producto y UX**
14. Las vistas se construyen con cadenas HTML (`innerHTML` en ≈40 sitios) y un helper `esc()`; funciona, pero cada plantilla nueva exige recordar escapar.
15. La documentación mezcla español e inglés (docs de algoritmo en español; código, UI y README en inglés).
16. La restauración reconstruye la semana pero pierde los swaps manuales; no hay versionado/migración del snapshot.
17. El log de entrenamiento y las preferencias de descarte tienen esquema, pero sin pantalla no hay forma de que el usuario los alimente; la hoja de ruta V3/V4 depende de ello.
18. La etapa Targets/Anatomía depende de WebGL2 con fallback SVG, pero la figura SVG y la escultura tienen niveles de detalle muy distintos (16 grupos vs 35 regiones); conviene definir qué experiencia es la de referencia.

---

*Generado a partir de una revisión del repositorio el 2026-10-10. Para actualizar este documento después de cambios grandes conviene volver a contar catálogos (cargar los scripts de lógica en Node) y repasar `git log`.*
