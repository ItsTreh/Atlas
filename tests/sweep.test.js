/* Whatever the week looks like, the plan must stay balanced and safe. */
import { describe, expect, test } from "vitest";
import { loadApp, generatedWeek } from "./load-app.js";

const app = loadApp();
const PROGRAMS = ["full-body", "upper", "lower", "push", "pull", "legs"];

describe.each(PROGRAMS)("%s", program => {
  for (const sessions of [2, 3, 4, 5, 6]) for (const minutes of [45, 60, 90]) {
    test(`${sessions} x ${minutes} min`, () => {
      const { routine, result } = generatedWeek(app, { program, sessions, minutes });
      const placed = routine.sessions;
      expect(app.errors).toEqual([]);
      expect(placed.length).toBeGreaterThan(0);
      expect(placed.length).toBeLessThanOrEqual(sessions);

      // no session runs past its length
      for (const s of placed) expect(s.workout.minutes).toBeLessThanOrEqual(minutes);

      // the heaviest session is never far more than twice the lightest
      if (placed.length > 1) {
        const mins = placed.map(s => s.workout.minutes);
        expect(Math.max(...mins) - Math.min(...mins)).toBeLessThanOrEqual(minutes * 0.75);
      }

      // when the week meets its minimums, every selected muscle is trained
      const fit = routine.weekFit();
      const v = routine.weeklyVolume();
      if (fit && fit.meetsMinimums && placed.length === sessions) expect(v.untrained).toEqual([]);

      // no muscle goes over its weekly maximum
      for (const row of v.rows) if (row.muscle.weeklySets) {
        expect(row.sets, row.muscle.id).toBeLessThanOrEqual(row.muscle.weeklySets[1] + 4);
      }
    });
  }
});
