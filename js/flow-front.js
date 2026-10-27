/* ===========================================================================
   The word, in front too.

   The names behind the body (.flow-ground: the movement's word, the muscle
   pointed at, the program's band) come round in front of it below the hips,
   on the leg nearer the eye only, so a word passes behind one leg and in
   front of the other, woven through the figure.

   A twin of the ground sits over the figure, kept in step with it node by
   node. The CSS shows it only under the line this measures off the camera
   (--knee), on the near leg's side of the figure's axis (--axis, --wdir),
   and opens it around the pointer (--px, --py, --lens). Outside the body it
   lies exactly on the ground, so only where it crosses the leg does it
   read. It never takes the pointer, and whatever is pointed at stays seen.
   ========================================================================= */

(function () {
  const ground = document.querySelector(".flow-ground");
  const stage = document.getElementById("anatomy-stage");
  const mount = stage && stage.querySelector(".anatomy-viewport");
  if (!ground || !mount) return;
  const LINE = 0.58;            // of the figure's height: just below the hips

  const front = document.createElement("div");
  stage.insertBefore(front, mount.nextSibling);

  function rootAttrs() {
    for (const a of [...front.attributes]) if (a.name !== "style" && !ground.hasAttribute(a.name)) front.removeAttribute(a.name);
    for (const a of ground.attributes) if (a.name !== "class" && a.name !== "style") front.setAttribute(a.name, a.value);
    front.className = ground.className + " flow-front";
  }
  function full() { front.innerHTML = ground.innerHTML; rootAttrs(); }
  full();

  const pathOf = n => {
    const p = [];
    while (n && n !== ground) {
      const up = n.parentNode;
      if (!up) return null;
      p.push(Array.prototype.indexOf.call(up.childNodes, n));
      n = up;
    }
    return n === ground ? p.reverse() : null;
  };
  const twinAt = p => { let n = front; for (const i of p) n = n && n.childNodes[i]; return n; };

  // Mutation callbacks run before the frame paints, so the twin moves with the original.
  new MutationObserver(recs => {
    const restarted = new Set();
    for (const r of recs) {
      const el = r.type === "characterData" ? r.target.parentNode : r.target;
      if (el === ground) { if (r.type === "attributes") rootAttrs(); else { full(); return; } continue; }
      const p = pathOf(el), twin = p && twinAt(p);
      if (!twin || twin.nodeType !== 1) { full(); return; }
      if (r.type !== "attributes") { twin.innerHTML = el.innerHTML; continue; }
      const k = r.attributeName;
      if (k === "class") {
        // A class taken off and put back restarts the letters' arrival (targets.js, ghost): here too.
        if (!restarted.has(el) && el.classList.contains("swap")) { twin.classList.remove("swap"); void twin.offsetWidth; restarted.add(el); }
        twin.className = el.className;
      } else {
        const v = el.getAttribute(k);
        if (v == null) twin.removeAttribute(k); else twin.setAttribute(k, v);
      }
    }
  }).observe(ground, { subtree: true, childList: true, attributes: true, characterData: true });

  /* The line and the axis, through the camera the sculpture holds right
     now (axisPoint), written only when they move. */
  let shown = null;
  (function tick() {
    requestAnimationFrame(tick);
    if (document.hidden) return;
    const r = typeof figure === "object" && figure.renderer;
    const a = r && r.axisPoint && r.axisPoint(LINE);
    if (!a || !isFinite(a.y)) return;
    const y = mount.offsetTop + a.y, x = mount.offsetLeft + a.x;
    const ax = a.side > 0 ? x : stage.clientWidth - x;
    if (shown && Math.abs(y - shown.y) <= .5 && Math.abs(ax - shown.ax) <= .5 && a.side === shown.side) return;
    shown = { y, ax, side: a.side };
    front.style.setProperty("--knee", y.toFixed(1) + "px");
    front.style.setProperty("--axis", ax.toFixed(1) + "px");
    front.style.setProperty("--wdir", a.side > 0 ? "90deg" : "270deg");
  })();

  /* Wherever the pointer is, the copy in front gives way. */
  addEventListener("pointermove", e => {
    const b = stage.getBoundingClientRect();
    front.style.setProperty("--px", (e.clientX - b.left).toFixed(0) + "px");
    front.style.setProperty("--py", (e.clientY - b.top).toFixed(0) + "px");
    front.style.setProperty("--lens", e.pointerType === "touch" ? "0px" : "130px");
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => front.style.setProperty("--lens", "0px"));
})();
