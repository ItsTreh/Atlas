/* ===========================================================================
   What the generated week is missing, and how a session is named.

   The Week plan (week-view.js) says under the generated week what it falls
   short of: a block no day could hold (leftOutText), muscles whose session
   was removed, and muscles under their usual weekly minimum (volumeNote).
   Every figure is the routine's (routine.weeklyVolume); this file only
   words it. Also here: a session's short name and its families.
   ========================================================================= */

const byWeekOrder = (a, b) =>
  DayOfWeek.indexOf(a.day) - DayOfWeek.indexOf(b.day) || a.startHour - b.startHour;

const nameList = names => names.length < 2 ? names.join("")
  : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
const fmtSets = n => (n % 1 ? n.toFixed(1) : String(n));

/** A session's short name: its split day ("Upper"), else the families it trains ("Push + Pull"). */
function blockName(block) {
  if (block.name) return block.name;
  const worked = block.muscles.filter(m => !block.riders.has(m));
  const fams = Object.keys(FAMILIES).filter(f => (worked.length ? worked : block.muscles).some(m => m.family === f));
  if (["push", "pull", "legs"].every(f => fams.includes(f))) return "Full body";
  return fams.map(f => FAMILIES[f].name).join(" + ");
}
/** The families a block works, in catalogue order. */
const blockFamilies = block => Object.keys(FAMILIES).filter(f =>
  block.muscles.some(m => m.family === f && !block.riders.has(m)));

/* --------------------------- what the week misses -------------------------- */

/**
 * What the last generate() left without a day, and why, or "": the blocks no
 * session carries. Plain text; the caller escapes it. Generating again does
 * not change this, so it names what would: a day more, or a smaller split.
 */
function leftOutText() {
  const out = routine.leftOut || [];
  if (!out.length) return "";
  const names = out.map(b => (b.name || "Some muscles") + " (" +
    nameList(b.muscles.filter(m => !b.riders.has(m)).map(m => m.name)) + ")");
  const days = routine.sessions.length, split = SPLITS[routine.split];
  const wanted = new Set(routine.sessions.map(s => s.block)).size + out.length;
  const why = split.days && wanted > days
    ? split.label + " has " + wanted + " days and this week has " + days + " training " +
      (days === 1 ? "day" : "days") + ". Add a training day, or choose a split with fewer days."
    : "No free gap fit it, or its muscles were still inside a recovery window.";
  return "No day this week for " + nameList(names) + ". " + why;
}

/* At most this many names in a volume note before "and N more". */
const VOLUME_NOTE_NAMES = 4;
const someNames = names => names.length <= VOLUME_NOTE_NAMES ? nameList(names)
  : names.slice(0, VOLUME_NOTE_NAMES).join(", ") + " and " + (names.length - VOLUME_NOTE_NAMES) + " more";

/**
 * How the week compares with what the chosen muscles usually need
 * (WeeklyRoutine.weeklyVolume). Muscles left without direct work, or under
 * the low end of their weekly sets, are a warning. Silent when the week meets
 * the estimate. Plain text.
 */
function volumeNote(sessions, v = routine.weeklyVolume()) {
  // Muscles with no session at all are named elsewhere (leftOutText, or a
  // removed session); this note is about the sessions the week does have.
  // Exercises the user took out are theirs to put back, not a lack of time.
  const removed = v.removed.length ? "You took out every exercise for " + nameList(v.removed.map(m => m.name)) +
    ": add one back in its session, or restore the suggestions." : "";
  if (!v.noTime.length && !v.short.length) return removed;
  const parts = removed ? [removed] : [];
  if (v.noTime.length)
    parts.push("No time this week for " + nameList(v.noTime.map(m => m.name)) + ".");
  if (v.short.length)
    parts.push("Under their usual weekly minimum: " +
      someNames(v.short.map(r => r.muscle.name + " (" + fmtSets(r.sets) + " of " + r.need + " sets)")) + ".");
  const e = v.estimate;
  if (e && sessions.length < e.sessions.low)
    parts.push("Your targets usually take " + e.sessions.low + "–" + e.sessions.high + " sessions of " +
      e.sessionMinutes + " min a week; this plan has " + sessions.length + ".");
  // Only the ways out this week really has: a day more is tried on a copy
  // (extraDayFits), and a longer session needs a longer option to pick.
  const ways = [];
  if (routine.extraDayFits()) ways.push("add a training day");
  if (routine.sessionMinutes < Math.max(...SESSION_LENGTH_OPTIONS)) ways.push("lengthen sessions");
  ways.push("pick fewer muscles");
  parts.push("To close the gap, " + (ways.length < 2 ? ways[0]
    : ways.slice(0, -1).join(", ") + " or " + ways[ways.length - 1]) + ".");
  return (removed ? parts.shift() + " " : "") + "Below what your targets usually need. " + parts.join(" ");
}

/** Every gap the generated week has, as plain sentences, for the notes under its summary. */
function weekGaps() {
  const sessions = [...routine.sessions].sort(byWeekOrder);
  if (!sessions.length) return [];
  const v = routine.weeklyVolume();
  // Muscles no session carries at all. Those of a block the plan could not
  // give a day are explained by leftOutText(), and those chosen after the
  // week was generated by the stale-week note; the rest lost their session
  // to the user, and generating again does fit them back in.
  const leftIds = new Set((routine.leftOut || []).flatMap(b => b.muscles.map(m => m.id)));
  const missing = v.unplanned.filter(m => !leftIds.has(m.id) && routine.plannedFor.has(m.id)).map(m => m.name);
  return [
    leftOutText(),
    missing.length ? "Not trained this week: " + nameList(missing) + " — " +
      (missing.length === 1 ? "its session was" : "their sessions were") + " removed. Adjust the plan and build your new week to fit " +
      (missing.length === 1 ? "it" : "them") + " back in." : "",
    volumeNote(sessions, v)
  ].filter(Boolean);
}
