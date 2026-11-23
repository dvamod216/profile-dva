(() => {
  const canvas = document.getElementById('gardenCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const viewport = document.getElementById('viewport');
  const stage = document.querySelector('.garden-stage');
  const loading = document.getElementById('loading');
  const hint = document.getElementById('voxelHint');
  const blockCountEl = document.getElementById('blockCount');
  const audioBtn = document.getElementById('audioBtn');
  const themeSwitch = document.getElementById('themeSwitch');
  const search = document.getElementById('siteSearch');
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  const buildToggle = document.getElementById('buildToggle');
  const buildPanel = document.getElementById('buildPanel');
  const dither = document.querySelector('.dither-curtain');

  let W = 480, H = 288, t = 0, last = performance.now();
  const cam = { x: 0, y: 0, tx: 0, ty: 0, zoom: 1, tzoom: 1 };
  const keys = {};
  const player = { x: 0, y: 0, vy: 0, grounded: true, dir: 1, step: 0 };
  let mode = 'explore';
  let night = false;
  let blocks = [];
  try { blocks = JSON.parse(localStorage.getItem('garden-clone-blocks') || '[]'); } catch (e) { blocks = []; }
  blockCountEl.textContent = blocks.length;

  const C = {
    skyTop: '#dce9d8', skyMid: '#f4d7bc', skyLow: '#f6c4a4',
    sun: '#ffe9ac', sunCore: '#fff6d8',
    hillFar: '#b8cfb2', hillNear: '#9dbc9a',
    water: '#9cbfb4', waterLight: '#c8ded0', waterDark: '#7fa89b',
    grass: '#9cbb70', grassLight: '#c3d994', grassDark: '#6e9158',
    dirt: '#9a7657', dirtDark: '#795a43', stone: '#88938a', stoneDark: '#69796e',
    trunk: '#8a6547', trunkDark: '#624733',
    leaf: '#7f9f6b', leafLight: '#a9c68a', leafDark: '#587951',
    rope: '#b99a70', plank: '#b98f60', plankDark: '#8c6847',
    flower: ['#f2d06b', '#e68d8d', '#e9e2d2', '#b9a0d8'],
    character: '#4c5d52', characterLight: '#e9dfc8', characterAccent: '#d08b68'
  };

  function resize() {
    const r = viewport.getBoundingClientRect();
    const scale = 2;
    W = Math.max(200, Math.floor(r.width / scale));
    H = Math.max(150, Math.floor(r.height / scale));
    canvas.width = W; canvas.height = H;
    if (!player.x) { player.x = W * 0.3; player.y = groundAt(player.x) - 14; }
    drawDither();
  }

  function px(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }

  function groundAt(x) {
    const lx = W * 0.31, lw = W * 0.34, rx = W * 0.73, rw = W * 0.27;
    const leftTop = H * 0.62, rightTop = H * 0.58, bridge = H * 0.66;
    if (x > lx - lw / 2 && x < lx + lw / 2) return leftTop;
    if (x > rx - rw / 2 && x < rx + rw / 2) return rightTop;
    if (x >= lx + lw / 2 && x <= rx - rw / 2) return bridge;
    return H + 20;
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.75);
    if (night) {
      g.addColorStop(0, '#1c3038'); g.addColorStop(.55, '#2b4650'); g.addColorStop(1, '#3c5a5c');
    } else {
      g.addColorStop(0, C.skyTop); g.addColorStop(.52, C.skyMid); g.addColorStop(1, C.skyLow);
    }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    if (night) {
      for (let i = 0; i < 46; i++) {
        const sx = (i * 97 % 409) / 409 * W;
        const sy = (i * 61 % 137) / 137 * H * .52;
        const tw = .45 + .55 * Math.sin(t * 1.4 + i);
        px(sx, sy, 1, 1, `rgba(235,244,222,${.3 + tw * .5})`);
      }
      px(W * .78, H * .13, 3, 3, '#f3efd8');
      px(W * .78 - 1, H * .13 + 1, 5, 1, '#f3efd8');
      px(W * .78 + 1, H * .13 - 1, 1, 5, '#f3efd8');
    } else {
      const sx = W * .74 - cam.x * .25, sy = H * .30 - cam.y * .2;
      for (let r = 7; r >= 1; r--) {
        ctx.fillStyle = `rgba(255,233,180,${.018 * (8 - r)})`;
        ctx.beginPath(); ctx.arc(sx, sy, r * 6, 0, Math.PI * 2); ctx.fill();
      }
      pixelCircle(sx, sy, 15, C.sun);
      pixelCircle(sx, sy, 11, C.sunCore);
    }
  }

  function pixelCircle(cx, cy, r, color) {
    for (let y = -r; y <= r; y += 2) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      px(cx - half, cy + y, half * 2, 2, color);
    }
  }

  function drawClouds() {
    const list = [[.12, .16, 1], [.42, .10, .75], [.62, .22, .6], [.9, .13, .8]];
    for (let i = 0; i < list.length; i++) {
      const [fx, fy, s] = list[i];
      let x = ((fx * W + t * (2 + i) - cam.x * .6) % (W + 120)) - 60;
      const y = fy * H - cam.y * .3;
      const col = night ? 'rgba(190,210,205,.09)' : 'rgba(255,250,237,.55)';
      px(x, y, 34 * s, 4 * s, col);
      px(x + 6 * s, y - 4 * s, 22 * s, 4 * s, col);
      px(x + 12 * s, y - 7 * s, 11 * s, 4 * s, col);
      px(x + 2 * s, y + 4 * s, 24 * s, 2 * s, col);
    }
  }

  function drawHills() {
    const horizon = H * .64;
    for (let layer = 0; layer < 2; layer++) {
      const col = night ? (layer ? '#2c4245' : '#223a40') : (layer ? C.hillNear : C.hillFar);
      const amp = layer ? 16 : 24, off = layer ? .4 : 0;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(0, horizon + 20);
      for (let x = 0; x <= W; x += 4) {
        const y = horizon - amp * (.5 + .5 * Math.sin(x * .012 + off + layer)) - cam.y * .12;
        ctx.lineTo(x, Math.round(y / 3) * 3);
      }
      ctx.lineTo(W, horizon + 20); ctx.closePath(); ctx.fill();
    }
  }

  function drawWater() {
    const wy = H * .655;
    const g = ctx.createLinearGradient(0, wy, 0, H);
    if (night) { g.addColorStop(0, '#355459'); g.addColorStop(1, '#1b3038'); }
    else { g.addColorStop(0, C.water); g.addColorStop(1, '#79a397'); }
    ctx.fillStyle = g; ctx.fillRect(0, wy, W, H - wy);
    for (let y = wy + 3; y < H; y += 5) {
      const shift = Math.sin(t * .8 + y * .06) * 3;
      const len = 8 + ((y * 7) % 22);
      for (let x = -30; x < W; x += len + 14) {
        const xx = x + shift + ((y * 13) % 17);
        px(xx, y, len, 1, night ? 'rgba(190,225,215,.10)' : 'rgba(255,255,245,.22)');
      }
    }
    const sx = W * .74 - cam.x * .25;
    for (let y = wy + 3; y < H * .92; y += 4) {
      const w = (1 - (y - wy) / (H - wy)) * 18 + 2;
      px(sx - w / 2 + Math.sin(t + y) * 2, y, w, 1, night ? 'rgba(240,225,170,.10)' : 'rgba(255,240,190,.28)');
    }
  }

  function drawIsland(cx, top, w, seed) {
    const b = 4;
    const steps = Math.floor((H - top) / b);
    for (let s = 0; s < steps; s++) {
      const y = top + s * b;
      const t01 = s / steps;
      const half = (w / 2) * (1 - Math.pow(t01, 1.7) * .55) + Math.sin(s * .8 + seed) * 3;
      const left = cx - half, right = cx + half;
      if (s < 2) {
        px(left, y, right - left, b, C.grassLight);
        px(left, y + b, right - left, b, C.grass);
      } else if (s < 6) {
        px(left, y, right - left, b, s % 2 ? C.grassDark : C.grass);
        px(left, y + b, right - left, b, C.dirt);
      } else if (s < steps - 6) {
        px(left, y, right - left, b, C.dirt);
        for (let k = 0; k < 3; k++) {
          const speck = left + 8 + ((k * 37 + s * 19 + seed * 11) % Math.max(1, right - left - 16));
          px(speck, y + 1, 2, 2, C.dirtDark);
        }
      } else {
        px(left, y, right - left, b, C.stone);
        px(left, y + b * .5, right - left, b * .5, C.stoneDark);
      }
    }
    for (let k = 0; k < 16; k++) {
      const gx = cx - w / 2 + 8 + ((k * 47 + seed * 29) % (w - 16));
      px(gx, top - 2 - (k % 3), 1, 2 + (k % 3), C.grassLight);
    }
  }

  function drawTree(x, y, s) {
    const h = 26 * s;
    px(x - 2 * s, y - h, 4 * s, h, C.trunk);
    px(x + s, y - h, 2 * s, h, C.trunkDark);
    const cy = y - h - 4 * s;
    for (let i = 0; i < 5; i++) {
      const ox = (i - 2) * 5 * s, oy = Math.abs(i - 2) * 3 * s;
      px(x + ox - 8 * s, cy + oy - 6 * s, 16 * s, 9 * s, C.leafDark);
      px(x + ox - 7 * s, cy + oy - 8 * s, 14 * s, 8 * s, C.leaf);
      px(x + ox - 5 * s, cy + oy - 9 * s, 9 * s, 4 * s, C.leafLight);
    }
  }

  function drawBush(x, y, s) {
    px(x - 7 * s, y - 5 * s, 14 * s, 6 * s, C.leafDark);
    px(x - 6 * s, y - 7 * s, 11 * s, 6 * s, C.leaf);
    px(x - 3 * s, y - 8 * s, 5 * s, 3 * s, C.leafLight);
  }

  function drawFlowers(x, y, seed) {
    for (let i = 0; i < 8; i++) {
      const fx = x - 50 + ((i * 31 + seed * 17) % 100);
      const fy = y - 2 - (i % 3);
      px(fx, fy, 1, 2, C.grassDark);
      px(fx - 1, fy - 1, 3, 2, C.flower[(i + seed) % C.flower.length]);
      px(fx, fy - 1, 1, 1, '#fff8dd');
    }
  }

  function drawLantern(x, y) {
    px(x - 1, y - 26, 3, 26, C.trunkDark);
    px(x - 5, y - 30, 11, 3, C.trunk);
    px(x - 4, y - 29, 9, 8, '#e6b861');
    px(x - 3, y - 28, 7, 6, night ? '#ffe9a0' : '#f3d08a');
    px(x - 2, y - 27, 5, 4, '#fff2c0');
    if (night) {
      ctx.fillStyle = 'rgba(255,225,150,.12)';
      ctx.beginPath(); ctx.arc(x, y - 25, 26 + Math.sin(t * 2) * 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawBridge(leftX, rightX, y) {
    const sag = 13;
    for (let layer = 0; layer < 2; layer++) {
      ctx.strokeStyle = C.rope; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = leftX; x <= rightX; x += 3) {
        const p = (x - leftX) / (rightX - leftX);
        const ry = y - 12 + Math.sin(p * Math.PI) * sag + layer * 9;
        if (x === leftX) ctx.moveTo(x, ry); else ctx.lineTo(x, ry);
      }
      ctx.stroke();
    }
    for (let x = leftX + 2; x < rightX - 1; x += 7) {
      const p = (x - leftX) / (rightX - leftX);
      const py = y - 12 + Math.sin(p * Math.PI) * sag;
      px(x, py + 9, 6, 3, C.plank);
      px(x, py + 11, 6, 1, C.plankDark);
      px(x, py, 1, 9, C.rope);
    }
  }

  function drawBlocks() {
    for (const b of blocks) {
      px(b.x - 4, b.y - 4, 8, 8, b.c || C.leaf);
      px(b.x - 4, b.y - 4, 8, 2, 'rgba(255,255,255,.18)');
      px(b.x - 4, b.y + 2, 8, 2, 'rgba(0,0,0,.16)');
    }
  }

  function drawPlayer() {
    const x = player.x, y = player.y;
    const bob = player.grounded ? Math.sin(t * 9) * (keys.a || keys.d ? 1 : .35) : 0;
    const yy = y + bob;
    px(x - 3, yy - 13, 6, 5, C.characterLight);
    px(x - 2, yy - 12, 1, 1, '#2d3b34');
    px(x + 1, yy - 12, 1, 1, '#2d3b34');
    px(x - 4, yy - 8, 8, 6, C.character);
    px(x + player.dir * 3, yy - 7, 2, 4, C.characterAccent);
    const sw = player.grounded ? Math.round(Math.sin(t * 9) * 2) : 1;
    px(x - 3, yy - 2, 2, 3 + sw, '#3b4b42');
    px(x + 1, yy - 2, 2, 3 - sw, '#3b4b42');
  }

  function drawFireflies() {
    if (!night && Math.random() > .02) return;
    for (let i = 0; i < 14; i++) {
      const fx = (i * 79 % 389) / 389 * W + Math.sin(t * .6 + i) * 6;
      const fy = H * .45 + ((i * 43) % 100) / 100 * H * .35 + Math.cos(t * .8 + i * 2) * 5;
      const a = .25 + .55 * (.5 + .5 * Math.sin(t * 2 + i * 1.7));
      ctx.fillStyle = `rgba(255,236,160,${a})`;
      ctx.beginPath(); ctx.arc(fx, fy, 1.4, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawBirds() {
    if (night) return;
    for (let i = 0; i < 3; i++) {
      const bx = ((t * 6 + i * 130) % (W + 80)) - 40;
      const by = H * .18 + i * 11 + Math.sin(t + i) * 3;
      const flap = Math.sin(t * 5 + i) > 0 ? 1 : -1;
      px(bx, by, 2, 1, '#6b7d70'); px(bx + 2, by - flap, 2, 1, '#6b7d70');
      px(bx + 4, by, 2, 1, '#6b7d70'); px(bx + 6, by - flap, 2, 1, '#6b7d70');
    }
  }

  function draw() {
    ctx.save();
    ctx.fillStyle = night ? '#263a43' : '#c7dcd0';
    ctx.fillRect(0, 0, W, H);
    cam.x += (cam.tx - cam.x) * .08;
    cam.y += (cam.ty - cam.y) * .08;
    cam.zoom += (cam.tzoom - cam.zoom) * .1;

    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-W / 2, -H / 2);
    ctx.translate(-cam.x, -cam.y);

    drawSky();
    drawClouds();
    drawBirds();
    drawHills();
    drawWater();

    const lx = W * .31, lw = W * .34, rx = W * .73, rw = W * .27;
    const leftTop = H * .62, rightTop = H * .58;
    drawIsland(lx, leftTop, lw, 1);
    drawIsland(rx, rightTop, rw, 4);
    drawBridge(lx + lw / 2 - 2, rx - rw / 2 + 2, H * .66);

    drawTree(lx - lw * .26, leftTop, 1.05);
    drawTree(lx - lw * .06, leftTop, .75);
    drawTree(lx + lw * .22, leftTop, .9);
    drawTree(rx - rw * .2, rightTop, .8);
    drawTree(rx + rw * .22, rightTop, 1);
    drawBush(lx + lw * .08, leftTop, 1);
    drawBush(rx - rw * .02, rightTop, .85);
    drawLantern(lx + lw * .34, leftTop);
    drawFlowers(lx, leftTop, 1);
    drawFlowers(rx, rightTop, 3);
    drawBlocks();
    drawPlayer();
    drawFireflies();
    ctx.restore();
  }

  function drawDither() {
    if (!dither) return;
    const r = dither.getBoundingClientRect();
    dither.width = Math.min(900, Math.floor(r.width));
    dither.height = 248;
    const d = dither.getContext('2d');
    d.clearRect(0, 0, dither.width, dither.height);
    d.fillStyle = document.documentElement.classList.contains('dark') ? 'rgba(250,250,250,.5)' : 'rgba(38,38,38,.5)';
    for (let y = 0; y < 248; y += 3) {
      for (let x = 0; x < dither.width; x += 3) {
        if ((x / 3 + y / 3) % 2 === 0 && Math.random() > .35) d.fillRect(x, y, 1, 1);
      }
    }
  }

  function loop(now) {
    t += Math.min(.05, (now - last) / 1000); last = now;
    const speed = 46;
    let moving = false;
    if (keys.a || keys.arrowleft) { player.x -= speed * .016; player.dir = -1; moving = true; }
    if (keys.d || keys.arrowright) { player.x += speed * .016; player.dir = 1; moving = true; }
    player.x = Math.max(12, Math.min(W - 12, player.x));
    if ((keys.w || keys.arrowup || keys[' ']) && player.grounded) { player.vy = -3.2; player.grounded = false; }
    if (!player.grounded) {
      player.vy += .16; player.y += player.vy * 2.2;
      if (player.y >= groundAt(player.x) - 14) { player.y = groundAt(player.x) - 14; player.vy = 0; player.grounded = true; }
    } else {
      player.y += (groundAt(player.x) - 14 - player.y) * .2;
    }
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (k === ' ' && document.activeElement === canvas) e.preventDefault();
    if ((e.metaKey || e.ctrlKey) && k === 'k') { e.preventDefault(); openSearch(true); }
    if (e.key === 'Escape') openSearch(false);
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  let dragging = false, dragStart = null;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    if (mode === 'build') {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * W;
      const y = (e.clientY - r.top) / r.height * H;
      if (y > H * .3 && y < H * .8) {
        blocks.push({ x: Math.round((x + cam.x - W / 2) / cam.zoom + W / 2), y: Math.round((y + cam.y - H / 2) / cam.zoom + H / 2), c: C.leaf });
        if (blocks.length > 512) blocks.shift();
        try { localStorage.setItem('garden-clone-blocks', JSON.stringify(blocks)); } catch (err) {}
        blockCountEl.textContent = blocks.length;
        hint.textContent = `Placed block ${blocks.length}. Your world is saved locally.`;
      }
    } else {
      dragging = true; dragStart = { x: e.clientX, y: e.clientY, cx: cam.tx, cy: cam.ty };
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    cam.tx = Math.max(-26, Math.min(26, dragStart.cx + (e.clientX - dragStart.x) * .1));
    cam.ty = Math.max(-16, Math.min(16, dragStart.cy + (e.clientY - dragStart.y) * .08));
  });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    cam.tzoom = Math.max(.8, Math.min(1.8, cam.tzoom - e.deltaY * .0008));
  }, { passive: false });

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      document.querySelectorAll('.mode-btn').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      stage.dataset.mode = mode;
      hint.textContent = mode === 'build' ? 'Click inside the scene to place a block.' : 'Wander freely. Take the long way around.';
    });
  });

  themeSwitch.addEventListener('click', () => {
    const dark = document.documentElement.classList.toggle('dark');
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) {}
    themeSwitch.setAttribute('aria-checked', String(dark));
    themeSwitch.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    drawDither();
  });
  themeSwitch.setAttribute('aria-checked', String(document.documentElement.classList.contains('dark')));

  let audioCtx = null, audioNodes = [];
  audioBtn.addEventListener('click', () => {
    const on = audioBtn.getAttribute('aria-pressed') === 'true';
    if (!on) {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      audioCtx.resume();
      const master = audioCtx.createGain(); master.gain.value = .035;
      master.connect(audioCtx.destination);
      [110, 165, 220].forEach((f, i) => {
        const osc = audioCtx.createOscillator(); osc.type = i === 2 ? 'triangle' : 'sine'; osc.frequency.value = f;
        const g = audioCtx.createGain(); g.gain.value = .25 / (i + 1);
        const lfo = audioCtx.createOscillator(); lfo.frequency.value = .07 + i * .03;
        const lg = audioCtx.createGain(); lg.gain.value = .12;
        lfo.connect(lg); lg.connect(g.gain);
        osc.connect(g); g.connect(master); osc.start(); lfo.start();
        audioNodes.push(osc, lfo);
      });
      audioBtn.setAttribute('aria-pressed', 'true');
      audioBtn.setAttribute('aria-label', 'Disable garden sounds');
    } else {
      audioNodes.forEach(n => { try { n.stop(); } catch (e) {} });
      audioNodes = [];
      audioBtn.setAttribute('aria-pressed', 'false');
      audioBtn.setAttribute('aria-label', 'Enable garden sounds');
    }
  });

  function openSearch(open) {
    search.classList.toggle('is-open', open);
    searchResults.hidden = !open;
    if (open) searchInput.focus(); else searchInput.blur();
  }
  searchInput.addEventListener('focus', () => openSearch(true));
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase();
    searchResults.querySelectorAll('.site-search__option').forEach(o => {
      o.hidden = q ? !o.textContent.toLowerCase().includes(q) : false;
    });
  });
  searchResults.querySelectorAll('.site-search__option').forEach(o => {
    o.addEventListener('click', () => { window.location.hash = o.dataset.href; openSearch(false); });
  });
  document.addEventListener('click', e => { if (!search.contains(e.target)) openSearch(false); });

  buildToggle.addEventListener('click', () => {
    const open = buildToggle.getAttribute('aria-expanded') === 'true';
    buildToggle.setAttribute('aria-expanded', String(!open));
    document.querySelector('.site-footer__build').dataset.open = String(!open);
    buildPanel.style.height = open ? '0px' : buildPanel.scrollHeight + 'px';
  });

  window.addEventListener('resize', () => { resize(); drawDither(); });
  resize();
  requestAnimationFrame(loop);
  setTimeout(() => loading.classList.add('is-hidden'), 750);
})();
