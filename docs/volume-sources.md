# Fuentes del volumen de entrenamiento

Estado a 2026-10-10. Regla del proyecto: ninguna cita entra al código como `evidence` hasta que se abrió la fuente y se comprobó que dice lo que se afirma. Lo no verificado lleva la marca `PENDIENTE-VERIFICAR (Vn)` en `js/evidence.js` (`grep PENDIENTE-VERIFICAR js/evidence.js`).

| Fuente | Estado | Qué se abrió | Para qué se usa | Verificación pendiente |
|---|---|---|---|---|
| Schoenfeld, Ogborn y Krieger 2016, *Journal of Sports Sciences* (metaanálisis de 15 estudios) | Publicado | Leído en una revisión previa (2026-10-08) | Forma de la curva semanal; cifras 5.4 / 6.6 / 9.8 % de crecimiento | ninguna |
| Pelland, Remmert, Robinson, Hinson y Zourdos 2026, *Sports Medicine* 56:481–505, DOI `10.1007/s40279-025-02344-w` (metarregresión bayesiana) | Publicado | Solo el resumen (texto completo de pago), 2026-10-11 | Dosis mínima, forma de la curva, conteo fraccional 0.5 | **V1 (parcial)**: el resumen confirma el método fraccional (1 / 0.5 / 0), 67 estudios, 2 058 personas y rendimientos decrecientes. Falta el texto completo: dosis mínima (≈4 series fraccionales), bandas de eficiencia, límites |
| Pelland et al. 2024, preprint SportRxiv 460 | Preprint (versión previa probable de la anterior) | Leído en una revisión previa | Referencia secundaria; de aquí vienen 67 estudios y 2 058 personas, que no se copian a la versión publicada | V1 (comparar cifras entre versiones) |
| Remmert, Pelland, Robinson, Hinson y Zourdos 2025, preprint SportRxiv, DOI `10.51224/SRXIV.537` | Preprint; la página no enlaza versión revisada | Resumen y ficha leídos el 2026-10-10 y 2026-10-11 | ≈11 series fraccionales por sesión sin ventaja detectable para hipertrofia; ≈2 directas para fuerza (ambas confirmadas en el resumen); advertencia de pocos datos con volúmenes altos | **V3**: si ya se publicó en una revista (la página solo muestra la versión 1, 2025-04-02; no probado que no exista) |
| Krieger 2017, *Set Volume for Muscle Size* | Guía de pago en Weightology.net, no revisada por pares; citada en el preprint | No abierta | Referencia previa de ≈6 a 8 series por sesión | **V2**: la cifra no se comprobó |
| Schoenfeld, Grgic, Haun, Itagaki y Helms 2019, *Sports* 7(7):177, DOI `10.3390/sports7070177` (perspectiva) | Publicado, acceso abierto | Texto leído (parte principal), 2026-10-11 | Pregunta distinta: cómo contar series multiarticulares frente a monoarticulares para los músculos que son motores principales. Aconseja 1:1 para ellos hasta tener más datos y sugiere contar una fracción de serie para los sinergistas (p. ej. tríceps en el press de banca). No contradice el 0.5. | **V4 cerrada (2026-10-11)**. Se corrigió la lectura anterior, que la daba «en contra de 0.5» |

## Cómo cerrar una verificación

1. Abrir la fuente (DOI o enlace) y comprobar cada punto de la columna "Verificación pendiente".
2. En `js/evidence.js`: corregir el texto, quitar la marca `PENDIENTE-VERIFICAR (Vn)` y sacar `Vn` de `pending` en esa ficha. Una prueba exige que cada marca esté en `pending` y al revés.
3. Si V1 queda cerrada y respalda el 0.5 (V4 ya está cerrada), recién entonces `secondaryCredit` puede pasar a `origin: "evidence"` con `basedOn: ["indirect-set-counting"]`.
4. Actualizar la fecha `lastReviewed` de la ficha y esta tabla.
