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

   A finding may also carry: studyType, population, ifWrong (what the plan gets
   wrong if the finding is wrong), and pending, the checks still open. Every
   claim not yet verified against its source is marked in the text exactly as
   PENDIENTE-VERIFICAR (V1), with the check's id, so one search finds them all
   (grep PENDIENTE-VERIFICAR). lastReviewed is the last time a source was
   opened for the entry; it never means the pending claims are confirmed.

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
             "diminishing returns. A published meta-regression puts the smallest effective " +
             "dose near 4 fractional weekly sets and finds no clear ceiling in the range " +
             "studied (PENDIENTE-VERIFICAR (V1)).",
    certainty: "high",
    studyType: "Meta-analysis (Schoenfeld 2016) and Bayesian multilevel meta-regression (Pelland)",
    population: "PENDIENTE-VERIFICAR (V1): sex, age and training level of the studies in the " +
                "2026 publication. The 2016 meta-analysis had only 2 studies of trained people.",
    limits: "The direction is well supported; the exact numbers are not. A 15-study " +
            "meta-analysis found about 5.4% growth under 5 weekly sets, 6.6% at 5 to 9 " +
            "and 9.8% at 10 or more, but few studies went past 12 sets, only 2 involved " +
            "trained people, and the result moved when one study was removed. The 2024 " +
            "preprint of 67 studies (2,058 people) agrees on the shape and gives no cap; " +
            "its figures were written down from the preprint and may differ in the " +
            "published version, so none are copied across (PENDIENTE-VERIFICAR (V1)). " +
            "The studies measure mostly large muscles (quadriceps, triceps, biceps).",
    ifWrong: "Weekly targets would be too high or too low for the muscles the research " +
             "covers least; the shape (more helps, less each time) would still hold.",
    pending: ["V1"],
    sources: [
      { label: "Schoenfeld, Ogborn and Krieger 2016, Journal of Sports Sciences",
        url: "https://paulogentil.com/pdf/Dose-response%20relationship%20between%20weekly%20resistance%20training%20volume%20and%20increases%20in%20muscle%20mass%20-%20A%20systematic%20review%20and%20metaanalysis.pdf" },
      { label: "Pelland et al. 2026, Sports Medicine 56 (published version; not opened yet: PENDIENTE-VERIFICAR (V1))",
        url: "https://doi.org/10.1007/s40279-025-02344-w" },
      { label: "Pelland et al. 2024, preprint (earlier version of the same work, probably; secondary reference)",
        url: "https://sportrxiv.org/index.php/server/preprint/view/460" }
    ],
    lastReviewed: "2026-10-08"
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
        url: "https://ro.ecu.edu.au/ecuworkspost2013/5665" },
      { label: "Hamarsland et al. 2022, Frontiers in Physiology",
        url: "https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2021.789403/pdf" },
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
        url: "https://rke.abertay.ac.uk/en/publications/exploring-the-dose-response-relationship-between-estimated-resist/" }
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
        url: "https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1429789/text" }
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
        url: "https://doaj.org/article/99e86b317bec40f5abc2f0008358737e" }
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
             "main one, so counting its sets 1 to 1 for each muscle overstates the work. " +
             "In the published meta-regression, counting indirect sets as half a set fitted " +
             "better than counting them as 1 or as 0 (abstract of the published version).",
    certainty: "low",
    studyType: "Bayesian multilevel meta-regression, 67 studies (abstract of the published version; full text not opened: PENDIENTE-VERIFICAR (V1))",
    population: "2,058 participants, 79.1% male, mean age about 25 (abstract of the published version)",
    limits: "Only the conventions 1, 0.5 and 0 were compared, so 0.5 is the best fit among " +
            "three, not a measured constant, and it is one flat value for every exercise " +
            "and muscle. The 2019 review by Schoenfeld et al. (read in full) does not " +
            "contradict this: it asks how to count multi-joint against single-joint sets for " +
            "the muscles that are prime movers (hamstrings in a squat, for example) and advises " +
            "1 to 1 for those until there is more data. It also suggests that a bench press " +
            "could count as a fraction of a set for the triceps and front deltoids.",
    ifWrong: "Assisted muscles (triceps, biceps, shoulders) would get too many or too few " +
             "direct sets, because their credit from presses and rows would be over- or " +
             "under-counted.",
    pending: ["V1"],
    sources: [
      { label: "Schoenfeld, Grgic, Haun, Itagaki and Helms 2019, Sports 7(7):177",
        url: "https://doi.org/10.3390/sports7070177" },
      { label: "Pelland et al. 2026, Sports Medicine 56 (published version; not opened yet: PENDIENTE-VERIFICAR (V1))",
        url: "https://doi.org/10.1007/s40279-025-02344-w" },
      { label: "Pelland et al. 2024, preprint (earlier version of the same work, probably; secondary reference)",
        url: "https://sportrxiv.org/index.php/server/preprint/view/460" }
    ],
    lastReviewed: "2026-10-11"
  },
  {
    id: "per-session-volume",
    topic: "Sets per session for one muscle",
    finding: "Per-session volume improves growth with diminishing returns. The point where " +
             "no further advantage can be detected is about 11 fractional sets per session " +
             "for hypertrophy. For strength it is about 2 direct sets (both read in the " +
             "abstract). An earlier analysis, a members' guide on Weightology.net that is " +
             "not peer reviewed, is reported to put the threshold at about 6 to 8 sets per " +
             "session (Krieger, 2017; the figure itself is not checked: PENDIENTE-VERIFICAR (V2)).",
    certainty: "low",
    studyType: "Preprint of a meta-regression (not peer reviewed as far as the page shows)",
    population: "PENDIENTE-VERIFICAR (V2)",
    limits: "The 11-set figure was read in the abstract on the preprint page. The authors warn " +
            "that data at very high per-session volumes are limited. It is a point where an " +
            "advantage is no longer detectable, not an optimum and not a safety limit. The " +
            "page lists no journal version; whether one exists elsewhere is not checked " +
            "(PENDIENTE-VERIFICAR (V3)).",
    ifWrong: "Sessions would be shorter than needed, or the last sets of a long session would " +
             "be low quality from fatigue.",
    pending: ["V2", "V3"],
    sources: [
      { label: "Remmert, Pelland, Robinson, Hinson and Zourdos 2025, SportRxiv preprint (doi 10.51224/SRXIV.537)",
        url: "https://sportrxiv.org/index.php/server/preprint/view/537" }
    ],
    lastReviewed: "2026-10-10"
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
    group: "workout", value: 8, origin: "heuristic", basedOn: ["weekly-volume", "per-session-volume"],
    note: "Most sets one muscle gets in a session on a split day, counted as direct sets plus " +
          "half a set for each assisting set (fractional sets). The 8 is a design decision: it " +
          "sits inside the 6 to 11 range the per-session finding mentions and on the " +
          "conservative side, but that finding is a preprint and describes where an " +
          "advantage can no longer be detected, so the value stays a heuristic. Tested at " +
          "8, 10 and 11 on 11 synthetic profiles (docs/sensitivity/per-session-cap.md): no " +
          "effect in 6, a gain of 1 to 3 Focus sets in 3 at a cost of 4 to 16 minutes per " +
          "session, and in one profile other muscles lost their sets. 8 is kept; this does " +
          "not show 8 is right, only that 10 or 11 is not clearly better."
  },
  secondaryCredit: {
    group: "workout", value: 0.5, origin: "heuristic", basedOn: ["indirect-set-counting"],
    note: "A set where the muscle only assists counts as half. The sources disagree " +
          "(see the finding), and the published support for 0.5 has not been opened yet " +
          "(PENDIENTE-VERIFICAR (V1)), so it stays a heuristic and easy to change. It becomes " +
          "evidence only after V1 is closed (V4 is closed: the 2019 review does not contradict 0.5)."
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
  indirectRecoveryFraction: {
    group: "workout", value: 0.5, origin: "heuristic", basedOn: ["recovery-between-sessions"],
    note: "Share of a muscle's recovery days needed between two sessions when one of them only " +
          "assists it (a row assisting the biceps) instead of training it. The recovery research " +
          "is thin and does not cover assisting work, so this is an adjustable guess. It is a recovery " +
          "fraction between sessions, not a set-counting one: the volume evidence behind " +
          "secondaryCredit does not support it."
  },
  functionRepeatDemotion: {
    group: "workout", value: 2, origin: "heuristic", basedOn: [],
    note: "Tier steps for an exercise that does the same job as one the session already has for " +
          "this muscle (a leg press after a squat, for the glutes), so a Focus muscle gets " +
          "different jobs before a second copy of one. Only for glutes, shoulders and upper back, " +
          "where the catalogue labels what each movement does. Not taken from a study."
  },
  dislikeDemotion: {
    group: "workout", value: 2, origin: "preference", basedOn: [],
    note: "Tier steps an exercise drops once the user says they don't like it. It can still " +
          "appear when nothing better is left; only an exercise the user can't do is kept out."
  },
  interferenceDemotion: {
    group: "workout", value: 1, origin: "heuristic", basedOn: [],
    note: "Tier steps for an exercise that tires a muscle another lift in the session " +
          "depends on while that lift tires this one's helpers in turn, so neither can be " +
          "put first without holding the other back. Not taken from a study."
  },
  rirCompound: {
    group: "effort", value: "1–2", origin: "heuristic", basedOn: ["proximity-to-failure"],
    note: "Reps to leave in reserve on a compound lift. The research above links sets " +
          "closer to failure with more growth, but also with longer recovery, and heavy " +
          "multi-joint lifts cost the most. Kept a little short of failure; not a study value."
  },
  rirIsolation: {
    group: "effort", value: "0–1", origin: "heuristic", basedOn: ["proximity-to-failure"],
    note: "Reps to leave in reserve on an isolation lift: one machine or cable movement " +
          "is cheap to recover from, so the last set can go to or near failure."
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
  weeklyTargetFraction: {
    group: "target", origin: "heuristic", basedOn: ["weekly-volume"],
    // Where in a muscle's weekly range [low, high] the target lands:
    // low + fraction * (high - low), by experience and priority.
    value: Object.freeze({
      beginner:     Object.freeze({ maintain: 0, normal: 0,   focus: 0.5 }),
      intermediate: Object.freeze({ maintain: 0, normal: 0.5, focus: 0.8 }),
      advanced:     Object.freeze({ maintain: 0, normal: 0.5, focus: 1.0 })
    }),
    note: "Newer lifters start at the low end of each range, which the volume research " +
          "supports in direction (more sets help with diminishing returns) but not in " +
          "these exact numbers. Maintain is the bottom of the range by definition. The " +
          "fractions are a starting point to adjust, not findings. The shape of the curve is " +
          "supported; the per-muscle ranges and these factors are extrapolations."
  }
});

/**
 * Parameters whose values live in tables in other files. They are labelled
 * here so every parameter has an origin; moving their values into this file is
 * a later step.
 */
const PLANNER_TABLES = Object.freeze({
  weeklySetsRange: {
    at: "model.js, MUSCLE_SEED (sets/week)", origin: "heuristic", basedOn: ["weekly-volume"],
    note: "Per-muscle ranges of hard sets a week, read as a common reading of the " +
          "volume research. The numbers are not taken from a single study. The research " +
          "covers large muscles best; ranges for trapezius, forearms, adductors and lower " +
          "back are extrapolated. Some muscles may respond to more than the range (the " +
          "triceps in one sub-analysis; PENDIENTE-VERIFICAR (V1))."
  },
  weeklySetsMaximum: {
    at: "model.js, MUSCLE_SEED (high end of sets/week)", origin: "safety", basedOn: [],
    note: "The high end of each range is a limit the planner never passes."
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
    for (const k of ["studyType", "population", "ifWrong"])
      if (k in e && (typeof e[k] !== "string" || !e[k].trim())) problem(e.id + " has an empty " + k);
    // Every open check must be marked in the text, so a search finds it.
    const text = [e.finding, e.limits, e.population || "", e.studyType || ""].join(" ");
    for (const id of e.pending || []) {
      if (!/^V\d+$/.test(id)) problem(e.id + " has a malformed pending check " + id);
      else if (!text.includes("PENDIENTE-VERIFICAR (" + id + ")")) problem(e.id + " lists " + id + " as pending but does not mark it");
    }
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
    if (!["workout", "estimate", "target", "effort"].includes(p.group)) problem(name + " has unknown group " + p.group);
  }
  for (const [name, p] of Object.entries(PLANNER_TABLES)) label(name, p);
})();
