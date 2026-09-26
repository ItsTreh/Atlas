/* ===========================================================================
   Anatomy regions → the app's muscles.

   The sculpture (js/anatomy-model.js) is made of anatomical regions with
   stable names — "pectoralis-major", "vastus-medialis"… — and knows
   nothing about the app. This table is the one bridge between the two: it
   says which of the app's muscles (MUSCLES, model.js) each region belongs
   to. Several regions can make one muscle: selecting Quads lights the
   rectus femoris, both vasti and the sartorius together, and clicking any
   of them selects Quads.

     app muscle id  →  its regions (this table, read backwards)  →  what
     the renderer draws for each region

   null marks a region that is drawn but not selectable: the app has no
   muscle for it (the neck, the hip flexors).
   The form — head, hands, feet, bone and tendon — is the region "body" and
   is never selectable.

   To make a muscle selectable in finer detail later, give it its own id in
   MUSCLES and point its regions at it; the model does not change.
   ========================================================================= */

const ANATOMY_REGIONS = Object.freeze({
  "pectoralis-major":     "chest",
  "deltoid":              "shoulders",
  "triceps-brachii":      "triceps",
  "trapezius":            "traps",
  "infraspinatus":        "upper-back",
  "teres-major":          "upper-back",
  "latissimus-dorsi":     "lats",
  "biceps-brachii":       "biceps",
  "brachialis":           "biceps",
  "brachioradialis":      "forearms",
  "forearm-flexors":      "forearms",
  "forearm-extensors":    "forearms",
  "rectus-femoris":       "quads",
  "vastus-lateralis":     "quads",
  "vastus-medialis":      "quads",
  "sartorius":            "quads",
  "biceps-femoris":       "hamstrings",
  "semitendinosus":       "hamstrings",
  "semimembranosus":      "hamstrings",
  "gluteus-maximus":      "glutes",
  "gluteus-medius":       "glutes",
  "tensor-fasciae-latae": "glutes",
  "adductors":            "adductors",
  "gracilis":             "adductors",
  "gastrocnemius":        "calves",
  "soleus":               "calves",
  "tibialis-anterior":    "calves",
  "fibularis":            "calves",
  "rectus-abdominis":     "abs",
  "external-oblique":     "obliques",
  "serratus-anterior":    "obliques",
  "erector-spinae":       "lower-back",
  "iliopsoas":            null,
  "sternocleidomastoid":  null
});

/* Catch a mismatch at load: a region pointing at a muscle that does not
   exist, or a muscle region of the model that is missing from the table. */
(function validateAnatomyRegions() {
  for (const [region, id] of Object.entries(ANATOMY_REGIONS))
    if (id !== null && !MUSCLE_BY_ID.has(id))
      console.error("Anatomy region " + region + " maps to unknown muscle " + id);
  ANATOMY_MODEL.regions.forEach((region, i) => {
    if (ANATOMY_MODEL.kinds[i] === "muscle" && !(region in ANATOMY_REGIONS))
      console.error("Anatomy region " + region + " is not in ANATOMY_REGIONS");
  });
})();
