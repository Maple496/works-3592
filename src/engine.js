var Work = (function () {
  var current = null;
  return {
    register: function (mod) {
      if (!mod || typeof mod.mount !== 'function') {
        throw new Error('Work.register: {mount} 未声明');
      }
      current = mod;
    },
    get: function () { return current; }
  };
})();

var Input = {
  keys: {}, pressed: {},
  mouse: { x: 0, y: 0, down: false },
  touchMove: { id: -1, sx: 0, sy: 0, x: 0, y: 0 },
  touchAim: { id: -1, x: 0, y: 0, active: false },
  bind: function (canvas) {
    var self = this;
    this._kd = function (e) {
      if (['Tab', 'Space', 'KeyE'].indexOf(e.code) >= 0) e.preventDefault();
      if (!e.repeat) self.pressed[e.code] = true;
      self.keys[e.code] = true;
    };
    this._ku = function (e) { self.keys[e.code] = false; };
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);
    this._mm = function (e) {
      var r = canvas.getBoundingClientRect();
      self.mouse.x = e.clientX - r.left; self.mouse.y = e.clientY - r.top;
    };
    this._md = function (e) { if (e.button === 0) self.mouse.down = true; };
    this._mu = function () { self.mouse.down = false; };
    canvas.addEventListener('mousemove', this._mm);
    canvas.addEventListener('mousedown', this._md);
    window.addEventListener('mouseup', this._mu);
    this._ts = function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i], r = canvas.getBoundingClientRect();
        var x = t.clientX - r.left, y = t.clientY - r.top;
        if (x < r.width / 2 && self.touchMove.id < 0) {
          self.touchMove.id = t.identifier; self.touchMove.sx = x; self.touchMove.sy = y; self.touchMove.x = x; self.touchMove.y = y;
        } else {
          self.touchAim.id = t.identifier; self.touchAim.x = x; self.touchAim.y = y; self.touchAim.active = true;
          self.mouse.x = x; self.mouse.y = y;
        }
      }
    };
    this._tm = function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i], r = canvas.getBoundingClientRect();
        var x = t.clientX - r.left, y = t.clientY - r.top;
        if (t.identifier === self.touchMove.id) { self.touchMove.x = x; self.touchMove.y = y; }
        else if (t.identifier === self.touchAim.id) { self.touchAim.x = x; self.touchAim.y = y; self.mouse.x = x; self.mouse.y = y; }
      }
    };
    this._te = function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === self.touchMove.id) self.touchMove.id = -1;
        if (t.identifier === self.touchAim.id) { self.touchAim.id = -1; self.touchAim.active = false; }
      }
    };
    canvas.addEventListener('touchstart', this._ts, { passive: false });
    canvas.addEventListener('touchmove', this._tm, { passive: false });
    canvas.addEventListener('touchend', this._te);
    canvas.addEventListener('touchcancel', this._te);
    this._canvas = canvas;
  },
  unbind: function () {
    window.removeEventListener('keydown', this._kd);
    window.removeEventListener('keyup', this._ku);
    window.removeEventListener('mouseup', this._mu);
    var c = this._canvas;
    if (c) {
      c.removeEventListener('mousemove', this._mm);
      c.removeEventListener('mousedown', this._md);
      c.removeEventListener('touchstart', this._ts);
      c.removeEventListener('touchmove', this._tm);
      c.removeEventListener('touchend', this._te);
      c.removeEventListener('touchcancel', this._te);
    }
    this._canvas = null;
    this.keys = {}; this.pressed = {};
    this.mouse.down = false;
    this.touchMove.id = -1;
    this.touchAim.id = -1; this.touchAim.active = false;
  },
  axis: function () {
    var x = (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0);
    var y = (this.keys['KeyS'] ? 1 : 0) - (this.keys['KeyW'] ? 1 : 0);
    var tm = this.touchMove;
    if (tm.id >= 0) {
      var dx = tm.x - tm.sx, dy = tm.y - tm.sy, d = Math.hypot(dx, dy);
      if (d > 8) { x = dx / d; y = dy / d; }
    }
    var l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x: x, y: y };
  },
  consume: function (code) {
    if (this.pressed[code]) { this.pressed[code] = false; return true; }
    return false;
  },
  endFrame: function () { this.pressed = {}; }
};

var Sfx = (function () {
  var ac = null;
  function ctx() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  function blip(freq, dur, type, vol, slide) {
    try {
      var a = ctx(); if (!a) return;
      var o = a.createOscillator(), gn = a.createGain();
      o.type = type || 'square'; o.frequency.value = freq;
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), a.currentTime + dur);
      gn.gain.setValueAtTime(vol || 0.08, a.currentTime);
      gn.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
      o.connect(gn); gn.connect(a.destination);
      o.start(); o.stop(a.currentTime + dur);
    } catch (e) {}
  }
  function noise(dur, vol) {
    try {
      var a = ctx(); if (!a) return;
      var b = a.createBuffer(1, a.sampleRate * dur, a.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      var s = a.createBufferSource(), gn = a.createGain();
      s.buffer = b; gn.gain.value = vol || 0.1;
      s.connect(gn); gn.connect(a.destination); s.start();
    } catch (e) {}
  }
  return {
    shoot: function () { blip(620, 0.07, 'square', 0.05, -300); },
    laser: function () { blip(1200, 0.12, 'sawtooth', 0.05, -800); },
    hit: function () { blip(240, 0.05, 'sawtooth', 0.06); },
    boom: function () { blip(90, 0.3, 'sawtooth', 0.12, -60); noise(0.25, 0.12); },
    pickup: function () { blip(880, 0.1, 'triangle', 0.07, 400); },
    door: function () { blip(440, 0.15, 'triangle', 0.07, 220); },
    hurt: function () { blip(160, 0.15, 'square', 0.09, -80); },
    dead: function () { blip(60, 0.5, 'sawtooth', 0.12, -40); noise(0.4, 0.1); },
    dash: function () { noise(0.12, 0.05); }
  };
})();

var Fx = {
  shake: 0, hitstop: 0,
  particles: [], texts: [], casings: [], ghosts: [],
  addShake: function (v) { this.shake = Math.min(20, this.shake + v); },
  stop: function (t) { this.hitstop = Math.max(this.hitstop, t); },
  burst: function (x, y, n, color, spd) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, s = (spd || 6) * (0.3 + Math.random());
      this.particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.3 + Math.random() * 0.3, color: color || '#fff' });
    }
  },
  casing: function (x, y) {
    this.casings.push({ x: x, y: y, vx: (Math.random() - 0.5) * 4, vy: -3 - Math.random() * 2, life: 0.5 });
  },
  ghost: function (x, y) { this.ghosts.push({ x: x, y: y, life: 0.25 }); },
  num: function (x, y, v, crit) { this.texts.push({ x: x, y: y, v: v, life: 0.6, crit: crit || false }); },
  blood: function (x, y, n) { for (var i = 0; i < n; i++) this.particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, life: 0.5, color: '#a02040' }); },
  update: function (dt) {
    this.shake = Math.max(0, this.shake - dt * 40);
    this.hitstop = Math.max(0, this.hitstop - dt);
    var ps = this.particles, i;
    for (i = ps.length - 1; i >= 0; i--) { var p = ps[i]; p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; if (p.life <= 0) ps.splice(i, 1); }
    var ts = this.texts;
    for (i = ts.length - 1; i >= 0; i--) { var t = ts[i]; t.y -= 40 * dt; t.life -= dt; if (t.life <= 0) ts.splice(i, 1); }
    var cs = this.casings;
    for (i = cs.length - 1; i >= 0; i--) { var c = cs[i]; c.x += c.vx; c.y += c.vy; c.vy += 12 * dt; c.life -= dt; if (c.life <= 0) cs.splice(i, 1); }
    var gs = this.ghosts;
    for (i = gs.length - 1; i >= 0; i--) { gs[i].life -= dt; if (gs[i].life <= 0) gs.splice(i, 1); }
  },
  render: function (g, cam) {
    var sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    g.save(); g.translate(-cam.x + sx, -cam.y + sy);
    var i;
    for (i = 0; i < this.ghosts.length; i++) { var gh = this.ghosts[i]; g.fillStyle = 'rgba(140,200,255,' + (gh.life * 2.4) + ')'; g.fillRect(gh.x - 8, gh.y - 8, 16, 16); }
    g.fillStyle = '#caa93a';
    for (i = 0; i < this.casings.length; i++) g.fillRect(this.casings[i].x, this.casings[i].y, 3, 3);
    for (i = 0; i < this.particles.length; i++) { var p = this.particles[i]; g.fillStyle = p.color; g.fillRect(p.x - 2, p.y - 2, 4, 4); }
    g.font = 'bold 12px monospace';
    for (var j = 0; j < this.texts.length; j++) {
      var t = this.texts[j];
      g.fillStyle = t.crit ? '#ffd23c' : '#ffffff';
      g.globalAlpha = Math.min(1, t.life * 2.5);
      g.fillText(t.v, t.x, t.y);
      g.globalAlpha = 1;
    }
    g.restore();
  }
};

var Engine = {
  step: 1 / 60, acc: 0, last: 0,
  reset: function () { this.acc = 0; this.last = 0; },
  advance: function (ts, update, render) {
    var dt = Math.min(0.1, (ts - (this.last || ts)) / 1000);
    this.last = ts;
    this.acc += dt;
    while (this.acc >= this.step) { update(this.step); this.acc -= this.step; }
    render();
  }
};
