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
   muscle for it (the neck, the hip flexors, the serratus anterior).
   The form — the armature under the muscles, hands, feet, bone and tendon — is the region "body" and
   is never selectable.

   To make a muscle selectable in finer detail later, give it its own id in
   MUSCLES and point its regions at it; the model does not change.

   A group region stands for several anatomical ones where a sculpture does
   not separate them: the authored Male_Body's thigh shows the quadriceps as
   one mass, so it is one region there ("quadriceps-femoris"), and likewise
   the hamstrings ("hamstrings") and the adductor group with the gracilis
   ("adductors").
   ========================================================================= */

const ANATOMY_REGIONS = Object.freeze({
  "pectoralis-major":     "chest",
  "deltoid":              "shoulders",
  "triceps-brachii":      "triceps",
  "trapezius":            "traps",
  "infraspinatus":        "upper-back",
  "teres-major":          "upper-back",
  // Only its lower edge shows, between the trapezius, the lat and the shoulder
  // blade; the rest lies under the trapezius.
  "rhomboid-major":       "upper-back",
  "latissimus-dorsi":     "lats",
  "biceps-brachii":       "biceps",
  "brachialis":           "biceps",
  // Beside the biceps' short head, from the same point on the shoulder blade,
  // in the same front compartment of the arm.
  "coracobrachialis":     "biceps",
  "brachioradialis":      "forearms",
  "extensor-carpi-radialis-longus": "forearms",
  "extensor-carpi-radialis-brevis": "forearms",
  "pronator-teres":       "forearms",
  "flexor-carpi-radialis": "forearms",
  "palmaris-longus":      "forearms",
  "flexor-digitorum-superficialis": "forearms",
  "flexor-carpi-ulnaris": "forearms",
  "extensor-carpi-ulnaris": "forearms",
  "extensor-digiti-minimi": "forearms",
  "extensor-digitorum":   "forearms",
  "abductor-pollicis-longus": "forearms",
  "extensor-pollicis-brevis": "forearms",
  // An elbow extensor, but it lies on the forearm and reads as part of it.
  "anconeus":             "forearms",
  "forearm-flexors":      "forearms",
  "forearm-extensors":    "forearms",
  "rectus-femoris":       "quads",
  "vastus-lateralis":     "quads",
  "vastus-medialis":      "quads",
  "sartorius":            "quads",
  "quadriceps-femoris":   "quads",
  "biceps-femoris":       "hamstrings",
  "semitendinosus":       "hamstrings",
  "semimembranosus":      "hamstrings",
  "hamstrings":           "hamstrings",
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
  // Painted, but not a training target: it trains with pushing, not with the
  // obliques beside it. Not selectable until a zoomed anatomy view can show it
  // on its own (see docs/anatomy-levels.md).
  "serratus-anterior":    null,
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
})();

/**
 * Checks a model in the ANATOMY_MODEL shape against the table: every
 * region it calls a muscle must be listed. A model may hold only some of
 * the listed regions, and "form" regions (bone, tendon, a cut) of its own.
 */
function validateAnatomyModel(model) {
  model.regions.forEach((region, i) => {
    if (model.kinds[i] === "muscle" && !(region in ANATOMY_REGIONS))
      console.error("Anatomy region " + region + " is not in ANATOMY_REGIONS");
  });
}
if (typeof ANATOMY_MODEL === "object") validateAnatomyModel(ANATOMY_MODEL);
