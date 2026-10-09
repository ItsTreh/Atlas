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
             "diminishing returns.",
    certainty: "high",
    limits: "The direction is well supported; the exact numbers are not. A 15-study " +
            "meta-analysis found about 5.4% growth under 5 weekly sets, 6.6% at 5 to 9 " +
            "and 9.8% at 10 or more, but few studies went past 12 sets, only 2 involved " +
            "trained people, and the result moved when one study was removed. A 2024 " +
            "preprint of 67 studies (2,058 people) agrees on the shape and gives no cap.",
    sources: [
      { label: "Schoenfeld, Ogborn and Krieger 2016, Journal of Sports Sciences",
        url: "https://paulogentil.com/pdf/Dose-response%20relationship%20between%20weekly%20resistance%20training%20volume%20and%20increases%20in%20muscle%20mass%20-%20A%20systematic%20review%20and%20metaanalysis.pdf" },
      { label: "Pelland et al. 2024, preprint (no peer review shown on the page)",
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
             "main one, so counting its sets 1 to 1 for each muscle overstates the work.",
    certainty: "low",
    limits: "The sources disagree on the remedy: a 2019 review advises counting 1 to 1 " +
            "until there is more data, while the best-fitting model in a 2024 preprint " +
            "counts indirect sets fractionally.",
    sources: [
      { label: "Schoenfeld et al. 2019, Sports",
        url: "https://doaj.org/article/784eec50dc3d43a4b8b0d235d4c5845c" },
      { label: "Pelland et al. 2024, preprint",
        url: "https://sportrxiv.org/index.php/server/preprint/view/460" }
    ],
    lastReviewed: "2026-10-08"
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
  indirectRecoveryFraction: {
    group: "workout", value: 0.5, origin: "heuristic", basedOn: ["recovery-between-sessions"],
    note: "Share of a muscle's recovery days needed between two sessions when one of them only " +
          "assists it (a row assisting the biceps) instead of training it. The recovery research " +
          "is thin and does not cover assisting work, so this is an adjustable guess."
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
          "fractions are a starting point to adjust, not findings."
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
          "volume research. The numbers are not taken from a single study."
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
