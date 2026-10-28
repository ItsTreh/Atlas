/* ===========================================================================
   Training focus as one page, scrolled: the movement's document on a wide
   screen (targets.js, FLOW_DOCS), in the same grammar as Your muscles.

     intro   what this part is for, and the three ways a set is drawn;
             the figure stands right
     <fam>   one per family chosen: the figure crosses left and turns to
             the side that shows it. Each muscle is a ladder of its weekly
             sets, one block a set, laid against its range; its priority
             beside it
     week    the figure crosses right; the week's work, one block a set

   The week's total travels with the page: pinned beside each family, it
   grows into the closing figure. A family too long for the page scrolls
   its rows through while its head stays put. Every figure is the same
   estimate as the panels' (startingSets, estimate.js).
   ========================================================================= */
(() => {
  const FAMS = Object.keys(FAMILIES);
  const TITLES = { push: "What <em>presses.</em>", pull: "What <em>pulls.</em>", legs: "What <em>carries.</em>", core: "What <em>holds.</em>" };
  const exp = () => routine.experience || DEFAULT_EXPERIENCE;
  const has = m => exercisesFor(m.id).length > 0;
  const setsAt = (m, lv) => has(m) ? weeklyTarget(m, exp(), lv) || 0 : 0;
  const live = () => !!flowDoc("train");

  /* ------------------------------- framings ------------------------------- */
  const shots = docShots("targets-tdoc-");
  shots.set("intro", { d: 545, sx: .67, sy: .50, az: -12 });
  shots.set("week", { d: 545, sx: .70, sy: .50, az: 14 });

  /* -------------------------------- markup -------------------------------- */
  const sub = document.querySelector("#stage-targets .sub-train");
  const doc = $("train-doc");
  doc.innerHTML = '<div class="doc-view"><div class="doc-page"></div></div>' +
    '<div class="tfly" aria-hidden="true"><span class="tfly-num"></span>' +
      '<span class="tfly-lab">sets a week<span class="tfly-d"></span></span></div>';
  const view = doc.querySelector(".doc-view"), page = doc.querySelector(".doc-page");
  const fly = doc.querySelector(".tfly"), flyNum = fly.querySelector(".tfly-num");
  const flyLab = fly.querySelector(".tfly-lab"), flyD = fly.querySelector(".tfly-d");

  const LEGEND = [["maintain", "Maintain", 4], ["normal", "Normal", 5], ["focus", "Focus", 7]];
  const introHTML = () =>
    '<section class="ds ds-intro ds-tintro" data-s="intro">' +
      '<p class="eyebrow" data-r="0"><span class="n">I</span> / Targets · Training focus</p>' +
      '<h1 class="ds-title" id="tdoc-title" tabindex="-1" data-r="1">Where the <em>work</em> goes.</h1>' +
      '<p class="ds-lede" data-r="2">Every block is one hard set a week. Normal starts a muscle inside its range; Focus moves it up the range; Maintain holds it at the floor, and is the first trimmed when your week runs short. One family at a time: the figure turns to show each.</p>' +
      '<div class="tlg" data-r="2" aria-hidden="true">' + LEGEND.map(([lv, name, n]) =>
        '<span class="tlg-i" data-level="' + lv + '"><span class="tlg-s">' + '<i class="s f"></i>'.repeat(n) + '</span>' +
        '<span class="tlg-w">' + name + '</span></span>').join("") + '</div>' +
      '<button type="button" class="ds-cue" data-go="first" data-r="3"><span class="ds-cue-line" aria-hidden="true"></span>Scroll to begin</button>' +
    '</section>';

  const rowHTML = (m, N, i) => {
    const [lo, hi] = m.weeklySets, ok = has(m);
    let slots = "";
    for (let j = 0; j < N; j++) slots += '<i class="s' + (!ok || j >= hi ? " x" : "") + '" style="--j:' + j + '"></i>';
    return '<div class="tdr" data-row="' + m.id + '" data-muscle="' + m.id + '" data-family="' + m.family + '" style="--i:' + i + '">' +
      '<span class="tdr-name">' + esc(m.name) + '</span>' +
      '<span class="tdr-lv" role="radiogroup" aria-label="' + esc(m.name) + ' priority">' +
        PRIORITY_CHOICES.map(([lv, label]) =>
          '<button type="button" role="radio" data-lv="' + lv + '" data-muscle="' + m.id + '">' + label + '</button>').join("") +
      '</span>' +
      '<span class="tdr-lad" style="--n:' + N + '" aria-hidden="true">' + slots +
        (ok ? '<span class="tdr-rng" style="grid-column:' + lo + ' / ' + (hi + 1) + '"><span>' + lo + '–' + hi + ' a week</span></span>' : '') +
      '</span>' +
      '<span class="tdr-n" aria-live="polite"></span>' +
      '<button type="button" class="row-x tdr-x" data-remove="' + m.id + '" aria-label="Remove ' + esc(m.name) + '" title="Remove ' + esc(m.name) + '">×</button>' +
    '</div>';
  };
  const famHTML = (f, N) =>
    '<section class="ds ds-fam" data-s="' + f.k + '" data-family="' + f.k + '">' +
      '<div class="tf">' +
        '<header class="tf-head">' +
          '<div class="tf-l">' +
            '<p class="eyebrow" data-r="0">' + FAMILIES[f.k].name + ' · ' + countWord(f.ms.length).toLowerCase() + (f.ms.length === 1 ? ' muscle' : ' muscles') + '</p>' +
            '<h2 class="tf-title" data-r="0">' + TITLES[f.k] + '</h2>' +
          '</div>' +
          '<div class="tf-pin" aria-hidden="true"><span class="tf-pin-n tnum"></span><span class="tf-pin-l">sets a week</span></div>' +
        '</header>' +
        '<div class="tf-share" data-r="1" aria-hidden="true">' + fams.map(g =>
          '<span data-f="' + g.k + '"' + (g.k === f.k ? ' class="me"' : '') + '></span>').join("") + '</div>' +
        '<p class="tf-of" data-r="1"><b class="tf-sets"></b> of the week’s sets, here</p>' +
        '<div class="tf-win" data-r="2"><div class="tf-rows">' + f.ms.map((m, i) => rowHTML(m, N, i)).join("") + '</div></div>' +
      '</div>' +
    '</section>';
  const weekHTML = () => {
    let j = 0;
    const band = fams.map(f =>
      '<div class="twb-g" data-family="' + f.k + '">' +
        '<span class="twb-s">' + f.ms.map(m => {
          let h = "";
          for (let k = 0, n = setsAt(m, "focus"); k < n; k++) h += '<i class="s f" data-m="' + m.id + '" data-k="' + k + '" style="--j:' + (j++) + '"></i>';
          return h;
        }).join("") + '</span>' +
        '<span class="twb-l"><span class="twb-n">' + FAMILIES[f.k].name + '</span><span class="twb-c"></span></span>' +
      '</div>').join("");
    return '<section class="ds ds-week" data-s="week">' +
      '<div class="tw">' +
        '<p class="eyebrow" data-r="0">Your week, to start</p>' +
        '<div class="tw-num" aria-hidden="true"><span class="tw-num-n tnum"></span></div>' +
        '<p class="tw-say" data-r="1"></p>' +
        '<div class="tw-band" data-r="2">' + band + '</div>' +
        '<p class="tw-mix" data-r="2"></p>' +
        '<div class="tw-note" data-r="3"></div>' +
        '<div class="tw-end" data-r="3"><button type="button" class="ds-cue tw-on"><span class="ds-cue-line" aria-hidden="true"></span>Continue to your measure</button></div>' +
      '</div>' +
    '</section>';
  };

  /* ------------------------------ build, paint ----------------------------- */
  let fams = [], KEYS = ["intro", "week"], secEl = {}, builtKey = null;
  const keyOf = () => selection.muscles().map(m => m.id).join();
  function build() {
    const ms = selection.muscles();
    builtKey = keyOf();
    fams = FAMS.map(k => ({ k, ms: ms.filter(m => m.family === k) })).filter(f => f.ms.length);
    KEYS = ["intro", ...fams.map(f => f.k), "week"];
    // The ladders line up: as many places as the largest range chosen.
    const N = Math.max(1, ...ms.filter(has).map(m => m.weeklySets[1]));
    fams.forEach((f, i) => {
      const back = f.ms.filter(m => FLOW_BACK.has(m.id)).length * 2 > f.ms.length;
      shots.set(f.k, { d: 545, sx: .27, sy: .50, az: (back ? 180 : 0) + (i % 2 ? -18 : 18) });
    });
    page.innerHTML = introHTML() + fams.map(f => famHTML(f, N)).join("") + weekHTML();
    secEl = {};
    for (const el of page.querySelectorAll(".ds")) secEl[el.dataset.s] = el;
    shownTotal = null;
  }

  function paintRow(row) {
    const m = MUSCLE_BY_ID.get(row.dataset.muscle), lv = selection.priority(m.id), sets = startingSets(m);
    const was = row.dataset.sets === undefined ? null : Number(row.dataset.sets);
    row.dataset.level = lv;
    row.dataset.sets = sets;
    for (const b of row.querySelectorAll("[data-lv]")) {
      const sel = b.dataset.lv === lv;
      b.setAttribute("aria-checked", String(sel));
      b.tabIndex = sel ? 0 : -1;
    }
    row.querySelectorAll(".s").forEach((s, i) => {
      const f = i < sets;
      // A change runs along the ladder: up from where it stood, or back down to where it goes.
      s.style.setProperty("--d", was !== null && f !== s.classList.contains("f") ? (sets > was ? i - was : was - 1 - i) * 30 + "ms" : "0ms");
      s.classList.toggle("f", f);
    });
    row.querySelector(".tdr-n").innerHTML = has(m) ? "<b>" + sets + "</b><span>" + (sets === 1 ? "set" : "sets") + " a week</span>" : "<span>No exercises yet</span>";
  }

  function paint() {
    const ms = selection.muscles(), famSets = {}, counts = { focus: 0, normal: 0, maintain: 0 }, setsOf = {};
    let total = 0;
    for (const m of ms) {
      const s = startingSets(m);
      setsOf[m.id] = s; total += s; counts[selection.priority(m.id)]++;
      famSets[m.family] = (famSets[m.family] || 0) + s;
    }
    for (const row of page.querySelectorAll(".tdr")) paintRow(row);
    for (const el of page.querySelectorAll(".tf-share [data-f]")) el.style.setProperty("--g", famSets[el.dataset.f] || 0);
    for (const sec of page.querySelectorAll(".ds-fam")) sec.querySelector(".tf-sets").textContent = "≈ " + (famSets[sec.dataset.s] || 0);
    for (const s of page.querySelectorAll(".twb-s .s")) {
      const id = s.dataset.m;
      s.classList.toggle("x", Number(s.dataset.k) >= setsOf[id]);
      s.dataset.level = selection.priority(id);
    }
    for (const g of page.querySelectorAll(".twb-g")) {
      g.style.setProperty("--g", famSets[g.dataset.family] || 0);
      g.querySelector(".twb-c").textContent = "≈ " + (famSets[g.dataset.family] || 0) + " sets";
    }
    const n = ms.length;
    const say = page.querySelector(".tw-say");
    if (say) say.innerHTML = '<span class="visually-hidden">About ' + total + ' </span>hard sets a week, across <em>' +
      countWord(n).toLowerCase() + (n === 1 ? " muscle." : " muscles.") + "</em>";
    const parts = [];
    if (counts.focus) parts.push(countWord(counts.focus) + " on focus");
    if (counts.normal) parts.push(countWord(counts.normal) + " on normal");
    if (counts.maintain) parts.push(countWord(counts.maintain) + " held at maintain");
    const mix = page.querySelector(".tw-mix");
    if (mix) {
      const s = andList(parts);
      mix.textContent = s ? s.charAt(0) + s.slice(1).toLowerCase() + ". An estimate to start from: add sets as you adapt." : "";
    }
    const note = page.querySelector(".tw-note");
    if (note) note.innerHTML = noExercisesNote(ms);
    setTotal(total);
  }

  /* The total's digits roll to their new value, the furthest right first. */
  let shownTotal = null;
  function setTotal(t) {
    const txt = String(t);
    for (const el of page.querySelectorAll(".tnum")) el.textContent = "≈ " + txt;
    if (flyNum.dataset.len !== String(txt.length)) {
      flyNum.dataset.len = txt.length;
      flyNum.innerHTML = '<span class="tfly-ap">≈ </span>' + [...txt].map(() =>
        '<span class="rd"><span class="rd-c">' + [...Array(10).keys()].map(d => "<i>" + d + "</i>").join("") + '</span></span>').join("");
    }
    [...flyNum.querySelectorAll(".rd-c")].forEach((c, j) => {
      c.style.setProperty("--v", txt[j]);
      c.style.transitionDelay = (txt.length - 1 - j) * 80 + "ms";
    });
    if (shownTotal !== null && shownTotal.length !== txt.length) measureFly();
    shownTotal = txt;
  }

  /* ------------------------------- geometry ------------------------------- */
  let H = 0, max = 0, y = 0, target = 0, cur = null, atEnd = false, owns = false;
  const stop = {};
  let pinA = {}, heroA = { x: 0, y: 0 }, pinS = .3, heroW = 0, heroH = 0;
  const offIn = el => { let x = 0, t = 0; for (let e = el; e && e !== page; e = e.offsetParent) { x += e.offsetLeft; t += e.offsetTop; } return { x, y: t }; };

  function measure() {
    if (!secEl.intro) return;
    const { top, ch } = docRoom(sub, doc);
    H = view.clientHeight || 1;
    for (const k of KEYS) secEl[k].style.height = H + "px";
    let at = 0;
    KEYS.forEach((k, i) => {
      const win = secEl[k].querySelector(".tf-win");
      const extra = win ? Math.max(0, win.firstChild.offsetHeight - (win.clientHeight - 12)) : 0;
      if (i) at += H;
      stop[k] = { a: at, b: at + extra, extra };
      at += extra;
      if (win) win.classList.toggle("ovf", extra > 0);
    });
    max = stop.week.b;
    y = Math.min(y, max); target = Math.min(target, max);
    for (const f of fams) shots.fit(f.k, top - 12, ch - 30);
    shots.fit("week", top - 4, ch - 40);
    measureFly();
  }
  function measureFly() {
    const he = page.querySelector(".tw-num-n");
    if (!he || !he.offsetWidth) return;
    const heroFS = parseFloat(getComputedStyle(he).fontSize) || 200;
    heroA = offIn(he); heroW = he.offsetWidth; heroH = he.offsetHeight;
    pinA = {};
    for (const f of fams) {
      const pe = secEl[f.k].querySelector(".tf-pin-n");
      pinA[f.k] = offIn(pe);
      pinS = (parseFloat(getComputedStyle(pe).fontSize) || 60) / heroFS;
    }
    flyNum.style.fontSize = heroFS + "px";
  }

  /* Where the scroll stands: resting in a section (a = b), or between two. */
  function seg(v = y) {
    for (let i = 0; i < KEYS.length; i++) {
      const k = KEYS[i], s = stop[k], n = KEYS[i + 1];
      if (v <= s.b + .01) return { a: k, b: k, e: 0 };
      if (n && v < stop[n].a - .01) { const t = (v - s.b) / (stop[n].a - s.b); return { a: k, b: n, e: t * t * (3 - 2 * t) }; }
    }
    const l = KEYS[KEYS.length - 1];
    return { a: l, b: l, e: 0 };
  }
  const nearestKey = (v = y) => {
    const g = seg(v);
    return g.a === g.b ? g.a : g.e < .5 ? g.a : g.b;
  };
  const snapOf = v => {
    let best = 0, bd = Infinity;
    for (const k of KEYS) {
      const s = stop[k];
      if (v >= s.a && v <= s.b) return v;
      for (const e of [s.a, s.b]) if (Math.abs(e - v) < bd) { bd = Math.abs(e - v); best = e; }
    }
    return best;
  };

  function render() {
    if (!stop.week) return;
    for (const k of KEYS) {
      const s = stop[k], el = secEl[k];
      const d = y < s.a ? s.a - y : y > s.b ? s.b - y : 0, p = d / H, a = Math.abs(p);
      el.style.transform = "translateY(" + d.toFixed(1) + "px)";
      el.style.opacity = Math.max(0, Math.min(1, 1.25 - a * 1.5)).toFixed(3);
      el.style.visibility = a > 1.1 ? "hidden" : "";
      el.style.setProperty("--p", p.toFixed(4));
      if (s.extra) {
        const off = Math.max(0, Math.min(s.extra, y - s.a)), win = el.querySelector(".tf-win");
        win.firstChild.style.transform = "translateY(" + (-off).toFixed(1) + "px)";
        win.style.setProperty("--mt", off > 1 ? "36px" : "0px");
        win.style.setProperty("--mb", off < s.extra - 1 ? "36px" : "0px");
      }
    }
    const g = seg(), k = nearestKey();
    if (k !== cur) setSection(k);
    holdFigure(shots, g.a, g.b, g.e, live());
    paintFly(g);
    const end = target >= max - 1;
    if (end !== atEnd) { atEnd = end; Stages.paintFooter(); }
  }

  /* The total: unseen at the opening, pinned beside each family, the closing figure at the end. */
  function paintFly(g) {
    if (!fams.length) { fly.style.opacity = 0; return; }
    const st = k => k === "week" ? { ...heroA, s: 1, o: 1, l: 0 }
      : k === "intro" ? { ...(pinA[fams[0].k] || heroA), s: pinS, o: 0, l: 0 }
      : { ...(pinA[k] || heroA), s: pinS, o: 1, l: 1 };
    const A = st(g.a), B = st(g.b), e = g.e, L = (p, q) => p + (q - p) * e;
    const s = L(A.s, B.s);
    fly.style.transform = "translate(" + L(A.x, B.x).toFixed(1) + "px," + L(A.y, B.y).toFixed(1) + "px)";
    flyNum.style.transform = "scale(" + s.toFixed(4) + ")";
    fly.style.opacity = L(A.o, B.o).toFixed(3);
    flyLab.style.opacity = Math.max(0, L(A.l, B.l) * 2 - 1).toFixed(3);
    flyLab.style.top = (heroH * s + 8).toFixed(1) + "px";
    flyLab.style.width = (heroW * s).toFixed(1) + "px";
  }

  /* ------------------------------- sections ------------------------------- */
  let hoverRow = null, arrT = 0;
  function pinWord() {
    if (!live()) return;
    if (hoverRow) { const m = MUSCLE_BY_ID.get(hoverRow.dataset.muscle); return pinGhost({ text: m.name, fam: m.family, line: "" }); }
    pinGhost(cur === "intro" ? { text: "Emphasis", fam: "program", line: "" } : FAMILIES[cur] ? { text: FAMILIES[cur].name, fam: cur, line: "" } : null);
  }
  /* Arriving at a section, its sets build up block by block. */
  function setSection(k) {
    cur = k;
    Stages.root.dataset.docAt = k;
    point(null);
    pinWord();
    for (const el of page.querySelectorAll(".ds.here")) el.classList.remove("here", "arr");
    const el = secEl[k];
    void el.offsetWidth;
    el.classList.add("here", "arr");
    clearTimeout(arrT);
    arrT = setTimeout(() => el.classList.remove("arr"), 2200);
    Stages.paintFooter();
  }

  /* ------------------------------- pointing ------------------------------- */
  let pointKey = "", pvRow = null;
  function point(t) {
    const row = t && t.closest ? t.closest(".tdr") : null;
    const g = !row && t && t.closest ? t.closest(".twb-g") : null;
    const key = row ? "r" + row.dataset.muscle : g ? "g" + g.dataset.family : "";
    if (key !== pointKey) {
      pointKey = key; hoverRow = row;
      for (const r of page.querySelectorAll(".tdr.pointed")) r.classList.remove("pointed");
      if (row) figure.preview([row.dataset.muscle], row.dataset.family);
      else if (g) figure.preview(selection.muscles().filter(m => m.family === g.dataset.family).map(m => m.id), g.dataset.family);
      else figure.preview(null);
      pinWord();
    }
    const b = row && t.closest("[data-lv]");
    preview(row, b ? b.dataset.lv : null);
  }
  /* Pointing at a priority shows what it would do: the blocks it adds, or the ones it drops. */
  function preview(row, lv) {
    if (pvRow && (pvRow !== row || !lv || pvRow.dataset.pv !== lv)) {
      for (const s of pvRow.querySelectorAll(".pa, .pc")) { s.style.setProperty("--d", "0ms"); s.classList.remove("pa", "pc"); }
      delete pvRow.dataset.pv;
      paintRow(pvRow);
      pvRow = null; flyD.textContent = "";
    }
    if (!row || !lv || pvRow) return;
    const m = MUSCLE_BY_ID.get(row.dataset.muscle);
    if (lv === selection.priority(m.id) || !has(m)) return;
    const now = startingSets(m), then = setsAt(m, lv), d = then - now;
    pvRow = row; row.dataset.pv = lv;
    row.querySelectorAll(".s").forEach((s, i) => {
      s.style.setProperty("--d", "0ms");
      s.classList.toggle("pa", i >= now && i < then);
      s.classList.toggle("pc", i >= then && i < now);
    });
    row.querySelector(".tdr-n").innerHTML = d ? "<b>" + then + "</b><span>from " + now + "</span>"
      : "<b>" + now + "</b><span>" + (lv === "maintain" ? "trimmed first" : "kept") + "</span>";
    if (d) flyD.textContent = " · " + (d > 0 ? "+" : "−") + Math.abs(d);
  }
  page.addEventListener("pointerover", e => point(e.target));
  page.addEventListener("pointerleave", () => point(null));
  page.addEventListener("focusin", e => {
    point(e.target);
    // Keyboard focus brings its row into view, wherever the page stands.
    const sec = e.target.closest(".ds"), row = e.target.closest(".tdr");
    if (!sec || !live()) return;
    const s = stop[sec.dataset.s], win = row && sec.querySelector(".tf-win");
    let want = s.a;
    if (win && s.extra) want += Math.max(0, Math.min(s.extra, row.offsetTop - (win.clientHeight - row.offsetHeight) / 2));
    if (Math.abs(want - target) > 1) go(want);
  });
  page.addEventListener("focusout", e => { if (!page.contains(e.relatedTarget)) point(null); });
  // The page is moved by the scroll, never by the browser bringing focus into view.
  doc.addEventListener("scroll", e => { const t = e.target; if (t.scrollTop || t.scrollLeft) { t.scrollTop = 0; t.scrollLeft = 0; } }, true);

  page.addEventListener("click", e => {
    const t = e.target;
    const lv = t.closest("[data-lv]");
    if (lv) { selection.setPriority(lv.dataset.muscle, lv.dataset.lv); return; }
    const x = t.closest("[data-remove]");
    if (x) {
      const rows = [...page.querySelectorAll(".tdr")], i = rows.indexOf(x.closest(".tdr"));
      const near = rows[i + 1] || rows[i - 1];
      selection.set(x.dataset.remove, false);
      const to = near && page.querySelector('.tdr[data-muscle="' + near.dataset.muscle + '"] [data-remove]');
      if (to) to.focus({ preventScroll: true });
      else if (live()) $("tdoc-title").focus({ preventScroll: true });
      return;
    }
    if (t.closest('[data-go="first"]')) return go(stop[KEYS[1]].a);
    if (t.closest(".tw-on")) Stages.next();
  });

  selection.onChange(() => {
    if (builtKey !== keyOf()) {
      const k = cur, i = KEYS.indexOf(k);
      build(); paint();
      if (!live()) return;
      measure();
      const at = KEYS.includes(k) ? k : KEYS[Math.max(0, Math.min(KEYS.length - 1, i))];
      y = target = Math.min(max, stop[at].a);
      cur = at;
      secEl[at].classList.add("here");
      pointKey = ""; hoverRow = null; pvRow = null;
      render(); pinWord();
    } else {
      pvRow = null; flyD.textContent = "";
      paint();
    }
  });

  /* -------------------------------- motion -------------------------------- */
  let snapTimer = 0, movedAt = 0;
  const wake = docTicker(dt => {
    if (!live() || Math.abs(target - y) <= .3) return false;
    y += (target - y) * (1 - Math.exp(-dt / 130));
    if (Math.abs(target - y) <= .3) { y = target; settleFigure(); }
    render();
    return true;
  });
  function go(v) {
    target = Math.max(0, Math.min(max, v));
    movedAt = performance.now();
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => { target = snapOf(target); wake(); }, 200);
    wake();
  }

  addEventListener("wheel", e => {
    owns = false;
    if (!live() || Stages.busy || e.ctrlKey) return;
    const d = wheelDelta(e);
    if (!d) return;
    const can = d > 0 ? target < max - .5 : target > .5;
    owns = can || performance.now() - movedAt < 650;
    if (can) go(target + d);
  }, { capture: true, passive: true });

  addEventListener("keydown", e => {
    const el = e.target instanceof Element ? e.target : document.body;
    if (!live() || Stages.busy || el.closest("input, textarea, select")) return;
    const lvg = el.closest(".tdr-lv"), side = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (lvg && side) {
      e.preventDefault();
      const bs = [...lvg.querySelectorAll("[data-lv]")], i = bs.findIndex(b => b.getAttribute("aria-checked") === "true");
      const n = bs[Math.max(0, Math.min(bs.length - 1, i + side))];
      selection.setPriority(n.dataset.muscle, n.dataset.lv);
      n.focus({ preventScroll: true });
      return;
    }
    const dir = { PageDown: 1, ArrowDown: 1, PageUp: -1, ArrowUp: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    // A long family's hidden rows are walked through before the page moves on.
    const k = nearestKey(target), s = stop[k];
    if (s.extra && dir > 0 && target < s.b - 1) return go(Math.min(s.b, target + H * .5));
    if (s.extra && dir < 0 && target > s.a + 1) return go(Math.max(s.a, target - H * .5));
    const i = KEYS.indexOf(k) + dir;
    if (KEYS[i]) go(dir > 0 ? stop[KEYS[i]].a : stop[KEYS[i]].b);
  });
  new ResizeObserver(() => { if (live()) { measure(); render(); settleFigure(); } }).observe(view);
  if (document.fonts) document.fonts.ready.then(() => { if (live()) { measure(); render(); } });

  /* ------------------------------- the stage ------------------------------- */
  FLOW_DOCS.train = {
    enter(from) {
      if (builtKey !== keyOf()) build();
      paint(); measure();
      // From Your muscles (or a fresh arrival) the page opens at the top; back from a later stage, at the week.
      y = target = from === "train" ? stop.week.a : 0;
      cur = null; pointKey = ""; hoverRow = null;
      render(); settleFigure();
    },
    leave() {
      cur = null;
      delete Stages.root.dataset.docAt;
    },
    shot: () => shots.name(nearestKey(y)).replace(/-front$/, ""),
    owns: () => owns,
    atEnd: () => atEnd,
    hint: () => "Scroll down",
    focus: () => $("tdoc-title")
  };

  build(); paint();
})();
