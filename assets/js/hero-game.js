/**
 * Hero mini-game - an endless run-and-gun strip, in the spirit of the
 * browser dino game. Original art, no dependencies.
 *
 * Controls: Space / Up / W / click - jump
 *           X / Down / S           - shoot
 *           Esc                    - back to the page
 */
(function () {
  "use strict";

  var hero = document.querySelector(".hero");
  var wrap = document.getElementById("hero-game");
  var canvas = document.getElementById("game-canvas");
  var launch = document.querySelector(".game-launch");
  if (!hero || !wrap || !canvas || !launch) return;

  var ctx = canvas.getContext("2d");
  var hud = wrap.querySelector(".game-hud");
  var scoreEl = wrap.querySelector(".game-score");
  var bestEl = wrap.querySelector(".game-best");
  var msgEl = wrap.querySelector(".game-msg");

  var C = {
    lime: "#bce784",
    mint: "#5dd39e",
    teal: "#348aa7",
    slate: "#525174",
    plumDark: "#2a2036",
    plumMid: "#3b2f45",
    ground: "#1b1523",
    grass: "#3d6b55",
    ink: "#17111d",
    body: "#3d6b55",
    limb: "#2f5544"
  };

  /* ---------------------------------------------------------- state */
  var W = 0, H = 0, dpr = 1;
  var groundY = 0;
  var running = false, over = false, raf = 0, lastT = 0;
  var speed, dist, score, best = 0, spawnIn, shootCd, shake;
  var player, obstacles, bullets, foeShots, bits;
  var mills, clouds;

  try {
    best = parseInt(localStorage.getItem("tg-run-best") || "0", 10) || 0;
  } catch (e) {
    best = 0;
  }

  /* ---------------------------------------------------------- sizing */
  function resize() {
    var r = wrap.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    groundY = H - 64;
    if (player) player.y = Math.min(player.y, groundY - player.h);
  }

  /* ---------------------------------------------------------- reset */
  function reset() {
    speed = 320;
    dist = 0;
    score = 0;
    spawnIn = 0.9;
    shootCd = 0;
    shake = 0;
    over = false;
    obstacles = [];
    bullets = [];
    foeShots = [];
    bits = [];
    player = { x: 86, y: groundY - 40, w: 26, h: 40, vy: 0, onGround: true, fire: 0 };
    seedScenery();
    updateHud();
  }

  /* Scenery sits at random world positions and is recycled off the left edge
     with a fresh random gap, so nothing lands on a visible rhythm. */
  function seedScenery() {
    mills = [];
    var mx = 320;
    for (var i = 0; i < 3; i++) {
      mills.push({ wx: mx, s: 0.7 + Math.random() * 0.45 });
      mx += 620 + Math.random() * 900;
    }

    clouds = [];
    var cx = 60;
    for (var c = 0; c < 4; c++) {
      clouds.push(cloudSpec(cx));
      cx += 340 + Math.random() * 560;
    }
  }

  function cloudSpec(wx) {
    return {
      wx: wx,
      y: 22 + Math.random() * 76,
      s: 0.65 + Math.random() * 0.75,
      a: 0.16 + Math.random() * 0.16
    };
  }

  function farthest(list) {
    return list.reduce(function (a, b) { return Math.max(a, b.wx); }, 0);
  }

  function recycleScenery() {
    var camMill = dist * 0.42;
    var camCloud = dist * 0.12;

    mills.forEach(function (m) {
      if (m.wx - camMill < -90) {
        m.wx = Math.max(farthest(mills) + 620 + Math.random() * 900, camMill + W + 90);
        m.s = 0.7 + Math.random() * 0.45;
      }
    });

    clouds.forEach(function (c) {
      if (c.wx - camCloud < -200) {
        var fresh = cloudSpec(Math.max(farthest(clouds) + 340 + Math.random() * 560, camCloud + W + 200));
        c.wx = fresh.wx;
        c.y = fresh.y;
        c.s = fresh.s;
        c.a = fresh.a;
      }
    });
  }

  function updateHud() {
    scoreEl.textContent = String(Math.floor(score)).padStart(5, "0");
    bestEl.textContent = "HI " + String(Math.floor(best)).padStart(5, "0");
  }

  /* ---------------------------------------------------------- input */
  function jump() {
    if (!running) return;
    if (over) return restart();
    if (player.onGround) {
      player.vy = -580;
      player.onGround = false;
    }
  }

  function shoot() {
    if (!running || over || shootCd > 0) return;
    shootCd = 0.22;
    player.fire = 0.08;
    bullets.push({ x: player.x + player.w + 12, y: player.y + 14, w: 14, h: 3 });
  }

  function onKey(e) {
    if (!running) return;
    var k = e.key;
    if (k === " " || k === "Spacebar" || k === "ArrowUp" || k === "w" || k === "W") {
      e.preventDefault();
      jump();
    } else if (k === "x" || k === "X" || k === "ArrowDown" || k === "s" || k === "S") {
      e.preventDefault();
      shoot();
    } else if (k === "Escape") {
      e.preventDefault();
      stop();
    }
  }

  /* ---------------------------------------------------------- loop */
  function spawn() {
    var roll = Math.random();
    var canFly = score > 300;
    var canGun = score > 150;

    if (canGun && roll < 0.3) {
      // Gunner: stands and fires back. Jump the shots or take it out first.
      obstacles.push({
        x: W + 30, y: groundY - 34, w: 22, h: 34,
        kind: "gunner", hp: 2, fireIn: 0.85, flash: 0
      });
    } else if (canFly && roll < 0.62) {
      // Drones ride a sine path. Later on they arrive as a squadron whose
      // staggered phases trace a visible wave across the screen.
      var count = score > 600 && Math.random() < 0.45 ? 3 : 1;
      var base = groundY - (58 + Math.random() * 28);
      var amp = 18 + Math.random() * 16;
      var freq = 3.2 + Math.random() * 2.2;
      var phase = Math.random() * Math.PI * 2;
      for (var k = 0; k < count; k++) {
        obstacles.push({
          x: W + 30 + k * 66,
          y: base,
          w: 30, h: 20,
          kind: "drone",
          base: base, amp: amp, freq: freq,
          ph: phase + k * 0.95
        });
      }
    } else {
      var h = 24 + Math.round(Math.random() * 16);
      obstacles.push({ x: W + 30, y: groundY - h, w: 20 + Math.round(Math.random() * 10), h: h, kind: "crate" });
    }
    spawnIn = Math.max(0.58, 1.3 - dist / 9000) + Math.random() * 0.55;
  }

  function hits(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function burst(x, y, color) {
    for (var i = 0; i < 10; i++) {
      bits.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 260,
        vy: (Math.random() - 0.8) * 260,
        life: 0.5 + Math.random() * 0.3,
        c: color
      });
    }
  }

  function update(dt) {
    dist += speed * dt;
    score += speed * dt * 0.06;
    speed = Math.min(760, 320 + dist / 46);
    recycleScenery();
    if (shootCd > 0) shootCd -= dt;
    if (player.fire > 0) player.fire -= dt;
    if (shake > 0) shake -= dt;

    // player physics
    player.vy += 1750 * dt;
    player.y += player.vy * dt;
    if (player.y + player.h >= groundY) {
      player.y = groundY - player.h;
      player.vy = 0;
      player.onGround = true;
    }

    // spawning
    spawnIn -= dt;
    if (spawnIn <= 0) spawn();

    // obstacles
    for (var i = obstacles.length - 1; i >= 0; i--) {
      var o = obstacles[i];
      o.x -= speed * dt;
      if (o.kind === "drone") {
        o.ph += dt * o.freq;
        var wy = o.base + Math.sin(o.ph) * o.amp;
        // Stay clear of the floor and within jump-clearing range.
        o.y = Math.max(groundY - 124, Math.min(groundY - 26, wy));
      } else if (o.kind === "gunner") {
        if (o.flash > 0) o.flash -= dt;
        // Only fires once it is properly on screen and still ahead of you.
        if (o.x < W - 40 && o.x > player.x + 60) {
          o.fireIn -= dt;
          if (o.fireIn <= 0) {
            o.fireIn = 1.25 + Math.random() * 0.5;
            o.flash = 0.1;
            foeShots.push({ x: o.x - 6, y: o.y + 11, w: 12, h: 4 });
          }
        }
      }
      if (o.x + o.w < -40) {
        obstacles.splice(i, 1);
        continue;
      }
      if (hits(player, o)) return die();
    }

    // incoming fire
    for (var f = foeShots.length - 1; f >= 0; f--) {
      var fs = foeShots[f];
      fs.x -= (speed + 250) * dt;
      if (fs.x + fs.w < -20) {
        foeShots.splice(f, 1);
        continue;
      }
      if (hits(player, fs)) return die();
    }

    // bullets
    for (var b = bullets.length - 1; b >= 0; b--) {
      var bu = bullets[b];
      bu.x += 760 * dt;
      if (bu.x > W + 20) {
        bullets.splice(b, 1);
        continue;
      }
      var struck = false;
      for (var j = obstacles.length - 1; j >= 0 && !struck; j--) {
        var t = obstacles[j];
        if (!hits(bu, t)) continue;
        struck = true;
        bullets.splice(b, 1);

        if (t.kind === "gunner" && --t.hp > 0) {
          // Winged, not down - flash and keep coming.
          burst(t.x + t.w / 2, t.y + t.h / 2, C.mint);
          shake = 0.08;
          break;
        }

        burst(t.x + t.w / 2, t.y + t.h / 2,
              t.kind === "drone" ? C.teal : t.kind === "gunner" ? C.mint : C.lime);
        obstacles.splice(j, 1);
        score += t.kind === "gunner" ? 100 : 50;
        shake = t.kind === "gunner" ? 0.18 : 0.12;
      }
    }

    // particles
    for (var p = bits.length - 1; p >= 0; p--) {
      var bit = bits[p];
      bit.life -= dt;
      if (bit.life <= 0) {
        bits.splice(p, 1);
        continue;
      }
      bit.vy += 900 * dt;
      bit.x += bit.vx * dt;
      bit.y += bit.vy * dt;
    }

    updateHud();
  }

  function die() {
    over = true;
    shake = 0.3;
    burst(player.x + player.w / 2, player.y + player.h / 2, C.lime);
    if (score > best) {
      best = score;
      try {
        localStorage.setItem("tg-run-best", String(Math.floor(best)));
      } catch (e) { /* private mode - just keep it for this session */ }
    }
    updateHud();
    msgEl.innerHTML =
      "<strong>Game over</strong><span>Space or click to retry &middot; Esc to exit</span>";
    msgEl.classList.add("is-shown");
  }

  function restart() {
    msgEl.classList.remove("is-shown");
    reset();
  }

  /* ---------------------------------------------------------- draw */
  function hill(off, amp, base, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    var step = 60;
    for (var x = -step; x <= W + step; x += step) {
      var px = x - (off % (step * 2));
      ctx.lineTo(px, base + Math.sin((x + off) * 0.014) * amp);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  function windmill(x, baseY, s, ang) {
    // tower
    ctx.fillStyle = C.plumMid;
    ctx.beginPath();
    ctx.moveTo(x - 5 * s, baseY);
    ctx.lineTo(x + 5 * s, baseY);
    ctx.lineTo(x + 2.5 * s, baseY - 46 * s);
    ctx.lineTo(x - 2.5 * s, baseY - 46 * s);
    ctx.closePath();
    ctx.fill();

    // blades
    var hy = baseY - 48 * s;
    ctx.save();
    ctx.translate(x, hy);
    ctx.rotate(ang);
    ctx.fillStyle = "#4b3d58";
    for (var i = 0; i < 4; i++) {
      ctx.fillRect(-1.5 * s, -1.5 * s, 26 * s, 3 * s);
      ctx.rotate(Math.PI / 2);
    }
    ctx.restore();

    ctx.fillStyle = "#57486a";
    ctx.beginPath();
    ctx.arc(x, hy, 3 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  function cloud(x, y, s, a) {
    ctx.globalAlpha = a;
    ctx.fillStyle = "#3a2f4a";
    ctx.beginPath();
    ctx.ellipse(x, y, 25 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 25 * s, y - 8 * s, 30 * s, 17 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 54 * s, y, 22 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);

    // clouds sit furthest back and drift slowest
    var camCloud = dist * 0.12;
    clouds.forEach(function (c) { cloud(c.wx - camCloud, c.y, c.s, c.a); });

    // parallax
    hill(dist * 0.18, 12, groundY - 86, C.plumDark);
    hill(dist * 0.42, 8, groundY - 46, C.plumMid);

    // windmills ride the mid layer; the ground fill below hides their feet
    var camMill = dist * 0.42;
    var spin = dist * 0.012;
    mills.forEach(function (m) {
      windmill(m.wx - camMill, groundY + 6, m.s, spin);
    });

    // ground
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = C.grass;
    ctx.fillRect(0, groundY, W, 3);

    // grass tufts
    ctx.fillStyle = C.grass;
    for (var g = 0; g < W + 60; g += 60) {
      var gx = g - (dist % 60);
      ctx.fillRect(gx, groundY - 5, 2, 5);
      ctx.fillRect(gx + 4, groundY - 7, 2, 7);
      ctx.fillRect(gx + 8, groundY - 4, 2, 4);
    }

    // obstacles
    obstacles.forEach(function (o) {
      if (o.kind === "gunner") {
        var gx = o.x, gy = o.y;
        // legs + torso
        ctx.fillStyle = C.slate;
        ctx.fillRect(gx + 4, gy + 24, 5, 10);
        ctx.fillRect(gx + 13, gy + 24, 5, 10);
        ctx.fillStyle = C.teal;
        ctx.fillRect(gx + 3, gy + 9, 16, 16);
        // head + visor
        ctx.fillRect(gx + 5, gy, 12, 9);
        ctx.fillStyle = C.mint;
        ctx.fillRect(gx + 4, gy + 3, 7, 3);
        // weapon, pointed back down the track
        ctx.fillStyle = C.slate;
        ctx.fillRect(gx - 9, gy + 10, 12, 4);
        // damage tell
        if (o.hp < 2) {
          ctx.fillStyle = C.lime;
          ctx.fillRect(gx + 3, gy + 9, 16, 2);
        }
        if (o.flash > 0) {
          ctx.fillStyle = C.lime;
          ctx.fillRect(gx - 16, gy + 8, 7, 8);
          ctx.fillStyle = "#f0f3ec";
          ctx.fillRect(gx - 13, gy + 10, 4, 4);
        }
      } else if (o.kind === "drone") {
        ctx.fillStyle = C.slate;
        ctx.fillRect(o.x, o.y + 5, o.w, o.h - 8);
        ctx.fillRect(o.x + 4, o.y, o.w - 8, 6);
        ctx.fillStyle = C.mint;
        ctx.fillRect(o.x + o.w - 9, o.y + 9, 5, 4);
      } else {
        ctx.fillStyle = C.plumMid;
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = C.lime;
        ctx.fillRect(o.x, o.y, o.w, 3);
        ctx.fillStyle = C.slate;
        ctx.fillRect(o.x + 3, o.y + 8, o.w - 6, 3);
      }
    });

    // your bullets
    ctx.fillStyle = C.lime;
    bullets.forEach(function (b) { ctx.fillRect(b.x, b.y, b.w, b.h); });

    // incoming fire - pale core over a teal trail, so it never reads as yours
    foeShots.forEach(function (f) {
      ctx.fillStyle = C.teal;
      ctx.fillRect(f.x + 4, f.y + 1, f.w + 8, 2);
      ctx.fillStyle = "#f0f3ec";
      ctx.fillRect(f.x, f.y, 7, f.h);
    });

    // particles
    bits.forEach(function (b) {
      ctx.globalAlpha = Math.max(0, b.life * 2);
      ctx.fillStyle = b.c;
      ctx.fillRect(b.x, b.y, 3, 3);
      ctx.globalAlpha = 1;
    });

    drawRunner();
    ctx.restore();
  }

  function drawRunner() {
    var p = player;
    var x = p.x, y = p.y;
    var stride = p.onGround ? Math.floor(dist / 26) % 2 : 2;

    // back arm
    ctx.fillStyle = C.limb;
    ctx.fillRect(x + 1, y + 11, 4, 9);
    // head + band
    ctx.fillStyle = C.body;
    ctx.fillRect(x + 6, y, 12, 10);
    ctx.fillStyle = C.lime;
    ctx.fillRect(x + 5, y + 2, 14, 3);
    ctx.fillRect(x, y + 2, 5, 3);
    // torso
    ctx.fillStyle = C.body;
    ctx.fillRect(x + 5, y + 10, 14, 14);
    // front arm + weapon
    ctx.fillRect(x + 17, y + 12, 8, 4);
    ctx.fillStyle = C.slate;
    ctx.fillRect(x + 23, y + 12, 12, 4);
    if (p.fire > 0) {
      ctx.fillStyle = C.lime;
      ctx.fillRect(x + 35, y + 10, 7, 8);
      ctx.fillStyle = C.mint;
      ctx.fillRect(x + 35, y + 12, 4, 4);
    }
    // legs
    ctx.fillStyle = C.limb;
    if (stride === 2) {
      ctx.fillRect(x + 5, y + 24, 5, 11);
      ctx.fillRect(x + 13, y + 24, 5, 9);
    } else if (stride === 0) {
      ctx.fillRect(x + 12, y + 24, 5, 16);
      ctx.fillRect(x + 6, y + 24, 5, 12);
      ctx.fillStyle = C.slate;
      ctx.fillRect(x + 15, y + 37, 6, 3);
    } else {
      ctx.fillRect(x + 11, y + 24, 5, 12);
      ctx.fillRect(x + 6, y + 24, 5, 16);
      ctx.fillStyle = C.slate;
      ctx.fillRect(x + 4, y + 37, 6, 3);
    }
  }

  /* ---------------------------------------------------------- frame */
  function frame(t) {
    if (!running) return;
    var dt = Math.min((t - lastT) / 1000, 0.05);
    lastT = t;
    if (!over) update(dt);
    else {
      for (var p = bits.length - 1; p >= 0; p--) {
        var b = bits[p];
        b.life -= dt;
        if (b.life <= 0) { bits.splice(p, 1); continue; }
        b.vy += 900 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }
      if (shake > 0) shake -= dt;
    }
    draw();
    raf = requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------- start/stop */
  function start() {
    if (running) return;
    running = true;
    hero.classList.add("is-playing");
    hud.hidden = false;
    msgEl.classList.remove("is-shown");
    resize();
    reset();
    lastT = performance.now();
    raf = requestAnimationFrame(frame);
    document.addEventListener("keydown", onKey);
    canvas.focus();
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    hero.classList.remove("is-playing");
    hud.hidden = true;
    msgEl.classList.remove("is-shown");
    ctx.clearRect(0, 0, W, H);
    document.removeEventListener("keydown", onKey);
    launch.focus();
  }

  /* ---------------------------------------------------------- wiring */
  launch.addEventListener("click", start);
  wrap.querySelector(".game-exit").addEventListener("click", stop);

  canvas.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    jump();
  });

  // A hidden tab already freezes rAF, so there is nothing to save by ending
  // the run - just reset the clock on return so the first frame back does not
  // arrive with a huge delta.
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && running) lastT = performance.now();
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      if (running && entries[0] && !entries[0].isIntersecting) stop();
    }, { threshold: 0.25 }).observe(hero);
  }

  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { if (running) resize(); }, 150);
  });
})();
