/* ===========================================================================
   Evidence and planner parameters — data only, no page code.

   Two different things live here, kept apart on purpose:

     EVIDENCE         what the research says and how sure it is: a finding,
                      its sources, its limits, when it was last reviewed.
     PLANNER_CONFIG   what ATLAS decides to do about it: a value the planner
                      reads, where it comes from, and the evidence behind it.

   A decision never inherits the certainty of the evidence that motivates it.
   "Frequency shows no clear advantage when volume is equal" is a finding;
   "a block repeats at most twice a week" is a decision, and it is labelled as
   one.

   Every parameter carries an origin (ORIGINS):

     evidence      a documented source justifies this specific value
     heuristic     a practical starting value with no direct support
     preference    the user's own choice
     optimization  a rule of thumb for ranking or fitting plans
     safety        a limit the planner never passes

   RULE: do not invent evidence. A parameter may be labelled "evidence" only
   when a documented source in EVIDENCE justifies that specific value, and its
   note says how. Today none is: the research supports directions (more
   weekly sets help, with diminishing returns), not these numbers. Mistakes in
   this file are reported in the console at load.

   To add a finding: add it to EVIDENCE with at least one source opened and
   read. To add a parameter: add it to PLANNER_CONFIG (a value the code reads
   through configValue) or to PLANNER_TABLES (a table kept in another file),
   then label it.
   ========================================================================= */

const CERTAINTY = Object.freeze(["high", "medium", "low"]);
const ORIGINS = Object.freeze(["evidence", "heuristic", "preference", "optimization", "safety"]);

/* ================================ evidence ================================ */

const EVIDENCE = Object.freeze([
  {
    id: "weekly-volume",
    topic: "Weekly sets per muscle",
    finding: "More weekly sets per muscle are associated with more growth, with " +
             "diminishing returns. The step from about 8 to about 16 sets gives a small, " +
             "real gain; in trained lifters, going past about 16 to 20 direct sets has " +
             "shown no further growth.",
    certainty: "high",
    limits: "The direction is well supported; the exact numbers are not. A 67-study " +
            "meta-regression (the volume analysis used 35 studies, 1,032 people) found " +
            "about 0.24% more growth per extra set on a curve that flattens, a smallest " +
            "detectable effect of 2.05%, and thin data above about 25 sets. The position " +
            "stand finds growth enhanced at about 10 sets or more but does not describe " +
            "diminishing returns. The 8 to 16 step comes from a preprint. The trials past " +
            "16 to 20 sets are small and short, almost all quads in men, so they rule out " +
            "a large extra gain, not any gain.",
    sources: [
      { label: "Pelland et al. 2026, Sports Medicine 56(2):481-505",
        url: "https://doi.org/10.1007/s40279-025-02344-w" },
      { label: "ACSM Position Stand 2026, Medicine & Science in Sports & Exercise",
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/" },
      { label: "Schoenfeld, Ogborn and Krieger 2017, Journal of Sports Sciences",
        url: "https://doi.org/10.1080/02640414.2016.1210197" },
      { label: "Robinson et al. 2025, preprint (8 vs 16 sets)",
        url: "https://www.biorxiv.org/content/10.1101/2025.07.24.666533v1" },
      { label: "Barsuhn et al. 2025, Journal of Applied Physiology (habitual vs +30% and +60%)",
        url: "https://doi.org/10.1152/japplphysiol.00476.2024" },
      { label: "Räntilä and Ahtiainen 2026, Journal of Science in Sport and Exercise (about 40 vs about 60 sets)",
        url: "https://doi.org/10.1007/s42978-026-00387-7" }
    ],
    lastReviewed: "2026-10-29"
  },
  {
    id: "maintenance-volume",
    topic: "Keeping muscle with less training",
    finding: "Holding muscle takes far fewer sets than building it, as long as the load " +
             "and effort stay high. Muscles left untrained can shrink.",
    certainty: "medium",
    limits: "Young adults kept fibre size on 3 sets a week for 32 weeks after cutting " +
            "from 27, though thigh lean mass began slipping after 16 weeks; older adults " +
            "kept it on neither dose and need about 2 sessions a week. Untrained muscles " +
            "shrank in novices, mainly in those eating too little. No trial tests " +
            "maintenance in long-term trained lifters or during a calorie deficit.",
    sources: [
      { label: "Bickel, Cross and Bamman 2011, Medicine & Science in Sports & Exercise",
        url: "https://pubmed.ncbi.nlm.nih.gov/21131862/" },
      { label: "Spiering et al. 2021, Journal of Strength and Conditioning Research (review)",
        url: "https://pubmed.ncbi.nlm.nih.gov/33629972/" },
      { label: "Van Vossel et al. 2024, Medicine & Science in Sports & Exercise (untrained muscles shrank)",
        url: "https://doi.org/10.1249/MSS.0000000000003475" }
    ],
    lastReviewed: "2026-10-29"
  },
  {
    id: "frequency",
    topic: "Training frequency per muscle",
    finding: "With weekly volume equal, training a muscle once, twice or three times " +
             "a week gives similar growth. The effect of frequency itself is compatible " +
             "with negligible.",
    certainty: "medium",
    limits: "Most trials are short. A 2 vs 4 sessions a week trial analysed 21 people and " +
            "could not rule out a small difference. Frequency can still matter as a way " +
            "to spread volume across sessions.",
    sources: [
      { label: "Grgic, Schoenfeld and Latella 2019, Journal of Science and Medicine in Sport",
        url: "https://doi.org/10.1016/j.jsams.2018.09.223" },
      { label: "Hamarsland et al. 2022, Frontiers in Physiology",
        url: "https://doi.org/10.3389/fphys.2021.789403" },
      { label: "Pelland et al. 2024, preprint",
        url: "https://sportrxiv.org/index.php/server/preprint/view/460" }
    ],
    lastReviewed: "2026-10-08"
  },
  {
    id: "proximity-to-failure",
    topic: "Proximity to failure",
    finding: "Sets taken closer to failure were associated with more growth; for " +
             "strength the relationship was negligible.",
    certainty: "low",
    limits: "Exploratory meta-regressions. Repetitions in reserve were estimated from " +
            "each study's description, not measured. Closer to failure also lengthens " +
            "recovery.",
    sources: [
      { label: "Robinson et al. 2024, Sports Medicine",
        url: "https://doi.org/10.1007/s40279-024-02069-2" }
    ],
    lastReviewed: "2026-10-08"
  },
  {
    id: "rest-interval",
    topic: "Rest between sets",
    finding: "Resting more than 60 seconds gave a small benefit, and no appreciable " +
             "difference appeared beyond 90 seconds.",
    certainty: "low",
    limits: "Nine studies, mostly of the thigh. Every credible interval of the " +
            "controlled comparisons crossed zero, so the evidence for longer rest is weak.",
    sources: [
      { label: "Singer et al. 2024, Frontiers in Sports and Active Living",
        url: "https://doi.org/10.3389/fspor.2024.1429789" }
    ],
    lastReviewed: "2026-10-08"
  },
  {
    id: "range-of-motion",
    topic: "Range of motion and muscle length",
    finding: "Differences between full and partial range of motion are trivial to " +
             "small. Full or long range may give slightly more.",
    certainty: "low",
    limits: "The possible benefit of partial reps at long muscle lengths comes from an " +
            "exploratory subgroup analysis whose interval includes zero.",
    sources: [
      { label: "Wolf et al. 2023, International Journal of Strength and Conditioning",
        url: "https://doi.org/10.47206/ijsc.v3i1.182" }
    ],
    lastReviewed: "2026-10-08"
  },
  {
    id: "recovery-between-sessions",
    topic: "Recovery between sessions for the same muscle",
    finding: "Lower-body work tends to need about 48 to 72 hours and upper-body work " +
             "24 hours or less. Failure training, high volume and multi-joint or " +
             "long-muscle-length exercises lengthen recovery.",
    certainty: "low",
    limits: "A narrative review of 24 studies. Recovery was mostly inferred from " +
            "performance, and the authors say the literature is not yet at a " +
            "confidently prescriptive stage.",
    sources: [
      { label: "Sousa et al. 2024, Journal of Human Kinetics",
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11057610" }
    ],
    lastReviewed: "2026-10-08"
  },
  {
    id: "indirect-set-counting",
    topic: "Counting sets where a muscle only assists",
    finding: "A squat or a press does not work every assisting muscle as much as the " +
             "main one, so counting its sets 1 to 1 for each muscle overstates the work.",
    certainty: "low",
    limits: "The sources disagree on the remedy: a 2019 review advises counting 1 to 1 " +
            "until there is more data, while the best-fitting model in a 2024 preprint " +
            "counts indirect sets fractionally.",
    sources: [
      { label: "Schoenfeld et al. 2019, Sports",
        url: "https://doi.org/10.3390/sports7070177" },
      { label: "Pelland et al. 2024, preprint",
        url: "https://sportrxiv.org/index.php/server/preprint/view/460" }
    ],
    lastReviewed: "2026-10-08"
  },

  /* Measured regional growth from one exercise: the basis of SET_CREDIT
     (set-credit.js). Almost all in untrained young adults, small groups, but
     measured rather than assumed (docs/training-evidence.md, "Indirect sets"). */
  {
    id: "squat-regional-growth",
    topic: "What a deep squat grows",
    finding: "Deep squats grew the glutes (+6.7%), the adductors (+6.2%) and the quads " +
             "(+4.9%); half squats gave about half as much each. No hamstring muscle changed.",
    certainty: "low",
    limits: "One trial in untrained young men, back squats only. The adductors were " +
            "measured together, the adductor magnus among them.",
    sources: [
      { label: "Kubo et al. 2019, European Journal of Applied Physiology",
        url: "https://doi.org/10.1007/s00421-019-04181-y" }
    ],
    lastReviewed: "2026-10-30"
  },
  {
    id: "squat-vs-hip-thrust",
    topic: "Squats and hip thrusts compared",
    finding: "Barbell back squats and barbell hip thrusts grew the glutes about equally. " +
             "Neither grew the hamstrings more than negligibly; hip thrusts grew the quads " +
             "and adductors less.",
    certainty: "low",
    limits: "One trial, untrained adults. The catalogue has no barbell hip thrust, so only " +
            "the squat side is used.",
    sources: [
      { label: "Plotkin et al. 2023, Frontiers in Physiology",
        url: "https://doi.org/10.3389/fphys.2023.1279170" }
    ],
    lastReviewed: "2026-10-30"
  },
  {
    id: "leg-press-regional-growth",
    topic: "What a leg press grows",
    finding: "Leg presses grew the glutes (+15.4%) and the adductor magnus (+6.2%), but " +
             "the rectus femoris only +1.1%, against +13.2% from knee extensions.",
    certainty: "low",
    limits: "A single trial, not yet replicated, on a seated leg press machine; the " +
            "catalogue's 45-degree leg press was not measured.",
    sources: [
      { label: "Kinoshita, Maeo et al. 2026, Medicine & Science in Sports & Exercise",
        url: "https://doi.org/10.1249/MSS.0000000000003957" }
    ],
    lastReviewed: "2026-10-30"
  },
  {
    id: "press-triceps-growth",
    topic: "What bench pressing gives the triceps",
    finding: "Barbell bench pressing grew the triceps about half as much as triceps extensions " +
             "(0.51), or 0.55 to 0.57 of what it grew the chest. The long head barely grew " +
             "(+2.1% against +17.5% with extensions, about 0.12).",
    certainty: "low",
    limits: "Two trials, both in untrained men.",
    sources: [
      { label: "Brandão et al. 2020, Journal of Strength and Conditioning Research",
        url: "https://doi.org/10.1519/JSC.0000000000003550" },
      { label: "Ogasawara et al. 2013, European Journal of Applied Physiology",
        url: "https://doi.org/10.1007/s00421-012-2511-9" }
    ],
    lastReviewed: "2026-10-30"
  },
  {
    id: "pull-biceps-growth",
    topic: "What rows and pulldowns give the biceps",
    finding: "One-arm dumbbell rows grew the elbow flexors 0.47 as much as curls; wide-grip " +
             "lat pulldowns about as much as curls.",
    certainty: "low",
    limits: "Two small trials that disagree.",
    sources: [
      { label: "Mannarino et al. 2021, Journal of Strength and Conditioning Research",
        url: "https://doi.org/10.1519/JSC.0000000000003234" },
      { label: "Gentil et al. 2015, Asian Journal of Sports Medicine",
        url: "https://doi.org/10.5812/asjsm.24057" }
    ],
    lastReviewed: "2026-10-30"
  },
  {
    id: "calf-raise-knee-angle",
    topic: "Calf raises with the knee straight or bent",
    finding: "Standing calf raises grew the gastrocnemius 9 to 12% and the soleus 2.1%. " +
             "Seated calf raises grew the gastrocnemius only 0.6 to 1.7%, the soleus 2.9%. " +
             "The whole calf grew 5.6% standing and 2.1% seated.",
    certainty: "low",
    limits: "One trial, on standing and seated calf raise machines.",
    sources: [
      { label: "Kinoshita et al. 2023, Frontiers in Physiology",
        url: "https://doi.org/10.3389/fphys.2023.1272106" }
    ],
    lastReviewed: "2026-10-30"
  },
  {
    id: "hip-extension-hamstrings",
    topic: "Hip extension work for the hamstrings",
    finding: "A 45-degree hip extension grew the long head of the biceps femoris more " +
             "than Nordic curls did.",
    certainty: "low",
    limits: "One trial, read in abstract only.",
    sources: [
      { label: "Bourne et al. 2017, British Journal of Sports Medicine",
        url: "https://doi.org/10.1136/bjsports-2016-096130" }
    ],
    lastReviewed: "2026-10-29"
  },
  {
    id: "leg-curl-hamstrings",
    topic: "Seated and lying leg curls",
    finding: "Seated leg curls grew the hamstrings more than lying ones (+14% against +9%).",
    certainty: "low",
    limits: "One trial, read in abstract only.",
    sources: [
      { label: "Maeo et al. 2021, Medicine & Science in Sports & Exercise",
        url: "https://doi.org/10.1249/MSS.0000000000002523" }
    ],
    lastReviewed: "2026-10-29"
  }
]);

const EVIDENCE_BY_ID = new Map(EVIDENCE.map(e => [e.id, e]));

/* ================================= config ================================= */

/**
 * Values the code reads. `group` says which constants object takes it
 * (WORKOUT in workouts.js, ESTIMATE in estimate.js); a test keeps the groups
 * and those objects in step.
 */
const PLANNER_CONFIG = Object.freeze({
  setsPerExercise: {
    group: "workout", value: 3, origin: "heuristic", basedOn: [],
    note: "Typical working sets for one exercise."
  },
  maxSetsPerExercise: {
    group: "workout", value: 4, origin: "heuristic", basedOn: [],
    note: "Past this, a second exercise does the job better."
  },
  minDirectSets: {
    group: "workout", value: 2, origin: "heuristic", basedOn: [],
    note: "A selected muscle always gets at least one exercise of this size."
  },
  maxSetsPerSession: {
    group: "workout", value: 8, origin: "heuristic", basedOn: ["weekly-volume"],
    note: "Most sets one muscle gets in a session on a split day. It was set as a " +
          "middle of 6 to 10 hard sets a session; no primary source for that figure " +
          "has been verified, so it is a heuristic."
  },
  secondaryCredit: {
    group: "workout", value: 0.5, origin: "heuristic", basedOn: ["indirect-set-counting"],
    note: "A set where the muscle only assists counts as half. The sources disagree " +
          "(see the finding), so this value must stay easy to change."
  },
  repeatDemotion: {
    group: "workout", value: 1, origin: "optimization", basedOn: [],
    note: "Tier steps an exercise drops once used this week, so equal-tier " +
          "alternatives rotate in."
  },
  offDayDemotion: {
    group: "workout", value: 1, origin: "optimization", basedOn: ["recovery-between-sessions"],
    note: "Tier steps for an exercise that also works a muscle trained on another " +
          "day, so that muscle is not quietly trained the day before its own session."
  },
  workSetMinutes: {
    group: "estimate", value: 0.75, origin: "heuristic", basedOn: [],
    note: "Doing one set: about ten controlled reps plus getting into position under the " +
          "weight. Not taken from a study."
  },
  restCompoundMinutes: {
    group: "estimate", value: 3, origin: "heuristic", basedOn: ["rest-interval"],
    note: "Rest after a set of a compound lift. Chosen by the project owner from gym " +
          "practice (2.5 to 3 minutes). The research above found no clear hypertrophy " +
          "benefit past about 60 to 90 seconds, so this is about performance and " +
          "realistic session length, not a requirement."
  },
  restIsolationMinutes: {
    group: "estimate", value: 2.5, origin: "heuristic", basedOn: ["rest-interval"],
    note: "Rest after a set of an isolation lift, at the low end of the owner's 2.5 to 3 " +
          "minute range. Same caveat as the compound rest."
  },
  setupMinutes: {
    group: "estimate", value: 2, origin: "heuristic", basedOn: [],
    note: "Per exercise, not per set: fetching the weights or setting the machine, finding " +
          "the spot, a first light set. Not taken from a study."
  },
  minutesPerSet: {
    group: "estimate", origin: "heuristic", basedOn: ["rest-interval"],
    // The average cost of a set when the exercise is not known yet: doing it,
    // the mean of the two rests, and the setup shared over a typical exercise.
    value: Math.round((0.75 + (3 + 2.5) / 2 + 2 / 3) * 10) / 10,
    note: "Planning average for one working set before the exercises are chosen: the set " +
          "itself, the mean of the two rests, and one exercise's setup shared over " +
          "setsPerExercise sets. Finished sessions are timed exercise by exercise."
  },
  warmupMinutes: {
    group: "estimate", value: 10, origin: "heuristic", basedOn: [],
    note: "Per session, not available for working sets."
  },
  weeklyTargets: {
    group: "target", origin: "heuristic", basedOn: ["weekly-volume", "maintenance-volume"],
    // Hard sets a week, by kind of muscle (Muscle.kind) and priority: the
    // target the plan aims for, and the floor a short week may trim it to.
    // The ceiling is the most any priority may reach.
    value: Object.freeze({
      main: Object.freeze({
        ceiling: 18,
        maintain: Object.freeze({ floor: 3,  target: 4 }),
        normal:   Object.freeze({ floor: 8,  target: 10 }),
        focus:    Object.freeze({ floor: 12, target: 14 })
      }),
      accessory: Object.freeze({
        ceiling: 6,
        maintain: Object.freeze({ floor: 2, target: 2 }),
        normal:   Object.freeze({ floor: 4, target: 4 }),
        focus:    Object.freeze({ floor: 6, target: 6 })
      })
    }),
    note: "Planning defaults, not prescriptions (docs/training-evidence.md, \"Weekly " +
          "budgets\"). Main muscles: Maintain 4 with a floor of 3 (3 sets held young " +
          "adults' fibre size; 4 is the smallest dose with detectable growth); Normal " +
          "10 within 8 to 12 (growth is enhanced at about 10 or more); Focus 14 within " +
          "12 to 18 (the 8 to 16 step is detectable, nothing more has been shown past " +
          "about 18 in trained lifters, so 18 is a ceiling, not a safety limit). The " +
          "accessory scale (traps, forearms, adductors, obliques, lower back) is a " +
          "design choice: no dose data exist for them. Experience does not change these " +
          "numbers: no status-specific curve has been found."
  }
});

/**
 * Parameters whose values live in tables in other files. They are labelled
 * here so every parameter has an origin; moving their values into this file is
 * a later step.
 */
const PLANNER_TABLES = Object.freeze({
  muscleKind: {
    at: "model.js, MUSCLE_SEED (kind)", origin: "heuristic", basedOn: [],
    note: "Which scale of weeklyTargets a muscle uses. Main for the eleven groups users " +
          "usually target; accessory for traps, forearms, adductors, obliques and lower " +
          "back, which have no dose data and get large credit from compound lifts. A " +
          "design choice, not a finding that small muscles need less."
  },
  muscleMinutes: {
    at: "model.js, MUSCLE_SEED (min)", origin: "heuristic", basedOn: [],
    note: "How much of a session a muscle takes."
  },
  recoveryDays: {
    at: "model.js, MUSCLE_SEED (rec)", origin: "heuristic", basedOn: ["recovery-between-sessions"],
    note: "Whole days before a muscle is trained again: 2 for big muscles, 1 for small."
  },
  liftKinds: {
    at: "workouts.js, LIFT_KINDS", origin: "heuristic", basedOn: ["rest-interval"],
    note: "Repetition and rest ranges for compound and isolation lifts. Compatible " +
          "with the rest evidence, which only asks for more than 60 seconds."
  },
  distributionRules: {
    at: "distribution.js", origin: "heuristic", basedOn: ["frequency", "weekly-volume"],
    note: "How often a muscle trains and on which days: frequency from the sets a session " +
          "can hold, extra sessions for Focus then Normal muscles only while each session " +
          "keeps four sets or more, and a fixed order of tie-breaks for the days. The " +
          "research does not show a best frequency at equal volume; this spreads the " +
          "volume, it is not a finding."
  },
  schedulerScore: {
    at: "scheduler.js, SCORE", origin: "optimization", basedOn: ["recovery-between-sessions"],
    note: "Weights tuned against each other to place sessions; not taken from research."
  },
  setCredit: {
    at: "set-credit.js, SET_CREDIT", origin: "heuristic",
    basedOn: ["squat-regional-growth", "squat-vs-hip-thrust", "leg-press-regional-growth",
              "press-triceps-growth", "pull-biceps-growth", "calf-raise-knee-angle",
              "hip-extension-hamstrings", "leg-curl-hamstrings"],
    note: "How much a set of an exercise counts for each muscle, for the exercises whose " +
          "growth was measured; unmeasured variants keep the flat default. The measured " +
          "ratios are rounded to 1, 0.5, 0.25 or 0, a scale ATLAS chose; each row carries " +
          "its own tier. Not yet read by the planner."
  },
  exerciseTiers: {
    at: "exercises.js, EXERCISE_RATINGS", origin: "heuristic", basedOn: [],
    note: "Tier lists copied as supplied to the project. Their source is not " +
          "documented, and six muscles have none."
  }
});

/** The value of a PLANNER_CONFIG entry. Unknown names fail loudly. */
function configValue(key) {
  const entry = PLANNER_CONFIG[key];
  if (!entry) throw new Error("Planner config has no parameter named " + key);
  return entry.value;
}

/* ============================== validation =============================== */

(function checkEvidence() {
  const problem = msg => console.error("Evidence data: " + msg);
  const seen = new Set();
  for (const e of EVIDENCE) {
    if (seen.has(e.id)) problem("finding " + e.id + " appears twice");
    seen.add(e.id);
    if (!CERTAINTY.includes(e.certainty)) problem(e.id + " has unknown certainty " + e.certainty);
    if (!e.sources.length) problem(e.id + " has no source");
    for (const s of e.sources)
      if (!/^https:\/\//.test(s.url)) problem(e.id + " has a source without an https link: " + s.label);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.lastReviewed)) problem(e.id + " has no review date");
  }

  const label = (name, p) => {
    if (!ORIGINS.includes(p.origin)) problem(name + " has unknown origin " + p.origin);
    if (!p.note) problem(name + " has no note");
    for (const id of p.basedOn)
      if (!EVIDENCE_BY_ID.has(id)) problem(name + " is based on unknown evidence " + id);
    if (p.origin === "evidence" && !p.basedOn.length)
      problem(name + " is labelled evidence but cites none");
  };
  for (const [name, p] of Object.entries(PLANNER_CONFIG)) {
    label(name, p);
    if (!["workout", "estimate", "target"].includes(p.group)) problem(name + " has unknown group " + p.group);
  }
  for (const [name, p] of Object.entries(PLANNER_TABLES)) label(name, p);
})();
