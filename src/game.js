var cam = { x: 0, y: 0, follow: function (tx, ty, dt) { this.x += (tx - this.x) * Math.min(1, dt * 8); this.y += (ty - this.y) * Math.min(1, dt * 8); } };

var WEAPONS = [
  { name: '手枪', dmg: 8, rate: 0.3, spread: 0.05, speed: 500, ammo: 120, reload: 0.8, knock: 60 },
  { name: '霰弹枪', dmg: 5, rate: 0.7, spread: 0.35, speed: 420, ammo: 60, reload: 1.2, knock: 160, pellets: 5 },
  { name: '冲锋枪', dmg: 4, rate: 0.09, spread: 0.12, speed: 560, ammo: 200, reload: 1.0, knock: 30 },
  { name: '激光', dmg: 14, rate: 0.5, spread: 0, speed: 900, ammo: 80, reload: 1.0, knock: 40, laser: true },
  { name: '火箭筒', dmg: 30, rate: 0.9, spread: 0.03, speed: 320, ammo: 24, reload: 1.5, knock: 220, blast: 60 },
  { name: '轨道炮', dmg: 45, rate: 1.1, spread: 0, speed: 1200, ammo: 18, reload: 1.6, knock: 300, pierce: true }
];

var PASSIVES = [
  { name: '力量手环', d: '伤害+25%', f: function (p) { p.dmgMul *= 1.25; } },
  { name: '扳机润滑油', d: '射速+25%', f: function (p) { p.rateMul *= 0.75; } },
  { name: '疾风靴', d: '移速+20%', f: function (p) { p.spdMul *= 1.2; } },
  { name: '铁心', d: '最大生命+2', f: function (p) { p.maxHp += 2; p.hp += 2; } },
  { name: '穿甲弹头', d: '子弹穿透', f: function (p) { p.pierce = true; } },
  { name: '反弹护板', d: '子弹反弹1次', f: function (p) { p.bounce = true; } },
  { name: '追踪芯片', d: '子弹追踪', f: function (p) { p.homing = true; } },
  { name: '鹰眼', d: '暴击率+20%', f: function (p) { p.crit += 0.2; } }
];
var ACTIVES = [
  { name: '炸弹', cd: 20 },
  { name: '时间减速', cd: 15 },
  { name: '护盾', cd: 25 },
  { name: '治疗', cd: 30 }
];

var ROOM_W = 640, ROOM_H = 440, WALL = 24;

var ENEMY_TYPES = {
  slime: { hp: 18, spd: 70, r: 14, color: '#5ad15a', touch: 8 },
  gunner: { hp: 22, spd: 45, r: 13, color: '#e0b050', range: 300, cd: 1.6, dmg: 6 },
  dasher: { hp: 14, spd: 90, r: 12, color: '#e06050', dash: 320, dmg: 10 },
  bat: { hp: 10, spd: 130, r: 10, color: '#b070e0', touch: 5 },
  turret: { hp: 30, spd: 0, r: 16, color: '#8090a0', cd: 2.2, dmg: 6 },
  splitter: { hp: 24, spd: 55, r: 16, color: '#40c0c0', touch: 8 }
};

function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

var Game = {
  player: null, floor: 1, roomMap: null, room: null,
  bullets: [], ebullets: [], enemies: [], pickups: [], props: [],
  state: 'title', paused: false, slow: 0, shield: 0, mapOn: false,
  kills: 0,

  init: function () {
    this.player = {
      x: ROOM_W / 2, y: ROOM_H / 2, hp: 6, maxHp: 6, armor: 0, coins: 0, keys: 0,
      weapon: 0, owned: [0], ammo: WEAPONS[0].ammo, reserve: 60, cd: 0, reload: 0, rt: 0,
      roll: 0, rollCd: 0, inv: 0, active: -1, activeCd: 0, mods: {}
    };
    this.floor = 1; this.kills = 0;
    this.genFloor();
  },

  genFloor: function () {
    var rooms = [{ gx: 0, gy: 0, type: 'start', cleared: true, seen: true }];
    var map = {}; map['0,0'] = rooms[0];
    function nbr(r) {
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]], opts = [];
      for (var i = 0; i < dirs.length; i++) {
        var k = (r.gx + dirs[i][0]) + ',' + (r.gy + dirs[i][1]);
        if (!map[k]) opts.push(k);
      }
      return opts.length ? pick(opts) : null;
    }
    var n = 8 + Math.floor(Math.random() * 5);
    while (rooms.length < n - 3) {
      var base = pick(rooms), k = nbr(base);
      if (!k) continue;
      var r = { gx: +k.split(',')[0], gy: +k.split(',')[1], type: 'combat', cleared: false, seen: false };
      rooms.push(r); map[k] = r;
    }
    var leaf = null;
    for (var i = rooms.length - 1; i > 0; i--) {
      var cnt = 0;
      for (var j = 1; j < rooms.length; j++) if (dist(rooms[j].gx, rooms[j].gy, rooms[i].gx, rooms[i].gy) === 1) cnt++;
      if (cnt <= 1 && rooms[i].type === 'combat') { leaf = rooms[i]; break; }
    }
    if (!leaf) leaf = rooms[rooms.length - 1];
    var specials = ['treasure', 'shop', 'boss'], sp;
    for (var s = 0; s < 3; s++) {
      var k2 = nbr(leaf) || nbr(pick(rooms));
      if (!k2) k2 = nbr(rooms[0]);
      if (!k2) continue;
      var r2 = { gx: +k2.split(',')[0], gy: +k2.split(',')[1], type: specials[s], cleared: specials[s] !== 'boss', seen: false };
      rooms.push(r2); map[k2] = r2;
      if (s === 2) sp = r2;
    }
    this.roomMap = map;
    this.rooms = rooms;
    this.room = rooms[0];
    this.enterRoom(this.room, true);
  },

  neighbors: function (r) {
    var out = [], dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var i = 0; i < 4; i++) {
      var nr = this.roomMap[(r.gx + dirs[i][0]) + ',' + (r.gy + dirs[i][1])];
      if (nr) out.push({ dir: i, room: nr });
    }
    return out;
  },

  enterRoom: function (r, spawn) {
    this.room = r; r.seen = true;
    this.bullets = []; this.ebullets = []; this.enemies = []; this.pickups = []; this.props = [];
    this.slow = 0; this.shield = 0;
    var p = this.player;
    p.x = ROOM_W / 2; p.y = ROOM_H / 2;
    if (!r.looted) {
      r.looted = true;
      var type = r.type;
      if (type === 'treasure') {
        var it = pick(PASSIVES);
        this.props.push({ x: ROOM_W / 2, y: ROOM_H / 2 - 40, kind: 'item', item: it, price: 0 });
      } else if (type === 'shop') {
        var w = 1 + Math.floor(Math.random() * (WEAPONS.length - 1));
        this.props.push({ x: ROOM_W / 2 - 100, y: ROOM_H / 2, kind: 'weapon', item: w, price: 25 });
        this.props.push({ x: ROOM_W / 2 + 10, y: ROOM_H / 2, kind: 'item', item: pick(PASSIVES), price: 30 });
        this.props.push({ x: ROOM_W / 2 + 110, y: ROOM_H / 2, kind: 'active', item: Math.floor(Math.random() * ACTIVES.length), price: 20 });
      }
    }
    if (spawn && r.type === 'start') {
      this.pickups.push({ x: ROOM_W / 2 - 60, y: ROOM_H / 2, kind: 'ammo' });
      this.pickups.push({ x: ROOM_W / 2 + 60, y: ROOM_H / 2, kind: 'coin' });
    }
    if (!r.cleared) this.spawnEnemies(r);
    cam.x = p.x - 320; cam.y = p.y - 240;
  },

  spawnEnemies: function (r) {
    var diff = this.floor;
    if (r.type === 'boss') { this.spawnBoss(); return; }
    var count = 3 + Math.floor(Math.random() * 3) + diff;
    var pool = ['slime', 'gunner', 'bat'];
    if (diff >= 2) pool.push('dasher');
    if (diff >= 2) pool.push('turret');
    if (diff >= 3) pool.push('splitter');
    for (var i = 0; i < count; i++) {
      var t = pick(pool), d = ENEMY_TYPES[t];
      var x, y, tries = 0;
      do { x = WALL + 40 + Math.random() * (ROOM_W - 2 * WALL - 80); y = WALL + 40 + Math.random() * (ROOM_H - 2 * WALL - 80); tries++; }
      while (dist(x, y, this.player.x, this.player.y) < 160 && tries < 20);
      this.enemies.push({ type: t, x: x, y: y, hp: d.hp + diff * 4, maxHp: d.hp + diff * 4, r: d.r, cd: 1 + Math.random(), flash: 0, t: Math.random() * 6, dx: 0, dy: 0 });
    }
  },

  spawnBoss: function () {
    this.enemies.push({
      type: 'boss', x: ROOM_W / 2, y: 120, hp: 300 + this.floor * 120, maxHp: 300 + this.floor * 120,
      r: 32, cd: 2, flash: 0, t: 0, phase: 1, sweep: 0, sweepDir: 1
    });
  },

  doorOpen: function () { return this.room.cleared; },
  doorAt: function (x, y) {
    var cx = ROOM_W / 2, cy = ROOM_H / 2;
    if (x > cx - 30 && x < cx + 30) {
      if (y < WALL) return 0; if (y > ROOM_H - WALL) return 2;
    }
    if (y > cy - 30 && y < cy + 30) {
      if (x < WALL) return 3; if (x > ROOM_W - WALL) return 1;
    }
    return -1;
  },

  update: function (dt) {
    if (this.state === 'title') {
      if (Input.mouse.down || Input.pressed['Space']) { this.state = 'play'; Sfx.pickup(); }
      Fx.update(dt); Input.endFrame(); return;
    }
    if (Input.consume('Escape')) this.paused = !this.paused;
    if (Input.consume('Tab')) this.mapOn = !this.mapOn;
    if (this.paused || this.state === 'dead') { Fx.update(dt); Input.endFrame(); return; }
    if (Fx.hitstop > 0) { Fx.update(dt); Input.endFrame(); return; }
    var ts = this.slow > 0 ? 0.4 : 1;
    if (this.slow > 0) this.slow -= dt;
    if (this.shield > 0) this.shield -= dt;
    this.updatePlayer(dt);
    this.updateEnemies(dt * ts);
    this.updateBullets(dt * ts);
    this.updatePickups(dt);
    cam.follow(this.player.x, this.player.y, dt);
    Fx.update(dt);
    Input.endFrame();
  },

  updatePlayer: function (dt) {
    var p = this.player, ax = Input.axis();
    var spd = 200 * p.spdMul;
    if (Input.consume('Space') && p.roll <= 0 && p.rollCd <= 0) {
      p.roll = 0.28; p.rollCd = 0.6; p.inv = 0.35; p.rvx = ax.x; p.rvy = ax.y; Sfx.dash();
    }
    if (p.roll > 0) {
      p.roll -= dt;
      p.x += (p.rvx || ax.x) * 420 * dt; p.y += (p.rvy || ax.y) * 420 * dt;
      if (Math.random() < 0.6) Fx.ghost(p.x, p.y);
    } else {
      p.x += ax.x * spd * dt; p.y += ax.y * spd * dt;
    }
    if (p.rollCd > 0) p.rollCd -= dt;
    if (p.inv > 0) p.inv -= dt;
    if (p.cd > 0) p.cd -= dt;
    if (p.reload > 0) {
      p.reload -= dt;
      if (p.reload <= 0) { var need = WEAPONS[p.weapon].ammo - p.ammo; var take = Math.min(need, p.reserve); p.ammo += take; p.reserve -= take; Sfx.pickup(); }
    }
    if (Input.consume('KeyR') && p.reload <= 0 && p.ammo < WEAPONS[p.weapon].ammo && p.reserve > 0) { p.reload = WEAPONS[p.weapon].reload; p.rt = p.reload; }
    if (Input.consume('KeyE')) this.interact();
    if (Input.consume('KeyQ') && p.active >= 0 && p.activeCd <= 0) this.useActive();
    var aim = this.aimVec();
    if ((Input.mouse.down || Input.touchAim.active) && p.cd <= 0 && p.reload <= 0) this.fire(aim);
    var d = this.doorAt(p.x, p.y);
    if (d >= 0 && this.doorOpen()) {
      var dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      var nr = this.roomMap[(this.room.gx + dirs[d][0]) + ',' + (this.room.gy + dirs[d][1])];
      if (nr) { Sfx.door(); this.enterRoom(nr); }
    }
    this.clamp(p, 8);
  },

  aimVec: function () {
    var p = this.player;
    var mx = Input.mouse.x + cam.x, my = Input.mouse.y + cam.y;
    var dx = mx - p.x, dy = my - p.y, l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
  },

  clamp: function (o, pad) {
    var cx = ROOM_W / 2, cy = ROOM_H / 2, open = this.doorOpen();
    if (open && o.y < WALL + pad && Math.abs(o.x - cx) < 28) { o.x = cx + (o.x - cx) * 0.5; return; }
    if (open && o.y > ROOM_H - WALL - pad && Math.abs(o.x - cx) < 28) return;
    if (open && o.x < WALL + pad && Math.abs(o.y - cy) < 28) return;
    if (open && o.x > ROOM_W - WALL - pad && Math.abs(o.y - cy) < 28) return;
    o.x = Math.max(WALL + pad, Math.min(ROOM_W - WALL - pad, o.x));
    o.y = Math.max(WALL + pad, Math.min(ROOM_H - WALL - pad, o.y));
  },

  fire: function (aim) {
    var p = this.player, w = WEAPONS[p.weapon];
    if (p.ammo <= 0) { if (p.reserve > 0) { p.reload = w.reload; p.rt = p.reload; } return; }
    p.cd = w.rate * p.rateMul; p.ammo--;
    var n = w.pellets || 1;
    for (var i = 0; i < n; i++) {
      var a = Math.atan2(aim.y, aim.x) + (Math.random() - 0.5) * w.spread * 2;
      var crit = Math.random() < p.crit;
      this.bullets.push({
        x: p.x + aim.x * 14, y: p.y + aim.y * 14,
        vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
        dmg: w.dmg * p.dmgMul * (crit ? 2 : 1), crit: crit,
        life: 1.6, blast: w.blast || 0, pierce: w.pierce || p.pierce,
        bounce: p.bounce ? 1 : 0, homing: p.homing, laser: w.laser, hitSet: {}
      });
    }
    Fx.addShake(2); Sfx.shoot(); if (w.laser) Sfx.laser();
    Fx.casing(p.x - aim.y * 10, p.y + aim.x * 10);
    Fx.burst(p.x + aim.x * 16, p.y + aim.y * 16, 3, '#ffd070', 3);
    p.kx = aim.x * w.knock; p.ky = aim.y * w.knock;
  },

  useActive: function () {
    var p = this.player, a = ACTIVES[p.active];
    p.activeCd = a.cd;
    if (a.name === '炸弹') {
      Fx.addShake(14); Sfx.boom(); Fx.stop(0.1);
      Fx.burst(p.x, p.y, 40, '#ff8030', 10);
      for (var i = this.enemies.length - 1; i >= 0; i--) this.damageEnemy(this.enemies[i], 60, true);
      this.ebullets = [];
    } else if (a.name === '时间减速') { this.slow = 5; Sfx.door(); }
    else if (a.name === '护盾') { this.shield = 6; Sfx.pickup(); }
    else { p.hp = Math.min(p.maxHp, p.hp + 2); Fx.burst(p.x, p.y, 12, '#60e080', 4); Sfx.pickup(); }
  },

  interact: function () {
    var p = this.player;
    for (var i = this.props.length - 1; i >= 0; i--) {
      var it = this.props[i];
      if (dist(p.x, p.y, it.x, it.y) < 40) {
        if (p.coins < it.price) { Fx.num(it.x, it.y - 20, '金币不足', false); return; }
        p.coins -= it.price;
        if (it.kind === 'weapon') {
          if (p.owned.indexOf(it.item) < 0) p.owned.push(it.item);
          p.weapon = it.item; p.ammo = WEAPONS[it.item].ammo; p.reserve = Math.max(p.reserve, 30);
        } else if (it.kind === 'item') { it.item.f(p.mods === undefined ? p : p); this.applyPassive(it.item); }
        else { p.active = it.item; p.activeCd = 0; }
        Fx.burst(it.x, it.y, 10, '#ffd23c', 5); Sfx.pickup();
        this.props.splice(i, 1);
        return;
      }
    }
  },

  applyPassive: function (it) {
    var p = this.player, m = p.mods;
    if (it.name === '力量手环') m.dmg = (m.dmg || 1) * 1.25;
    else if (it.name === '扳机润滑油') m.rate = (m.rate || 1) * 0.75;
    else if (it.name === '疾风靴') m.spd = (m.spd || 1) * 1.2;
    else if (it.name === '铁心') { p.maxHp += 2; p.hp += 2; }
    else if (it.name === '穿甲弹头') p.pierce = true;
    else if (it.name === '反弹护板') p.bounce = true;
    else if (it.name === '追踪芯片') p.homing = true;
    else if (it.name === '鹰眼') p.crit = (p.crit || 0) + 0.2;
    p.dmgMul = m.dmg || 1; p.rateMul = m.rate || 1; p.spdMul = m.spd || 1;
  },

  damageEnemy: function (e, dmg, noKnock) {
    e.hp -= dmg; e.flash = 0.1;
    Fx.num(e.x, e.y - e.r - 6, Math.round(dmg), dmg >= 15);
    Fx.burst(e.x, e.y, 4, '#fff', 4); Fx.stop(0.02); Sfx.hit();
    if (e.hp <= 0) this.killEnemy(e);
  },

  killEnemy: function (e) {
    var i = this.enemies.indexOf(e);
    if (i < 0) return;
    this.enemies.splice(i, 1);
    this.kills++;
    Fx.blood(e.x, e.y, 10); Fx.burst(e.x, e.y, 8, ENEMY_TYPES[e.type] ? ENEMY_TYPES[e.type].color : '#f55', 6);
    Fx.addShake(4); Sfx.dead();
    var r = Math.random();
    if (e.type === 'splitter' && e.r > 10) {
      for (var s = 0; s < 2; s++) this.enemies.push({ type: 'splitter', x: e.x + (s ? 14 : -14), y: e.y, hp: 8, maxHp: 8, r: 9, cd: 1, flash: 0, t: 0, dx: 0, dy: 0 });
    }
    if (e.type === 'boss') {
      this.room.cleared = true;
      for (var k = 0; k < 8; k++) this.pickups.push({ x: e.x + (Math.random() - 0.5) * 100, y: e.y + (Math.random() - 0.5) * 80, kind: 'coin' });
      this.pickups.push({ x: e.x, y: e.y, kind: 'heart' });
      this.pickups.push({ x: e.x + 40, y: e.y, kind: 'trapdoor' });
      Fx.addShake(18); Fx.stop(0.15);
      return;
    }
    if (r < 0.35) this.pickups.push({ x: e.x, y: e.y, kind: 'coin' });
    else if (r < 0.45) this.pickups.push({ x: e.x, y: e.y, kind: 'ammo' });
    else if (r < 0.52) this.pickups.push({ x: e.x, y: e.y, kind: 'heart' });
    if (this.enemies.length === 0 && !this.room.cleared) {
      this.room.cleared = true; Sfx.door();
      Fx.num(this.player.x, this.player.y - 24, '房间 cleared!', false);
      if (Math.random() < 0.4) this.pickups.push({ x: ROOM_W / 2, y: ROOM_H / 2, kind: 'coin' });
    }
  },

  updateEnemies: function (dt) {
    var p = this.player;
    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var e = this.enemies[i], d = ENEMY_TYPES[e.type];
      if (e.flash > 0) e.flash -= dt;
      e.t += dt;
      var dx = p.x - e.x, dy = p.y - e.y, dl = Math.hypot(dx, dy) || 1;
      if (e.type === 'boss') { this.bossAI(e, dt, dl, dx / dl, dy / dl); continue; }
      if (e.type === 'slime' || e.type === 'splitter') {
        e.x += dx / dl * d.spd * dt; e.y += dy / dl * d.spd * dt;
      } else if (e.type === 'gunner') {
        if (dl > d.range * 0.7) { e.x += dx / dl * d.spd * dt; e.y += dy / dl * d.spd * dt; }
        e.cd -= dt;
        if (e.cd <= 0 && dl < d.range) {
          e.cd = d.cd;
          this.enemyShot(e, dx / dl, dy / dl, d.dmg);
        }
      } else if (e.type === 'dasher') {
        if (e.cd <= 0 && dl < 200) { e.dx = dx / dl * d.dash; e.dy = dy / dl * d.dash; e.cd = 1.5; e.dt2 = 0.3; }
        e.cd -= dt;
        if (e.dt2 > 0) { e.dt2 -= dt; e.x += e.dx * dt; e.y += e.dy * dt; }
        else { e.x += dx / dl * d.spd * dt; e.y += dy / dl * d.spd * dt; }
      } else if (e.type === 'bat') {
        var s = Math.sin(e.t * 4) * 80;
        e.x += (dx / dl * d.spd - dy / dl * s) * dt;
        e.y += (dy / dl * d.spd + dx / dl * s) * dt;
      } else if (e.type === 'turret') {
        e.cd -= dt;
        if (e.cd <= 0) {
          e.cd = d.cd;
          var base = Math.atan2(dy, dx);
          for (var k = -1; k <= 1; k++) {
            var a = base + k * 0.25;
            this.enemyShot(e, Math.cos(a), Math.sin(a), d.dmg);
          }
        }
      }
      e.x = Math.max(WALL + e.r, Math.min(ROOM_W - WALL - e.r, e.x));
      e.y = Math.max(WALL + e.r, Math.min(ROOM_H - WALL - e.r, e.y));
      if (d.touch && dl < e.r + 10) this.hurtPlayer(d.touch);
    }
  },

  bossAI: function (e, dt, dl, nx, ny) {
    var p = this.player, ph = e.hp / e.maxHp > 0.66 ? 1 : e.hp / e.maxHp > 0.33 ? 2 : 3;
    if (ph !== e.phase) {
      e.phase = ph; e.cd = 1.5;
      Fx.addShake(10); Fx.burst(e.x, e.y, 20, '#ff5050', 8); Sfx.boom();
    }
    e.x += nx * 40 * dt; e.y += ny * 40 * dt;
    e.x = Math.max(WALL + e.r, Math.min(ROOM_W - WALL - e.r, e.x));
    e.y = Math.max(WALL + e.r, Math.min(ROOM_H - WALL - e.r, e.y));
    e.cd -= dt;
    if (e.sweep > 0) {
      e.sweep -= dt;
      e.sa += e.sweepDir * dt * 1.5;
      this.enemyShot(e, Math.cos(e.sa), Math.sin(e.sa), 8);
      if (e.sweep <= 0) e.cd = 1.2;
      return;
    }
    if (e.cd > 0) return;
    var a0 = Math.atan2(p.y - e.y, p.x - e.x);
    if (ph === 1) {
      e.cd = 2;
      for (var i = 0; i < 14; i++) { var a = i / 14 * Math.PI * 2; this.enemyShot(e, Math.cos(a), Math.sin(a), 7); }
    } else if (ph === 2) {
      e.cd = 1.8;
      for (var j = -3; j <= 3; j++) { var a2 = a0 + j * 0.18; this.enemyShot(e, Math.cos(a2), Math.sin(a2), 8, true); }
      this.enemies.push({ type: 'bat', x: e.x + 40, y: e.y, hp: 10, maxHp: 10, r: 10, cd: 1, flash: 0, t: 0, dx: 0, dy: 0 });
    } else {
      if (Math.random() < 0.5) {
        e.sweep = 1.5; e.sa = a0 - 0.7; e.sweepDir = Math.random() < 0.5 ? 1 : -1;
      } else {
        e.cd = 1.5;
        for (var k = 0; k < 5; k++) {
          var a3 = a0 + (Math.random() - 0.5) * 0.6;
          this.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a3) * 150, vy: Math.sin(a3) * 150, dmg: 9, life: 4, homing: true });
        }
      }
    }
  },

  enemyShot: function (e, nx, ny, dmg, homing) {
    Sfx.shoot();
    this.ebullets.push({ x: e.x, y: e.y, vx: nx * 220, vy: ny * 220, dmg: dmg + this.floor, life: 3, homing: homing || false });
  },

  updateBullets: function (dt) {
    var p = this.player, i, j;
    for (i = this.bullets.length - 1; i >= 0; i--) {
      var b = this.bullets[i];
      b.life -= dt;
      if (b.homing) {
        var best = null, bd = 250;
        for (j = 0; j < this.enemies.length; j++) {
          var dd = dist(b.x, b.y, this.enemies[j].x, this.enemies[j].y);
          if (dd < bd) { bd = dd; best = this.enemies[j]; }
        }
        if (best) {
          var hx = best.x - b.x, hy = best.y - b.y, hl = Math.hypot(hx, hy) || 1;
          b.vx += hx / hl * 900 * dt; b.vy += hy / hl * 900 * dt;
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      var dead = b.life <= 0;
      if (b.x < WALL || b.x > ROOM_W - WALL || b.y < WALL || b.y > ROOM_H - WALL) {
        if (b.bounce > 0) {
          b.bounce--;
          if (b.x < WALL || b.x > ROOM_W - WALL) b.vx *= -1;
          if (b.y < WALL || b.y > ROOM_H - WALL) b.vy *= -1;
          b.x = Math.max(WALL + 2, Math.min(ROOM_W - WALL - 2, b.x));
          b.y = Math.max(WALL + 2, Math.min(ROOM_H - WALL - 2, b.y));
        } else dead = true;
      }
      for (j = 0; j < this.enemies.length && !dead; j++) {
        var e = this.enemies[j];
        if (b.hitSet[e === undefined ? 0 : j]) continue;
        if (dist(b.x, b.y, e.x, e.y) < e.r + 4) {
          var w = WEAPONS[p.weapon];
          this.damageEnemy(e, b.dmg, false);
          e.x += b.vx / (Math.hypot(b.vx, b.vy) || 1) * (w.knock || 40) * 0.06;
          e.y += b.vy / (Math.hypot(b.vx, b.vy) || 1) * (w.knock || 40) * 0.06;
          if (b.blast) this.explode(b.x, b.y, b.blast, b.dmg);
          if (b.pierce) b.hitSet[j] = true; else dead = true;
        }
      }
      if (dead) {
        if (b.blast && b.life <= 0) this.explode(b.x, b.y, b.blast, b.dmg);
        this.bullets.splice(i, 1);
      }
    }
    for (i = this.ebullets.length - 1; i >= 0; i--) {
      var eb = this.ebullets[i];
      eb.life -= dt;
      if (eb.homing) {
        var hx2 = p.x - eb.x, hy2 = p.y - eb.y, hl2 = Math.hypot(hx2, hy2) || 1;
        eb.vx += hx2 / hl2 * 260 * dt; eb.vy += hy2 / hl2 * 260 * dt;
      }
      eb.x += eb.vx * dt; eb.y += eb.vy * dt;
      if (eb.life <= 0 || eb.x < WALL || eb.x > ROOM_W - WALL || eb.y < WALL || eb.y > ROOM_H - WALL) { this.ebullets.splice(i, 1); continue; }
      if (dist(eb.x, eb.y, p.x, p.y) < 12) {
        this.hurtPlayer(eb.dmg);
        Fx.burst(eb.x, eb.y, 5, '#f66', 4);
        this.ebullets.splice(i, 1);
      }
    }
  },

  explode: function (x, y, r, dmg) {
    Fx.addShake(8); Sfx.boom(); Fx.burst(x, y, 20, '#ff8030', 8);
    for (var i = this.enemies.length - 1; i >= 0; i--) {
      if (dist(x, y, this.enemies[i].x, this.enemies[i].y) < r) this.damageEnemy(this.enemies[i], dmg, true);
    }
  },

  hurtPlayer: function (dmg) {
    var p = this.player;
    if (p.inv > 0 || this.state !== 'play') return;
    if (this.shield > 0) { Fx.burst(p.x, p.y, 8, '#60c0ff', 5); return; }
    if (p.armor > 0) { p.armor--; dmg = Math.ceil(dmg / 2); }
    p.hp -= dmg; p.inv = 0.8;
    Fx.addShake(8); Fx.stop(0.06); Fx.blood(p.x, p.y, 6); Sfx.hurt();
    Fx.num(p.x, p.y - 20, '-' + dmg, false);
    if (p.hp <= 0) { p.hp = 0; this.state = 'dead'; Sfx.dead(); }
  },

  updatePickups: function (dt) {
    var p = this.player;
    for (var i = this.pickups.length - 1; i >= 0; i--) {
      var k = this.pickups[i];
      if (dist(p.x, p.y, k.x, k.y) > 22) continue;
      if (k.kind === 'coin') { p.coins++; Fx.num(k.x, k.y, '+1金', false); }
      else if (k.kind === 'heart') { if (p.hp >= p.maxHp) continue; p.hp = Math.min(p.maxHp, p.hp + 2); Fx.num(k.x, k.y, '+HP', false); }
      else if (k.kind === 'ammo') { p.reserve += 40; Fx.num(k.x, k.y, '+弹药', false); }
      else if (k.kind === 'trapdoor') {
        this.floor++; Fx.addShake(6); Sfx.door();
        this.genFloor();
        return;
      }
      Fx.burst(k.x, k.y, 5, '#ffd23c', 4); Sfx.pickup();
      this.pickups.splice(i, 1);
    }
  },

  render: function (g, w, h) {
    var p = this.player;
    g.fillStyle = '#0c0c14'; g.fillRect(0, 0, w, h);
    if (this.state === 'title') { this.renderTitle(g, w, h); return; }
    g.save();
    g.translate(w / 2 - cam.x, h / 2 - cam.y);
    g.fillStyle = '#1a1a26'; g.fillRect(0, 0, ROOM_W, ROOM_H);
    g.fillStyle = '#23233a';
    for (var i = 0; i < 8; i++) g.fillRect(40 + i * 74, 60 + (i % 3) * 130, 40, 40);
    g.fillStyle = this.doorOpen() ? '#3a5a3a' : '#6a3030';
    var cx = ROOM_W / 2, cy = ROOM_H / 2;
    g.fillRect(cx - 28, 0, 56, WALL); g.fillRect(cx - 28, ROOM_H - WALL, 56, WALL);
    g.fillRect(0, cy - 28, WALL, 56); g.fillRect(ROOM_W - WALL, cy - 28, WALL, 56);
    g.fillStyle = '#33334d';
    g.fillRect(0, 0, ROOM_W, WALL); g.fillRect(0, ROOM_H - WALL, ROOM_W, WALL);
    g.fillRect(0, 0, WALL, ROOM_H); g.fillRect(ROOM_W - WALL, 0, WALL, ROOM_H);
    var j;
    for (j = 0; j < this.props.length; j++) {
      var it = this.props[j];
      g.fillStyle = '#44445f'; g.fillRect(it.x - 12, it.y - 6, 24, 12);
      g.fillStyle = it.kind === 'weapon' ? '#e0c060' : it.kind === 'active' ? '#60c0e0' : '#e070e0';
      g.fillRect(it.x - 6, it.y - 20, 12, 12);
      g.fillStyle = '#fff'; g.font = '11px monospace';
      var lbl = it.kind === 'weapon' ? WEAPONS[it.item].name : it.kind === 'item' ? it.item.name : ACTIVES[it.item].name;
      g.fillText(lbl + ' ' + it.price + '金', it.x - 30, it.y - 28);
    }
    for (j = 0; j < this.pickups.length; j++) {
      var k = this.pickups[j];
      g.fillStyle = k.kind === 'coin' ? '#ffd23c' : k.kind === 'heart' ? '#ff5070' : k.kind === 'ammo' ? '#c0c080' : '#50c050';
      g.fillRect(k.x - 5, k.y - 5, 10, 10);
    }
    for (j = 0; j < this.enemies.length; j++) {
      var e = this.enemies[j];
      g.fillStyle = e.flash > 0 ? '#fff' : (e.type === 'boss' ? '#d03040' : ENEMY_TYPES[e.type].color);
      g.fillRect(e.x - e.r, e.y - e.r, e.r * 2, e.r * 2);
      if (e.type === 'boss') {
        g.fillStyle = '#000'; g.fillRect(e.x - e.r, e.y - e.r - 10, e.r * 2, 5);
        g.fillStyle = '#f33'; g.fillRect(e.x - e.r, e.y - e.r - 10, e.r * 2 * (e.hp / e.maxHp), 5);
      } else {
        g.fillStyle = '#000'; g.fillRect(e.x - e.r, e.y - e.r - 6, e.r * 2, 3);
        g.fillStyle = '#f44'; g.fillRect(e.x - e.r, e.y - e.r - 6, e.r * 2 * (e.hp / e.maxHp), 3);
      }
    }
    for (j = 0; j < this.bullets.length; j++) {
      var b = this.bullets[j];
      g.fillStyle = b.crit ? '#ffd23c' : b.laser ? '#60e0ff' : '#ffe0a0';
      g.fillRect(b.x - (b.laser ? 6 : 3), b.y - 2, b.laser ? 12 : 6, 4);
    }
    for (j = 0; j < this.ebullets.length; j++) {
      var eb = this.ebullets[j];
      g.fillStyle = eb.homing ? '#f060e0' : '#ff6050';
      g.beginPath(); g.arc(eb.x, eb.y, 5, 0, Math.PI * 2); g.fill();
    }
    if (p) {
      var blink = p.inv > 0 && Math.floor(p.inv * 20) % 2;
      g.fillStyle = blink ? '#88aaff' : '#4cd964';
      g.fillRect(p.x - 8, p.y - 8, 16, 16);
      g.fillStyle = '#fff';
      var aim = this.aimVec();
      g.fillRect(p.x + aim.x * 12 - 2, p.y + aim.y * 12 - 2, 5, 5);
      if (this.shield > 0) { g.strokeStyle = 'rgba(96,192,255,0.7)'; g.beginPath(); g.arc(p.x, p.y, 16, 0, Math.PI * 2); g.stroke(); }
    }
    Fx.render(g, { x: cam.x - (w / 2 - cam.x) + w / 2 - (w / 2 - cam.x), y: cam.y - (h / 2 - cam.y) + h / 2 - (h / 2 - cam.y) });
    g.restore();
    this.renderHUD(g, w, h);
  },

  renderHUD: function (g, w, h) {
    var p = this.player;
    g.font = '13px monospace';
    g.fillStyle = '#ff5070';
    for (var i = 0; i < p.maxHp; i += 2) g.fillText('♥', 12 + (i / 2) * 18, 22);
    g.fillStyle = '#ff90a8';
    for (var j = 0; j < p.hp; j++) g.fillText('♥', 12 + Math.floor(j / 2) * 18 + (j % 2) * 8, 22);
    g.fillStyle = '#ffd23c'; g.fillText('金 ' + p.coins, 12, 40);
    g.fillStyle = '#c0c080'; g.fillText(WEAPONS[p.weapon].name + ' ' + p.ammo + '/' + p.reserve + (p.reload > 0 ? ' 装弹中' : ''), 12, 58);
    if (p.active >= 0) g.fillStyle = '#60c0e0', g.fillText(ACTIVES[p.active].name + (p.activeCd > 0 ? ' ' + Math.ceil(p.activeCd) + 's' : ' [Q]'), 12, 76);
    g.fillStyle = '#888'; g.fillText('第' + this.floor + '层  [Tab]地图 [Space]翻滚 [R]换弹 [E]交互 [Esc]暂停', 12, h - 12);
    if (this.mapOn) this.renderMinimap(g, w, h);
    if (this.state === 'dead') {
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f55'; g.font = 'bold 32px monospace'; g.fillText('你死了', w / 2 - 60, h / 2 - 20);
      g.fillStyle = '#ccc'; g.font = '14px monospace';
      g.fillText('击杀 ' + this.kills + ' · 到达第 ' + this.floor + ' 层 · 点击/按空格重来', w / 2 - 150, h / 2 + 16);
      if (Input.mouse.down || Input.pressed['Space']) { this.state = 'play'; this.init(); }
    }
    if (this.paused) {
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff'; g.font = 'bold 24px monospace'; g.fillText('已暂停', w / 2 - 40, h / 2);
    }
  },

  renderMinimap: function (g, w, h) {
    var s = 22, ox = w - 140, oy = 60;
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(ox - 10, oy - 10, 150, 180);
    for (var i = 0; i < this.rooms.length; i++) {
      var r = this.rooms[i];
      if (!r.seen) continue;
      var x = ox + r.gx * (s + 6), y = oy + r.gy * (s + 6);
      g.fillStyle = r === this.room ? '#4cd964' : r.cleared ? '#556' : '#a55';
      g.fillRect(x, y, s, s);
      if (r.type === 'boss') { g.fillStyle = '#f33'; g.fillRect(x + s / 2 - 3, y + s / 2 - 3, 6, 6); }
      if (r.type === 'treasure') { g.fillStyle = '#e0e'; g.fillRect(x + s / 2 - 3, y + s / 2 - 3, 6, 6); }
      if (r.type === 'shop') { g.fillStyle = '#ff0'; g.fillRect(x + s / 2 - 3, y + s / 2 - 3, 6, 6); }
    }
  },

  renderTitle: function (g, w, h) {
    g.fillStyle = '#4cd964'; g.font = 'bold 36px monospace';
    g.fillText('弹壳地牢', w / 2 - 80, h / 2 - 60);
    g.fillStyle = '#aaa'; g.font = '14px monospace';
    g.fillText('WASD移动 · 鼠标瞄准射击 · 空格翻滚 · R换弹 · E交互 · Q道具', w / 2 - 260, h / 2);
    g.fillText('触屏：左半屏拖动移动 · 右半屏触摸瞄准射击', w / 2 - 190, h / 2 + 26);
    g.fillStyle = '#ffd23c';
    g.fillText('点击 / 触摸 开始', w / 2 - 70, h / 2 + 80);
  }
};

