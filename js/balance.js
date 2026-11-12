/* ===========================================================================
   The balance — Nutrition's centrepiece (nutrition-view.js drives it).

   Energy balance, shown as the thing the words come from: a bronze balance
   on a marble plinth, drawn in WebGL in its own small canvas. What the day
   burns stands in one pan as weights (the day outside training, and beside
   it the smaller weight training adds); what the day eats stands in the
   other as jars, one a meal, each as large as its share. The beam leans by
   how far eating is set from the burn, so a deficit, a surplus and a level
   day are read before any number is.

   It shows the estimate and nothing else: the sizes are the plan's own
   kilocalories (a weight's volume, a jar's volume), never a body.

   The scene is built from turned shapes (lathe: a profile spun round an
   axis) and drawn as an engraved plate, hand-tinted: every form is shaded
   by lines cut round it, as an engraver shades a turned thing. The lines
   swell where the form turns from the light and cross in the deepest
   shade, a contour is drawn round each piece, and a wash of colour lies
   under the ink (bronze, fired clay, marble). The plate is live: one key
   light follows the pointer as the sculpture's lamp does, and the lines
   are cut again for wherever it stands. It moves when the plan changes or
   the hand moves it, swings, and comes to rest: nothing runs while it is
   still.
   ========================================================================= */

const BalanceScene = (() => {
  /* The balance's own measures, in its units (the plinth's top is y = 0). */
  const REACH = 1.25, PIVOT = 1.92, DROP = 0.98, PAN = 0.5;
  /* How far the beam leans, in radians for each 100% eaten over the burn. */
  const LEAN = 1.15;

  /* ------------------------------ matrices ------------------------------ */
  /* Column-major, as WebGL takes them. */
  const mat = (...v) => new Float32Array(v);
  const mul = (a, b) => {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  };
  const chain = (...m) => m.reduce(mul);
  const move = (x, y, z) => mat(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1);
  const size = (x, y = x, z = x) => mat(x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1);
  const turnZ = a => { const c = Math.cos(a), s = Math.sin(a); return mat(c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1); };
  const turnY = a => { const c = Math.cos(a), s = Math.sin(a); return mat(c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1); };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  /** A rod of radius `r` from `a` to `b`: the unit cylinder (y from 0 to 1) laid between them. */
  const between = (a, b, r) => {
    const y = sub(b, a), yd = unit(y);
    const x = unit(cross(Math.abs(yd[1]) > .99 ? [1, 0, 0] : [0, 1, 0], yd)), z = cross(x, yd);
    return mat(x[0] * r, x[1] * r, x[2] * r, 0, y[0], y[1], y[2], 0, z[0] * r, z[1] * r, z[2] * r, 0, a[0], a[1], a[2], 1);
  };
  const lens = (tanY, aspect, near, far) => mat(1 / (tanY * aspect), 0, 0, 0, 0, 1 / tanY, 0, 0,
    0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0);
  const lookAt = (eye, at) => {
    const f = unit(sub(at, eye)), s = unit(cross(f, [0, 1, 0])), u = cross(s, f);
    return mat(s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0,
      -(s[0] * eye[0] + s[1] * eye[1] + s[2] * eye[2]), -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]),
      f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2], 1);
  };

  /* ------------------------------- shapes ------------------------------- */
  /**
   * A turned shape: `profile` ([radius, height] pairs, from the axis at the
   * foot, out, up and back to the axis) spun round y. Each stretch of the
   * profile keeps its own normal, so an edge stays an edge; `smooth` blends
   * them, for a curve.
   */
  function lathe(profile, smooth = false, around = 56) {
    const pos = [], nor = [], idx = [], uv = [], out = [];
    // How far along the profile each point lies: the engraved lines are cut at even steps of it.
    const along = [0];
    for (let i = 1; i < profile.length; i++) along.push(along[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]));
    const segN = profile.slice(1).map((p, i) => {
      const dr = p[0] - profile[i][0], dy = p[1] - profile[i][1], l = Math.hypot(dr, dy) || 1;
      return [dy / l, -dr / l];
    });
    const blend = (a, b) => { const l = Math.hypot(a[0] + b[0], a[1] + b[1]); return l < 1e-4 ? a : [(a[0] + b[0]) / l, (a[1] + b[1]) / l]; };
    for (let i = 0; i < segN.length; i++) {
      const n0 = smooth && i > 0 ? blend(segN[i - 1], segN[i]) : segN[i];
      const n1 = smooth && i < segN.length - 1 ? blend(segN[i], segN[i + 1]) : segN[i];
      const base = pos.length / 3;
      // The contour is pushed out along a normal shared across each edge, so it never opens at one.
      const o0 = i > 0 ? blend(segN[i - 1], segN[i]) : segN[i], o1 = i < segN.length - 1 ? blend(segN[i], segN[i + 1]) : segN[i];
      for (const [p, n, o, v] of [[profile[i], n0, o0, along[i]], [profile[i + 1], n1, o1, along[i + 1]]])
        for (let k = 0; k <= around; k++) {
          const a = k / around * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
          pos.push(p[0] * c, p[1], p[0] * s);
          nor.push(n[0] * c, n[1], n[0] * s);
          out.push(o[0] * c, o[1], o[0] * s);
          uv.push(k / around, v);
        }
      for (let k = 0; k < around; k++) {
        const a = base + k, b = a + around + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    return { pos, nor, idx, uv, out };
  }
  function box() {
    const pos = [], nor = [], idx = [], uv = [], out = [];
    for (const [n, u, v] of [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
                             [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]]) {
      const b = pos.length / 3;
      for (const [i, j] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const at = [0, 1, 2].map(k => n[k] + u[k] * i + v[k] * j);
        pos.push(...at.map(c => c / 2));
        nor.push(...n);
        out.push(...at);                    // toward its corner: a block's contour keeps its corners
        uv.push(0, 0);
      }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    return { pos, nor, idx, uv, out };
  }
  const arc = (r, from, to, n, x = 0, y = 0) => Array.from({ length: n + 1 }, (_, i) => {
    const a = from + (to - from) * i / n; return [x + r * Math.cos(a), y + r * Math.sin(a)];
  });

  const SHAPES = {
    block: box,
    rod: () => lathe([[0, 0], [1, 0], [1, 1], [0, 1]], false, 10),
    ball: () => lathe(arc(1, -Math.PI / 2, Math.PI / 2, 18), true, 28),
    /* The stand: a foot, a turned stem swelling toward the top, and the fork the beam rests in. */
    stand: () => lathe([[0, 0], [.4, 0], [.42, .05], [.36, .1], [.25, .13], [.2, .17], [.1, .3], [.085, .36], [.115, .42], [.085, .48],
      [.07, 1.0], [.062, 1.5], [.075, 1.62], [.12, 1.68], [.075, 1.74], [.06, 1.8], [.085, 1.86], [.085, 1.98], [.05, 2.02], [0, 2.03]], true),
    /* The beam: turned, stoutest over the fulcrum; laid along x by its model matrix. */
    beam: () => lathe([[0, -REACH - .05], [.03, -REACH - .04], [.045, -REACH], [.024, -REACH + .06], [.03, -.5], [.05, -.12], [.07, 0],
      [.05, .12], [.03, .5], [.024, REACH - .06], [.045, REACH], [.03, REACH + .04], [0, REACH + .05]], true, 24),
    needle: () => lathe([[0, 0], [.024, 0], [.016, .1], [.004, .62], [0, .64]], false, 12),
    /* A pan: a shallow dish with a rolled rim, both faces. */
    pan: () => lathe([[0, 0], [.3, .004], [.44, .045], [PAN, .11], [PAN + .012, .125], [PAN, .135], [.45, .085], [.3, .03], [0, .024]], true),
    /* A weight: a drum with a turned grip, of radius 1. */
    weight: () => lathe([[0, 0], [.94, 0], [1, .06], [1, .64], [.94, .7], [.4, .72], [.24, .78], [.2, .92], [.3, 1.02], [.32, 1.1], [.22, 1.18], [0, 1.2]]),
    /* A jar: a foot, a full belly, a neck and a lip, of radius 1. */
    jar: () => lathe([[0, 0], [.36, 0], [.42, .05], [.62, .4], [.9, .85], [1, 1.25], [.93, 1.6], [.68, 1.9], [.42, 2.06], [.36, 2.2],
      [.4, 2.3], [.52, 2.38], [.5, 2.43], [.36, 2.4], [0, 2.4]], true, 32)
  };

  /* ------------------------------- shading ------------------------------ */
  /* How many engraved lines are cut in one unit of the scene, how thick the
     contour round each piece is (in the scene's units), and how far the
     hull that draws it is pushed out. */
  const LINES = 30, CONTOUR = .008;
  const VERT = "attribute vec3 aPos; attribute vec3 aNor; attribute vec3 aOut; attribute vec2 aUV;" +
    "uniform mat4 uView; uniform mat4 uModel; uniform float uPush; uniform float uBlock;" +
    "varying vec3 vP; varying vec3 vN; varying vec2 vUV;" +
    "void main(){ vec4 w = uModel * vec4(aPos, 1.);" +
      "vec3 o = mix(normalize((uModel * vec4(aOut, 0.)).xyz), normalize(aOut), uBlock);" +
      "w.xyz += o * uPush;" +
      "vP = w.xyz; vN = (uModel * vec4(aNor, 0.)).xyz; vUV = aUV; gl_Position = uView * w; }";
  /* One way of drawing for every piece. `uMode` 2 is the contour: flat ink.
     Otherwise the form's light decides how thick the line cut at each step
     along it is (none in the light, swelling into the shade), a second set
     crosses it in the deepest shade, and the wash under the ink goes from
     `uShade` to `uLight`. A turned piece is cut round its axis (its own
     coordinates, `uMode` 0), or along it where it is long and slight (no
     `uStep`: the beam, the needle); a block along its faces (`uMode` 1). Where the
     lines would be finer than the screen they give way to their even tone. */
  const FRAG = (fine) => (fine ? "#extension GL_OES_standard_derivatives : enable\n" : "") +
    "precision highp float; varying vec3 vP; varying vec3 vN; varying vec2 vUV;" +
    "uniform vec3 uEye; uniform vec3 uLamp; uniform vec3 uInk; uniform vec3 uLight; uniform vec3 uShade;" +
    "uniform float uMode; uniform float uStep; uniform float uAround; uniform float uGloss; uniform float uWeight;" +
    "float cut(float h, float w){" +
      (fine ? "float f = fwidth(h);" : "float f = .09;") +
      "float t = abs(fract(h) - .5) * 2.;" +
      "float l = (1. - smoothstep(w - f * 1.4, w + f * 1.4, t)) * smoothstep(0., .07, w);" +
      "return mix(l, w, smoothstep(.32, .62, f)); }" +
    "void main(){" +
      "if (uMode > 1.5) { gl_FragColor = vec4(uInk, 1.); return; }" +
      "vec3 n = normalize(vN), v = normalize(uEye - vP);" +
      "if (dot(n, v) < 0.) n = -n;" +
      "float d = max(dot(n, uLamp), 0.);" +
      "float spec = pow(max(dot(reflect(-v, n), uLamp), 0.), 22.) * uGloss;" +
      "float lit = clamp(d * .8 + .1 + .14 * max(n.y, 0.) + spec, 0., 1.);" +
      "float tone = (1. - lit) * uWeight;" +
      "float h = uMode > .5 ? (abs(n.y) > .6 ? vP.z : vP.y) * uStep : uStep > 0. ? vUV.y * uStep : vUV.x * uAround;" +
      "float ink = cut(h, clamp(tone * 1.3 - .16, 0., .8));" +
      "if (uMode < .5 && uAround > 0. && uStep > 0.) ink = max(ink, cut(vUV.x * uAround, clamp((tone - .52) * 1.5, 0., .55)));" +
      "vec3 wash = mix(uShade, uLight, smoothstep(.05, .95, lit + spec * .6));" +
      "gl_FragColor = vec4(mix(wash, uInk, ink * .9), 1.); }";

  /* The plate by day and by lamp: the ink, the colour of what is only a
     line (the cords, the marks of the scale), and each material's wash
     from its shade to its light, with how brightly it takes the lamp. */
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const LOOK = {
    light: {
      ink: hex("#2b2015"), line: hex("#2b2015"),
      bronze: { light: hex("#f0e4c4"), shade: hex("#bd9350"), gloss: .9 },
      clay: { light: hex("#f0d8c8"), shade: hex("#c2836a"), gloss: .15 },
      marble: { light: hex("#f7f3ec"), shade: hex("#e4ddd0"), gloss: 0, weight: .5 }
    },
    dark: {
      ink: hex("#0d0802"), line: hex("#a88446"),
      bronze: { light: hex("#e6bd6c"), shade: hex("#6f4a17"), gloss: .9 },
      clay: { light: hex("#c98162"), shade: hex("#5e2e1e"), gloss: .15 },
      marble: { light: hex("#5f584c"), shade: hex("#2f2b24"), gloss: 0, weight: .6 }
    }
  };

  class BalanceScene {
    /** @param canvas the canvas to draw in; `ok` is false where WebGL is not to be had. */
    constructor(canvas) {
      this.canvas = canvas;
      this.onFrame = null;                 // called after each frame drawn, for labels that follow the pans
      this.want = { tilt: null, base: 0, training: 0, meals: [] };
      this.tilt = 0; this.spin = 0;        // the beam's lean (radians, positive toward eating) and its speed
      this.sway = [0, 0]; this.swayV = [0, 0];
      this.sizes = { base: 0, training: 0, jars: [] };
      this.look = [0, 0]; this.lookTo = [0, 0];
      this.held = null;                    // a lean the hand holds the beam at, or null
      this.lit = -1;                       // the jar pointed at, shown lighter
      this.raf = 0; this.last = 0;
      this.age = 1e9;                      // ms since it arrived: its load is set down piece by piece
      let gl = null;
      try { gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: true }); } catch (e) { gl = null; }
      this.gl = gl;
      this.ok = !!gl;
      if (!gl) return;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG(!!gl.getExtension("OES_standard_derivatives"))));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { this.ok = false; return; }
      gl.useProgram(prog);
      this.at = { pos: gl.getAttribLocation(prog, "aPos"), nor: gl.getAttribLocation(prog, "aNor"),
                  out: gl.getAttribLocation(prog, "aOut"), uv: gl.getAttribLocation(prog, "aUV") };
      this.un = {};
      for (const u of ["uView", "uModel", "uEye", "uLamp", "uInk", "uLight", "uShade", "uMode", "uStep", "uAround", "uGloss", "uWeight", "uPush", "uBlock"])
        this.un[u] = gl.getUniformLocation(prog, u);
      this.mesh = {};
      for (const [name, make] of Object.entries(SHAPES)) {
        const m = make(), buf = d => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(d), gl.STATIC_DRAW); return b; };
        const ib = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(m.idx), gl.STATIC_DRAW);
        this.mesh[name] = { pos: buf(m.pos), nor: buf(m.nor), out: buf(m.out), uv: buf(m.uv), idx: ib, n: m.idx.length };
      }
      gl.enable(gl.DEPTH_TEST);
      gl.clearColor(0, 0, 0, 0);
      canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); this.ok = false; });
    }

    get still() { return matchMedia("(prefers-reduced-motion: reduce)").matches; }

    /**
     * What the balance shows: `tilt` is how far eating is set from the burn
     * (0.1 is 10% over; null leaves the pans empty), `base` and `training`
     * the two weights in kcal, `meals` each meal's share of the day.
     */
    set(want) {
      this.want = { ...this.want, ...want };
      this.wake();
    }
    /** The hand takes the beam (a lean, as `set`'s tilt) or lets it go (null). */
    hold(tilt) { this.held = tilt; this.wake(); }
    /** Sets it swinging from level and empty: the stage arriving. */
    arrive() {
      this.tilt = 0; this.spin = 0;
      this.sizes = { base: 0, training: 0, jars: [] };
      this.age = 0;
      this.wake();
    }
    /** Where the pointer is, −1 … 1 across and up: the eye and the lamp follow a little. */
    point(x, y) { this.lookTo = this.still ? [0, 0] : [x, y]; this.wake(); }
    wake() { if (this.ok && !this.raf) { this.last = 0; this.raf = requestAnimationFrame(t => this.frame(t)); } }

    /* ------------------------------ the state ----------------------------- */
    goal() {
      const w = this.want, t = this.held !== null ? this.held : w.tilt === null ? 0 : w.tilt;
      const r = kcal => kcal > 0 ? .36 * Math.cbrt(kcal / 2000) : 0;
      const n = w.tilt === null ? 0 : w.meals.length;
      return {
        tilt: Math.max(-.42, Math.min(.42, t * LEAN)),
        base: w.tilt === null ? 0 : r(w.base), training: w.tilt === null ? 0 : r(w.training),
        jars: w.meals.slice(0, n).map(share => .15 * Math.cbrt(share * n) * (n > 4 ? .86 : 1))
      };
    }
    step(dt) {
      const g = this.goal(), s = Math.min(dt, 40) / 1000;
      let moving = false;
      const ease = (v, to, ms) => { const d = to - v; if (Math.abs(d) < 1e-4) return to; moving = true; return v + d * (1 - Math.exp(-dt / ms)); };
      if (this.still) { this.tilt = g.tilt; this.spin = 0; this.sway = [0, 0]; }
      else {
        // The beam on its knife-edge: a spring toward its lean, lightly damped, so it swings and settles.
        const stiff = this.held !== null ? 120 : 15, damp = this.held !== null ? 20 : 2.3;
        const acc = stiff * (g.tilt - this.tilt) - damp * this.spin;
        this.spin += acc * s; this.tilt += this.spin * s;
        // The pans hang: each swings a little against the beam's turn.
        for (const i of [0, 1]) {
          this.swayV[i] += (-30 * this.sway[i] - 2.4 * this.swayV[i] + acc * (i ? -.22 : .22)) * s;
          this.sway[i] = Math.max(-.3, Math.min(.3, this.sway[i] + this.swayV[i] * s));
        }
        if (Math.abs(g.tilt - this.tilt) > 2e-4 || Math.abs(this.spin) > 2e-4 || Math.abs(this.sway[0]) > 1e-3 || Math.abs(this.swayV[0]) > 1e-3) moving = true;
        else { this.tilt = g.tilt; this.spin = 0; }
      }
      // Arriving, the load is set down a piece at a time: the day's weight, training's, then each jar.
      const ms = this.still ? 1 : 190, here = at => this.still || this.age >= at;
      this.age += dt;
      if (!here(BalanceScene.SET_DOWN.jar + g.jars.length * BalanceScene.SET_DOWN.each)) moving = true;
      this.sizes.base = ease(this.sizes.base, here(BalanceScene.SET_DOWN.base) ? g.base : 0, ms);
      this.sizes.training = ease(this.sizes.training, here(BalanceScene.SET_DOWN.training) ? g.training : 0, ms);
      const jars = this.sizes.jars;
      while (jars.length < g.jars.length) jars.push(0);
      for (let i = 0; i < jars.length; i++)
        jars[i] = ease(jars[i], here(BalanceScene.SET_DOWN.jar + i * BalanceScene.SET_DOWN.each) ? g.jars[i] || 0 : 0, ms);
      while (jars.length > g.jars.length && jars[jars.length - 1] < 1e-3) jars.pop();
      this.look[0] = ease(this.look[0], this.lookTo[0], 260);
      this.look[1] = ease(this.look[1], this.lookTo[1], 260);
      return moving;
    }

    /** Where the pans hang now: [burn's, eating's], each the centre of its dish. */
    pans() {
      return [-1, 1].map((side, i) => {
        const a = -this.tilt, ex = side * REACH * Math.cos(a), ey = PIVOT + side * REACH * Math.sin(a), f = this.sway[i];
        return { end: [ex, ey, 0], at: [ex + Math.sin(f) * DROP, ey - Math.cos(f) * DROP, 0] };
      });
    }
    /** Where the jars stand in the eating pan: one in the middle, or a ring. */
    jarSpots(n) {
      if (n === 1) return [[0, 0]];
      const r = n === 2 ? .2 : n === 3 ? .23 : .27;
      return Array.from({ length: n }, (_, i) => { const a = Math.PI * (.5 + 2 * i / n) + (n === 2 ? Math.PI / 2 : 0); return [Math.cos(a) * r, Math.sin(a) * r * .9]; });
    }

    /* ------------------------------- drawing ------------------------------ */
    camera() {
      const c = this.canvas, aspect = (c.clientWidth || 1) / (c.clientHeight || 1);
      const yaw = this.look[0] * .16, pitch = .15 - this.look[1] * .03, dist = 9.2, at = [0, .9, 0];
      const eye = [at[0] + dist * Math.sin(yaw) * Math.cos(pitch), at[1] + dist * Math.sin(pitch), at[2] + dist * Math.cos(yaw) * Math.cos(pitch)];
      const tanY = Math.max(1.4 / dist, 2.05 / dist / aspect);
      return { eye, view: mul(lens(tanY, aspect, 2, 30), lookAt(eye, at)) };
    }
    /** A point of the scene on the canvas, in CSS px. */
    project(p) {
      const v = this.view || this.camera().view, c = this.canvas;
      const x = v[0] * p[0] + v[4] * p[1] + v[8] * p[2] + v[12], y = v[1] * p[0] + v[5] * p[1] + v[9] * p[2] + v[13];
      const w = v[3] * p[0] + v[7] * p[1] + v[11] * p[2] + v[15];
      return { x: (x / w * .5 + .5) * c.clientWidth, y: (.5 - y / w * .5) * c.clientHeight };
    }
    /** Where a label goes: at the outer rim of the burn's pan ("burn") or the eating's ("eat"), where a rim hangs with the beam level ("level"), under the needle's point ("needle"), or over jar `i`. */
    anchor(what) {
      const [burn, eat] = this.pans();
      if (what === "burn") return this.project([burn.at[0] - PAN, burn.at[1] + .12, 0]);
      if (what === "eat") return this.project([eat.at[0] + PAN, eat.at[1] + .12, 0]);
      if (what === "level") return this.project([PAN + REACH, PIVOT - DROP + .12, 0]);
      if (what === "needle") return this.project([-Math.sin(this.tilt) * 1.36, PIVOT - Math.cos(this.tilt) * 1.36, .14]);
      const n = this.sizes.jars.length, spot = this.jarSpots(n)[what] || [0, 0], s = this.sizes.jars[what] || 0;
      return this.project([eat.at[0] + spot[0], eat.at[1] + .03 + s * 2.5, spot[1]]);
    }
    /** The jar under a point of the canvas (CSS px), or −1. */
    jarAt(x, y) {
      const [, eat] = this.pans(), n = this.sizes.jars.length, spots = this.jarSpots(n);
      let best = -1, bd = 1e9;
      for (let i = 0; i < n; i++) {
        const s = this.sizes.jars[i], foot = this.project([eat.at[0] + spots[i][0], eat.at[1] + .03, spots[i][1]]);
        const top = this.project([eat.at[0] + spots[i][0], eat.at[1] + .03 + s * 2.4, spots[i][1]]);
        const w = (foot.y - top.y) * .5;
        if (y > top.y - 4 && y < foot.y + 4 && Math.abs(x - foot.x) < w && foot.y < bd + 60) {
          // The nearer jar stands lower on the canvas: it wins where two overlap.
          if (best < 0 || spots[i][1] > spots[best][1]) { best = i; bd = foot.y; }
        }
      }
      return best;
    }

    frame(t) {
      this.raf = 0;
      if (!this.ok) return;
      const dt = this.last ? Math.min(64, t - this.last) : 16;
      this.last = t;
      const moving = this.step(dt);
      this.draw();
      if (this.onFrame) this.onFrame();
      if (moving) this.raf = requestAnimationFrame(n => this.frame(n));
    }

    draw() {
      const gl = this.gl, c = this.canvas, dpr = Math.min(devicePixelRatio || 1, 2);
      const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
      if (!w || !h) return;
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const look = LOOK[document.documentElement.dataset.theme === "dark" ? "dark" : "light"], u = this.un;
      const cam = this.camera();
      this.view = cam.view;
      gl.uniformMatrix4fv(u.uView, false, cam.view);
      gl.uniform3fv(u.uEye, cam.eye);
      gl.uniform3fv(u.uInk, look.ink);
      gl.uniform3fv(u.uLamp, unit([-.5 + this.look[0] * .5, .72 + this.look[1] * .25, .62]));

      /* A piece: `mat` its wash; `size` how large it is drawn (its lines are
         cut at even steps of the scene, whatever its size); `girth` its
         radius, where it is stout enough for lines to cross in its shade;
         `along` how many lines run its length, for a long slight piece; `block` for a box;
         `bare` for a piece too slight for a contour. */
      const put = (name, model, mat, { size = 1, girth = 0, along = 0, block = false, bare = false, lift = 1 } = {}) => {
        const m = this.mesh[name], bind = (loc, buf, n) => { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0); };
        gl.uniformMatrix4fv(u.uModel, false, model);
        gl.uniform3fv(u.uLight, mat.light.map(v => Math.min(1, v * lift))); gl.uniform3fv(u.uShade, mat.shade.map(v => Math.min(1, v * lift)));
        gl.uniform1f(u.uGloss, mat.gloss); gl.uniform1f(u.uWeight, mat.weight || 1);
        gl.uniform1f(u.uStep, along ? 0 : LINES * (block ? 1 : size));
        gl.uniform1f(u.uAround, along || (girth ? Math.max(6, Math.round(2 * Math.PI * girth * LINES)) : 0));
        gl.uniform1f(u.uBlock, block ? 1 : 0);
        bind(this.at.pos, m.pos, 3); bind(this.at.nor, m.nor, 3); bind(this.at.out, m.out, 3); bind(this.at.uv, m.uv, 2);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx);
        gl.uniform1f(u.uMode, block ? 1 : 0); gl.uniform1f(u.uPush, 0);
        gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_SHORT, 0);
        if (bare) return;
        // Its contour: the same piece a little larger, only its far faces, in ink.
        gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT);
        gl.uniform1f(u.uMode, 2); gl.uniform1f(u.uPush, CONTOUR);
        gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_SHORT, 0);
        gl.disable(gl.CULL_FACE);
      };
      const B = look.bronze, C = look.clay, M = look.marble;

      // The plinth: two steps of marble.
      put("block", chain(move(0, -.07, 0), size(3.5, .14, 1.3)), M, { block: true });
      put("block", chain(move(0, -.2, 0), size(3.8, .12, 1.6)), M, { block: true });
      put("stand", move(0, 0, 0), B);

      // The scale the needle reads against: a mark each 5%, a longer one each 10%, the level longest.
      const mark = { light: look.line, shade: look.line, gloss: 0 };
      for (let p = -30; p <= 20; p += 5) {
        const a = p / 100 * LEAN, len = p === 0 ? .15 : p % 10 === 0 ? .1 : .055, r = 1.03 + len / 2;
        put("block", chain(move(-Math.sin(a) * r, PIVOT - Math.cos(a) * r, .1), turnZ(-a), size(p === 0 ? .016 : .009, len, .009)), mark, { block: true, bare: true });
      }
      // The beam on its fulcrum, the needle hanging from it.
      const lean = chain(move(0, PIVOT, 0), turnZ(-this.tilt));
      put("beam", chain(lean, turnZ(-Math.PI / 2)), B, { along: 14 });
      put("ball", chain(move(0, PIVOT, 0), size(.1)), B, { size: .1 });
      put("needle", chain(move(0, 0, .1), lean, turnZ(Math.PI), size(1, 1.56, 1)), B, { along: 6 });

      const pans = this.pans();
      pans.forEach((p, i) => {
        put("ball", chain(move(...p.end), size(.045)), B, { size: .045 });
        for (let k = 0; k < 3; k++) {
          const a = Math.PI / 2 + k * Math.PI * 2 / 3;
          put("rod", between(p.end, [p.at[0] + Math.cos(a) * PAN, p.at[1] + .12, Math.sin(a) * PAN], .007), mark, { bare: true });
        }
        put("pan", move(...p.at), B, { girth: PAN });
        const floor = p.at[1] + .028;
        if (i === 0) {
          // What is burned: the day's weight, and training's beside it.
          const b = this.sizes.base, tr = this.sizes.training;
          if (b > .005) put("weight", chain(move(p.at[0] - (tr > .005 ? .1 : 0), floor, 0), size(b)), B, { size: b, girth: b });
          if (tr > .005) put("weight", chain(move(p.at[0] + Math.min(.33, b - .1 + tr + .04), floor, .1), size(tr)), B, { size: tr, girth: tr });
        } else {
          // What is eaten: a jar a meal.
          const n = this.sizes.jars.length, spots = this.jarSpots(n);
          this.sizes.jars.forEach((s, k) => {
            if (s > .004) put("jar", chain(move(p.at[0] + spots[k][0], floor, spots[k][1]), size(s)), C, { size: s, girth: s, lift: k === this.lit ? 1.12 : 1 });
          });
        }
      });
    }
  }
  /* When each piece of the load is set down after the balance arrives, in ms. */
  BalanceScene.SET_DOWN = { base: 140, training: 420, jar: 700, each: 170 };
  return BalanceScene;
})();
