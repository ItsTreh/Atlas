/* --------------------------- click-drag painting -------------------------- */

/* "Shape your week": dragging down a day (or across days) marks those hours
   busy; dragging again over busy hours clears them. Each hour of a day is a
   .paint cell (week-view.js) carrying its day and hour. */

let painting = false, paintMode = null, anchor = null;

function cellUnder(x, y) {
  const el = document.elementFromPoint(x, y);
  return el && el.closest ? el.closest(".paint") : null;
}

/**
 * Applies the current paint mode to the whole rectangle between where the drag
 * started and where the pointer is now.
 *
 * Painting only the cell under the pointer looks fine in a test, where the
 * mouse moves in small steps, and fails for a real person: move the hand at
 * normal speed and the browser reports three or four positions for the whole
 * gesture, leaving most of the range untouched. Filling the rectangle makes the
 * result depend on where the drag started and ended, not on how fast it was.
 */
function paintTo(day, hour) {
  if (!anchor) return;
  const [d1, d2] = [DayOfWeek.indexOf(anchor.day), DayOfWeek.indexOf(day)].sort((a, b) => a - b);
  const [h1, h2] = [anchor.hour, hour].sort((a, b) => a - b);
  for (let di = d1; di <= d2; di++) {
    const d = DayOfWeek.values[di];
    if (routine.isDayUnavailable(d) && paintMode === "busy") continue;   // a day off is not painted
    for (let h = h1; h <= h2; h++) {
      if (paintMode === "busy") routine.markBusy(d, h);
      else if (routine.slot(d, h).state === SlotState.BUSY) routine.clearSlot(d, h);
    }
  }
  paintBusy();                 // only the busy blocks while the drag is under way
}

/** The .paint cell an event landed on, whatever child element it actually hit. */
function cellOf(target) {
  return target && target.closest ? target.closest(".paint") : null;
}

function beginStroke(cell) {
  const day = cell.dataset.day, hour = Number(cell.dataset.hour);
  const slot = routine.slot(day, hour);
  if (!slot) return;
  // A free hour becomes busy; a busy one clears, as the hint under the
  // calendar says. Painting busy over a generated session's hour frees that
  // session's hours (routine.markBusy), which the week then reports.
  paintMode = slot.state === SlotState.BUSY ? "clear" : "busy";
  painting = true;
  anchor = { day, hour };
  paintTo(day, hour);          // the click alone must already do something
}

function endStroke() {
  if (!painting) return;
  painting = false; paintMode = null; anchor = null;
  afterWeekChange();           // the planned days, the fit and the status follow; saved
}

/* Pointer Events are the primary path: one code path for mouse, pen and touch.
   `pointerSeen` records whether they actually reach us, so the mouse-event
   fallback below stays dormant when they do and never double-handles. */
let pointerSeen = false, mouseSeen = false;

weekEl.addEventListener("pointerdown", e => {
  pointerSeen = true;
  const cell = cellOf(e.target);
  if (!cell || (e.pointerType === "mouse" && e.button !== 0)) return;
  e.preventDefault();
  beginStroke(cell);
});

/* Move and up listen on the window, not the calendar: the pointer routinely
   leaves it mid-drag, and this keeps the stroke alive without pointer
   capture. An earlier version called setPointerCapture() here — it throws in
   embedded contexts where the pointer id is not active for the document, and
   because it sat BEFORE the painting call, one throw killed the whole
   interaction: neither click nor drag did anything. */
window.addEventListener("pointermove", e => {
  if (!painting) return;
  const cell = cellUnder(e.clientX, e.clientY);
  if (cell) paintTo(cell.dataset.day, Number(cell.dataset.hour));
});
window.addEventListener("pointerup", endStroke);
window.addEventListener("pointercancel", endStroke);

/* Fallback for any environment that does not deliver Pointer Events to the
   page. Dormant whenever the pointer path works. */
weekEl.addEventListener("mousedown", e => {
  if (pointerSeen) return;
  mouseSeen = true;
  const cell = cellOf(e.target);
  if (!cell) return;
  e.preventDefault();
  beginStroke(cell);
});
window.addEventListener("mousemove", e => {
  if (pointerSeen || !painting) return;
  const cell = cellUnder(e.clientX, e.clientY);
  if (cell) paintTo(cell.dataset.day, Number(cell.dataset.hour));
});
window.addEventListener("mouseup", () => { if (!pointerSeen) endStroke(); });

/* Last resort: if neither pointer nor mouse events arrive but a click does,
   a plain click still toggles the hour. */
weekEl.addEventListener("click", e => {
  if (pointerSeen || mouseSeen || painting) return;
  const cell = cellOf(e.target);
  if (!cell) return;
  beginStroke(cell);
  endStroke();
});
