# Fuentes del volumen de entrenamiento

Estado a 2026-10-10. Regla del proyecto: ninguna cita entra al código como `evidence` hasta que se abrió la fuente y se comprobó que dice lo que se afirma. Lo no verificado lleva la marca `PENDIENTE-VERIFICAR (Vn)` en `js/evidence.js` (`grep PENDIENTE-VERIFICAR js/evidence.js`).

| Fuente | Estado | Qué se abrió | Para qué se usa | Verificación pendiente |
|---|---|---|---|---|
| Schoenfeld, Ogborn y Krieger 2016, *Journal of Sports Sciences* (metaanálisis de 15 estudios) | Publicado | Leído en una revisión previa (2026-10-08) | Forma de la curva semanal; cifras 5.4 / 6.6 / 9.8 % de crecimiento | ninguna |
| Pelland, Remmert, Robinson, Hinson y Zourdos 2026, *Sports Medicine* 56, DOI `10.1007/s40279-025-02344-w` (metarregresión bayesiana) | Publicado | **No abierto** | Dosis mínima, forma de la curva, conteo fraccional 0.5 | **V1**: método fraccional, nº de estudios, dosis mínima (≈4 series fraccionales), bandas de eficiencia, población |
| Pelland et al. 2024, preprint SportRxiv 460 | Preprint (versión previa probable de la anterior) | Leído en una revisión previa | Referencia secundaria; de aquí vienen 67 estudios y 2 058 personas, que no se copian a la versión publicada | V1 (comparar cifras entre versiones) |
| Remmert, Pelland, Robinson, Hinson y Zourdos 2025, preprint SportRxiv, DOI `10.51224/SRXIV.537` | Preprint; la página no enlaza versión revisada | Resumen y ficha leídos el 2026-10-10 | ≈11 series fraccionales por sesión sin ventaja detectable para hipertrofia; advertencia de pocos datos con volúmenes altos | **V2**: ≈2 series directas para fuerza; **V3**: si ya se publicó en una revista |
| Krieger 2017, metarregresión por sesión | No publicada; solo mencionada dentro del preprint anterior | No abierta | Referencia previa de ≈6 a 8 series por sesión | V2 |
| Schoenfeld et al. 2019, *Sports* (revisión) | Publicado | Resumen leído | Aconseja contar 1 a 1 hasta tener más datos (evidencia en contra de 0.5) | **V4**: ¿trata la misma pregunta? |

## Cómo cerrar una verificación

1. Abrir la fuente (DOI o enlace) y comprobar cada punto de la columna "Verificación pendiente".
2. En `js/evidence.js`: corregir el texto, quitar la marca `PENDIENTE-VERIFICAR (Vn)` y sacar `Vn` de `pending` en esa ficha. Una prueba exige que cada marca esté en `pending` y al revés.
3. Si V1 y V4 quedan cerradas y respaldan el 0.5, recién entonces `secondaryCredit` puede pasar a `origin: "evidence"` con `basedOn: ["indirect-set-counting"]`.
4. Actualizar la fecha `lastReviewed` de la ficha y esta tabla.
