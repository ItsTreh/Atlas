/* The muscle selection: the single state the anatomy, programs and scheduler share. */
import { beforeEach, describe, expect, test } from "vitest";
import { loadApp } from "./load-app.js";

const app = loadApp();
let sel;
beforeEach(() => { sel = new app.MuscleSelection(app.MUSCLES); });
const program = id => app.PROGRAM_BY_ID.get(id);

describe("selecting muscles", () => {
  test("toggle selects and deselects", () => {
    sel.toggle("chest");
    expect(sel.has("chest")).toBe(true);
    sel.toggle("chest");
    expect(sel.has("chest")).toBe(false);
  });

  test("muscles() is in catalogue order, not click order", () => {
    sel.toggle("calves"); sel.toggle("chest");
    expect(sel.muscles().map(m => m.id)).toEqual(["chest", "calves"]);
  });

  test("an unknown muscle id is refused", () => {
    expect(() => sel.set("wings", true)).toThrow();
  });

  test("every change is announced once; no-ops are not", () => {
    let calls = 0;
    sel.onChange(() => calls++);
    sel.set("chest", true);
    sel.set("chest", true);
    expect(calls).toBe(1);
  });
});

describe("programs stay editable", () => {
  test("applying a program replaces the selection", () => {
    sel.toggle("calves");
    sel.applyProgram(program("push"));
    expect(sel.muscles().map(m => m.id)).toEqual(["chest", "shoulders", "triceps"]);
    expect(sel.source().kind).toBe("program");
  });

  test("editing after a program keeps it as the base, with the difference", () => {
    sel.applyProgram(program("pull"));
    sel.toggle("abs");
    sel.toggle("forearms");
    const src = sel.source();
    expect(src.kind).toBe("modified");
    expect(src.program.id).toBe("pull");
    expect(src.added.map(m => m.id)).toEqual(["abs"]);
    expect(src.removed.map(m => m.id)).toEqual(["forearms"]);
  });

  test("a selection built by hand that equals a program is that program", () => {
    sel.toggle("triceps"); sel.toggle("chest");
    expect(sel.source().kind).toBe("program");
    expect(sel.source().program.id).toBe("chest-triceps");
  });

  test("emptying the selection forgets the program", () => {
    sel.applyProgram(program("chest-triceps"));
    sel.toggle("chest"); sel.toggle("triceps");
    expect(sel.source().kind).toBe("empty");
    sel.toggle("abs");
    expect(sel.source().kind).toBe("custom");
  });
});

describe("hand-off", () => {
  test("snapshot and restore round-trip, dropping unknown ids", () => {
    sel.applyProgram(program("push"));
    sel.toggle("abs");
    const snap = sel.snapshot();
    expect(snap).toEqual({ muscleIds: ["chest", "shoulders", "triceps", "abs"],
                           programId: "push", modified: true });

    const other = new app.MuscleSelection(app.MUSCLES);
    other.restore({ ...snap, muscleIds: [...snap.muscleIds, "wings"] });
    expect(other.snapshot()).toEqual(snap);
  });
});
