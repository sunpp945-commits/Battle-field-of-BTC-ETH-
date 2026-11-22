// Original fantasy battlefield for this page. Timber camps, banners, and
// helmeted soldiers are drawn in canvas. No game sprites or official names.

const LANES = [0.4, 0.52, 0.64, 0.76];

export function mountField(canvas) {
  const ctx = canvas.getContext("2d");
  const effects = [];
  const impacts = [];
  let confetti = [];
  let shakeUntil = 0;
  let bids = [];
  let asks = [];
  let buyShare = 0.5;
  let reduced = false;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let running = true;
  let celebrateUntil = 0;
  let celebrateSide = null;

  const resizeObserver = new ResizeObserver(() => resize());
  if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);
  resize();
  requestAnimationFrame(frame);

  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const nextW = Math.max(1, Math.floor(rect.width));
    const nextH = Math.max(1, Math.floor(rect.height));
    const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
    if (nextW === width && nextH === height && nextDpr === dpr) return;
    width = nextW;
    height = nextH;
    dpr = nextDpr;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
  }

  function frame(now) {
    if (!running) return;
    if (width > 2 && height > 2) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(now);
    }
    requestAnimationFrame(frame);
  }

  function draw(now) {
    const w = width;
    const h = height;
    const scale = clamp(h / 480, 0.82, 1.4);
    const front = w * (0.4 + 0.2 * clamp(buyShare, 0, 1));
    const scene = {
      w,
      h,
      scale,
      front,
      now,
      reduced,
      effects,
      celebrate: celebrateSide && now < celebrateUntil ? celebrateSide : null,
      impacts,
    };
    const heavy = effects.some((effect) => effect.type === "bomb" || effect.type === "liq" || effect.type === "airdrop");
    const shake = !reduced && (now < shakeUntil || (scene.celebrate && heavy)) ? 5 * scale : 0;
    ctx.save();
    if (shake) ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
    ctx.clearRect(-20, -20, w + 40, h + 40);
    drawBackdrop(ctx, scene);
    drawDepthWash(ctx, scene, bids, asks);
    drawTracks(ctx, scene);
    drawFort(ctx, scene, "buy");
    drawFort(ctx, scene, "sell");
    drawFront(ctx, scene);
    drawCrowd(ctx, scene);
    drawEffects(ctx, scene);
    if (!reduced) drawConfetti(ctx, scene, confetti);
    if (scene.celebrate) {
      const left = Math.max(0, (celebrateUntil - now) / 6000);
      ctx.save();
      ctx.globalAlpha = (reduced ? 0.12 : 0.28) * left;
      ctx.fillStyle = scene.celebrate === "buy" ? "#d6ff8a" : "#ffb088";
      ctx.fillRect(0, h * 0.34, w, h);
      if (!reduced) {
        ctx.globalAlpha = 0.55 * left;
        ctx.strokeStyle = scene.celebrate === "buy" ? "#f4ffb0" : "#ffe0c8";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(front, h * 0.62, (1 - left) * w * 0.45, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    } else if (now >= celebrateUntil) {
      celebrateSide = null;
    }
    ctx.restore();
    drawCaptions(ctx, w);
  }

  return {
    setBook(nextBids, nextAsks) {
      bids = Array.isArray(nextBids) ? nextBids : [];
      asks = Array.isArray(nextAsks) ? nextAsks : [];
    },
    setShare(share) {
      if (Number.isFinite(share)) buyShare = share;
    },
    setReduced(next) {
      reduced = Boolean(next);
      if (reduced) confetti = [];
    },
    spawn(event) {
      const born = performance.now();
      const life =
        event.type === "airdrop" ? 1900 : event.type === "bomb" ? 1700 : event.type === "liq" ? 1600 : event.tier === "volley" ? 900 : 640;
      const lane = 0.12 + Math.random() * 0.76;
      effects.push({ ...event, born, life, lane });
      if (event.type === "bomb" || event.type === "liq" || event.type === "airdrop") {
        if (!reduced) shakeUntil = born + (event.type === "bomb" ? 520 : 280);
      } else {
        impacts.push({
          side: event.side === "buy" ? "sell" : "buy",
          lane,
          born,
          life: 520,
        });
      }
      const shotCount = effects.reduce((n, item) => n + (item.type === "bomb" || item.type === "airdrop" || item.type === "liq" ? 0 : 1), 0);
      if (shotCount > 70) {
        const oldest = effects.findIndex((item) => item.type !== "bomb" && item.type !== "airdrop" && item.type !== "liq");
        if (oldest >= 0) effects.splice(oldest, 1);
      }
      if (effects.length > 110) effects.splice(0, effects.length - 110);
      if (impacts.length > 40) impacts.splice(0, impacts.length - 40);
    },
    celebrate(side) {
      celebrateSide = side;
      celebrateUntil = performance.now() + 6000;
      if (!reduced) shakeUntil = performance.now() + 700;
      const now = performance.now();
      const burst = reduced ? 8 : 36;
      for (let i = 0; i < burst; i += 1) {
        confetti.push({
          side,
          born: now + i * 12,
          life: 1100 + Math.random() * 700,
          x: side === "buy" ? 0.28 + Math.random() * 0.4 : 0.32 + Math.random() * 0.4,
          drift: (Math.random() - 0.5) * 0.16,
        });
      }
    },
    clear() {
      effects.length = 0;
      impacts.length = 0;
      confetti = [];
      shakeUntil = 0;
      bids = [];
      asks = [];
      buyShare = 0.5;
      celebrateSide = null;
      celebrateUntil = 0;
    },
    destroy() {
      running = false;
      resizeObserver.disconnect();
    },
  };
}

function drawBackdrop(ctx, scene) {
  const { w, h, front } = scene;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#141824");
  sky.addColorStop(0.22, "#3a2a38");
  sky.addColorStop(0.34, "#8a4a32");
  sky.addColorStop(0.34, "#4d5a38");
  sky.addColorStop(1, "#2a241c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255, 214, 160, 0.55)";
  for (let i = 0; i < 18; i += 1) {
    ctx.fillRect(((i * 97) % 100) / 100 * w, ((i * 41) % 24) / 100 * h, 1.4, 1.4);
  }
  ctx.fillStyle = "#3d4a34";
  ctx.beginPath();
  ctx.moveTo(0, h * 0.36);
  ctx.quadraticCurveTo(w * 0.22, h * 0.28, w * 0.48, h * 0.35);
  ctx.lineTo(w * 0.48, h * 0.4);
  ctx.lineTo(0, h * 0.4);
  ctx.fill();
  ctx.fillStyle = "#4a382c";
  ctx.beginPath();
  ctx.moveTo(w, h * 0.37);
  ctx.quadraticCurveTo(w * 0.74, h * 0.29, w * 0.5, h * 0.36);
  ctx.lineTo(w * 0.5, h * 0.41);
  ctx.lineTo(w, h * 0.41);
  ctx.fill();
  const dirt = ctx.createLinearGradient(0, h * 0.36, 0, h);
  dirt.addColorStop(0, "#5d6a42");
  dirt.addColorStop(0.55, "#4a4032");
  dirt.addColorStop(1, "#2c261f");
  ctx.fillStyle = dirt;
  ctx.fillRect(0, h * 0.36, w, h);
  ctx.fillStyle = "rgba(46, 110, 70, 0.28)";
  ctx.fillRect(0, h * 0.36, front, h);
  ctx.fillStyle = "rgba(120, 36, 32, 0.22)";
  ctx.fillRect(front, h * 0.36, w - front, h);
  ctx.fillStyle = "rgba(20, 14, 10, 0.45)";
  ctx.beginPath();
  ctx.ellipse(front, h * 0.72, w * 0.08, h * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawDepthWash(ctx, scene, bids, asks) {
  const bid = bookSum(bids);
  const ask = bookSum(asks);
  const max = Math.max(bid, ask, 1);
  const { w, h } = scene;
  const y = h * 0.9;
  ctx.fillStyle = `rgba(170, 245, 210, ${0.35 + 0.4 * (bid / max)})`;
  ctx.fillRect(w * 0.04, y, w * 0.22 * (0.45 + bid / max), 6);
  ctx.fillStyle = `rgba(255, 150, 110, ${0.35 + 0.4 * (ask / max)})`;
  const askW = w * 0.22 * (0.45 + ask / max);
  ctx.fillRect(w * 0.96 - askW, y, askW, 6);
}

function drawTracks(ctx, scene) {
  const { w, h, front } = scene;
  ctx.strokeStyle = "rgba(18, 14, 10, 0.55)";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  for (const lane of LANES) {
    const y = h * lane + 10;
    ctx.beginPath();
    ctx.moveTo(w * 0.08, y);
    for (let i = 1; i <= 8; i += 1) {
      const x = w * (0.08 + i * 0.1);
      const jag = i % 2 === 0 ? -5 : 6;
      if (Math.abs(x - front) < w * 0.04) continue;
      ctx.lineTo(x, y + jag);
    }
    ctx.stroke();
  }
}

function drawFort(ctx, scene, side) {
  const buy = side === "buy";
  const { w, h, scale, now, reduced, celebrate } = scene;
  const x = buy ? w * 0.09 : w * 0.91;
  const foot = h * 0.86;
  const s = scale;
  ctx.save();
  ctx.translate(x, foot);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 6, 34 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = buy ? "#3d5a34" : "#5a3028";
  roundRect(ctx, -34 * s, -18 * s, 68 * s, 24 * s, 3 * s);
  ctx.fill();
  ctx.fillStyle = buy ? "#6d5338" : "#6a4034";
  ctx.fillRect(-22 * s, -58 * s, 10 * s, 44 * s);
  ctx.fillRect(12 * s, -58 * s, 10 * s, 44 * s);
  ctx.fillStyle = buy ? "#8a6a42" : "#7a4a3c";
  ctx.fillRect(-16 * s, -46 * s, 32 * s, 32 * s);
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.strokeRect(-16 * s, -46 * s, 32 * s, 32 * s);
  ctx.fillStyle = buy ? "#d7e38a" : "#ffb088";
  ctx.fillRect(-8 * s, -36 * s, 6 * s, 7 * s);
  ctx.fillRect(3 * s, -36 * s, 6 * s, 7 * s);
  ctx.fillStyle = "#1a120e";
  ctx.fillRect(-5 * s, -16 * s, 10 * s, 16 * s);
  const wave = reduced ? 0 : Math.sin(now / 480) * 2 * s;
  const pole = buy ? -28 * s : 28 * s;
  ctx.strokeStyle = "#e6d2a8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pole, -18 * s);
  ctx.lineTo(pole, -78 * s);
  ctx.stroke();
  ctx.fillStyle = buy ? "#2f8f4e" : "#c44732";
  ctx.beginPath();
  ctx.moveTo(pole, -78 * s + wave);
  ctx.lineTo(pole + (buy ? 18 : -18) * s, -70 * s);
  ctx.lineTo(pole + (buy ? 14 : -14) * s, -64 * s);
  ctx.lineTo(pole, -66 * s);
  ctx.fill();
  ctx.restore();
  drawPerson(ctx, x, foot - 50 * s, {
    side,
    kind: "melee",
    scale: s * 0.7,
    phase: now / 280,
    pose: celebrate === side ? "cheer" : "idle",
    reduced,
  });
}

function drawFront(ctx, scene) {
  const { h, w, front, now, reduced } = scene;
  ctx.strokeStyle = "rgba(90, 70, 48, 0.9)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  let y = h * 0.38;
  ctx.moveTo(front - 6, y);
  while (y < h * 0.9) {
    y += 16;
    ctx.lineTo(front + (Math.floor(y / 16) % 2 ? 8 : -8), y);
  }
  ctx.stroke();
  ctx.strokeStyle = "#cbb892";
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    const sy = h * (0.42 + i * 0.09);
    ctx.beginPath();
    ctx.moveTo(front - 10, sy);
    ctx.lineTo(front + 4, sy - 12);
    ctx.moveTo(front + 10, sy);
    ctx.lineTo(front - 4, sy - 12);
    ctx.stroke();
  }
  const drift = reduced ? 0 : Math.sin(now / 700) * 6;
  for (let i = 0; i < 4; i += 1) {
    ctx.fillStyle = `rgba(70, 64, 60, ${0.28 + i * 0.05})`;
    ctx.beginPath();
    ctx.ellipse(front + drift * (i % 2 ? 1 : -1), h * (0.34 + i * 0.04), 18 + i * 8, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#d7c49a";
  ctx.beginPath();
  ctx.moveTo(front, h * 0.36);
  ctx.lineTo(front + 16, h * 0.4);
  ctx.lineTo(front, h * 0.44);
  ctx.fill();
  void w;
}

function drawCrowd(ctx, scene) {
  const { h, now, reduced, w, scale, front } = scene;
  const ranks = w < 560 ? 3 : 4;
  for (let lane = 0; lane < LANES.length; lane += 1) {
    const foot = h * LANES[lane] + ((lane % 2) - 0.5) * 6;
    for (const side of ["buy", "sell"]) {
      for (let rank = 0; rank < ranks; rank += 1) {
        const kind = rank === ranks - 1 ? "melee" : rank === ranks - 2 ? "archer" : "shield";
        const surge = scene.celebrate === side ? 34 * scale : 0;
        const lunge = reduced ? 0 : Math.max(0, Math.sin(now / 260 + lane * 1.7 + rank)) * (kind === "melee" ? 16 : 6) * scale;
        const dir = side === "buy" ? 1 : -1;
        const x = clashX(scene, side, rank, ranks) + dir * (lunge + surge);
        const pose = poseFor(scene, side, lane, kind, rank === ranks - 1 ? 2 : rank) || (kind === "melee" && !reduced && Math.sin(now / 260 + lane) > 0.15 ? "aim" : "idle");
        drawPerson(ctx, x, foot, {
          side,
          kind,
          scale: scale * (kind === "melee" ? 1.05 : 0.88),
          phase: now / 140 + lane + rank,
          pose,
          reduced,
        });
      }
    }
  }
  void front;
}

function clashX(scene, side, rank, ranks) {
  const { w, front, scale } = scene;
  const pad = 10 * scale;
  if (rank === ranks - 1) {
    return side === "buy" ? front - pad : front + pad;
  }
  const t = rank / Math.max(1, ranks - 1);
  if (side === "buy") {
    const a = w * 0.16;
    const b = front - 18 * scale;
    return a + (b - a) * (0.15 + t * 0.8);
  }
  const b = w * 0.84;
  const a = front + 18 * scale;
  return b - (b - a) * (0.15 + t * 0.8);
}

function drawEffects(ctx, scene) {
  const { now, effects, h, w, front, scale, reduced } = scene;
  for (let i = effects.length - 1; i >= 0; i -= 1) {
    const effect = effects[i];
    const raw = (now - effect.born) / effect.life;
    if (raw >= 1) {
      effects.splice(i, 1);
      continue;
    }
    const lane = laneOf(effect.lane);
    const y = h * LANES[lane] - 16 * scale;
    ctx.save();
    ctx.globalAlpha = reduced ? 1 - raw : 1;
    if (effect.type === "bomb") drawBomb(ctx, effect, raw, scene, y);
    else if (effect.type === "airdrop") drawAirdrop(ctx, effect, raw, scene);
    else if (effect.type === "liq") drawLiquidation(ctx, effect, raw, scene, y);
    else drawShot(ctx, effect, raw, w, y, front, scale, reduced);
    ctx.restore();
  }
}

function drawConfetti(ctx, scene, bits) {
  const { now, w, h } = scene;
  for (let i = bits.length - 1; i >= 0; i -= 1) {
    const bit = bits[i];
    const raw = (now - bit.born) / bit.life;
    if (raw >= 1) {
      bits.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = 1 - raw;
    ctx.fillStyle = bit.side === "buy" ? "#d6ff9a" : "#ffd0b8";
    ctx.fillRect(w * (bit.x + bit.drift * raw), h * (0.2 + raw * 0.45), 6, 3);
    ctx.restore();
  }
}

function drawCaptions(ctx, w) {
  ctx.font = '700 13px "WenQuanYi Micro Hei", "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillText("多军", 13, 22);
  ctx.fillText("多军营地", 13, 40);
  ctx.fillStyle = "#e7ffd2";
  ctx.fillText("多军", 12, 21);
  ctx.fillStyle = "#b6e38a";
  ctx.fillText("多军营地", 12, 39);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillText("空军", w - 11, 22);
  ctx.fillText("空军营地", w - 11, 40);
  ctx.fillStyle = "#ffe4d8";
  ctx.fillText("空军", w - 12, 21);
  ctx.fillStyle = "#ffb199";
  ctx.fillText("空军营地", w - 12, 39);
  ctx.textAlign = "left";
}

function drawPerson(ctx, x, footY, options) {
  const s = options.scale;
  const buy = options.side === "buy";
  const face = buy ? 1 : -1;
  const phase = options.reduced ? 0.4 : options.phase;
  const pose = options.pose || "idle";
  ctx.save();
  ctx.translate(x, footY);
  if (pose === "fall") ctx.rotate(face * 1.2);
  else if (pose === "cheer" && !options.reduced) ctx.translate(0, -Math.abs(Math.sin(phase * 2)) * 5 * s);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 2, 8 * s, 2.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  const step = pose === "fall" || options.reduced ? 0.25 : Math.sin(phase);
  ctx.strokeStyle = buy ? "#10281e" : "#3a2018";
  ctx.lineWidth = 2.4 * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-2.2 * s, -9 * s);
  ctx.lineTo(-2.2 * s + step * 5 * s, 0);
  ctx.moveTo(2.2 * s, -9 * s);
  ctx.lineTo(2.2 * s - step * 5 * s, 0);
  ctx.stroke();

  ctx.fillStyle = buy ? "#1d4a30" : "#6a241e";
  ctx.beginPath();
  ctx.moveTo(-8 * s, -18 * s);
  ctx.lineTo(8 * s, -18 * s);
  ctx.lineTo(5 * s, -4 * s);
  ctx.lineTo(-5 * s, -4 * s);
  ctx.fill();
  ctx.fillStyle = buy ? "#2f7a45" : "#b13a2e";
  roundRect(ctx, -6 * s, -22 * s, 12 * s, 14 * s, 3 * s);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = buy ? "#234e32" : "#4e1c22";
  ctx.beginPath();
  ctx.arc(0, -31 * s, 6.6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e7c8a4";
  ctx.beginPath();
  ctx.arc(0, -27.5 * s, 5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#1a120e";
  if (pose === "fall") {
    ctx.strokeStyle = "#1a120e";
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.moveTo(-3 * s, -30 * s);
    ctx.lineTo(-1 * s, -28 * s);
    ctx.moveTo(-1 * s, -30 * s);
    ctx.lineTo(-3 * s, -28 * s);
    ctx.moveTo(1.4 * s, -30 * s);
    ctx.lineTo(3.4 * s, -28 * s);
    ctx.moveTo(3.4 * s, -30 * s);
    ctx.lineTo(1.4 * s, -28 * s);
    ctx.stroke();
  } else {
    ctx.fillRect(-2.6 * s * face, -29.2 * s, 1.5 * s, 1.8 * s);
    ctx.fillRect(1.1 * s * face, -29.2 * s, 1.5 * s, 1.8 * s);
  }

  ctx.strokeStyle = buy ? "#f0c89a" : "#f3d2c0";
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  if (pose === "cheer") {
    ctx.moveTo(-4 * s, -18 * s);
    ctx.lineTo(-7 * s, -30 * s);
    ctx.moveTo(4 * s, -18 * s);
    ctx.lineTo(7 * s, -30 * s);
  } else if (pose === "aim") {
    ctx.moveTo(face * 4 * s, -18 * s);
    ctx.lineTo(face * 12 * s, -16 * s);
  } else {
    const swing = options.reduced ? 0.2 : Math.sin(phase) * 0.45;
    ctx.moveTo(-4 * s, -18 * s);
    ctx.lineTo(-7 * s, -12 * s + swing * 4 * s);
    ctx.moveTo(4 * s, -18 * s);
    ctx.lineTo(7 * s, -12 * s - swing * 4 * s);
  }
  ctx.stroke();

  if (pose !== "fall" && options.kind === "shield") {
    ctx.fillStyle = buy ? "#7dbe62" : "#e07a62";
    ctx.strokeStyle = "#1a120e";
    ctx.beginPath();
    ctx.moveTo(face * 8 * s, -22 * s);
    ctx.lineTo(face * 14 * s, -16 * s);
    ctx.lineTo(face * 8 * s, -8 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  if (pose !== "fall" && options.kind !== "shield") {
    ctx.strokeStyle = "#2a2118";
    ctx.lineWidth = 2.2 * s;
    ctx.beginPath();
    ctx.moveTo(face * 2 * s, -16 * s);
    ctx.lineTo(face * (pose === "aim" ? 18 : 12) * s, -18 * s);
    ctx.stroke();
    if (options.kind === "archer") {
      ctx.strokeStyle = buy ? "#d7ec9a" : "#ffd0b8";
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      const bx = face * 12 * s;
      ctx.arc(bx, -16 * s, 5.5 * s, face === 1 ? -1.2 : Math.PI - 1.2, face === 1 ? 1.2 : Math.PI + 1.2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawShot(ctx, effect, raw, w, y, front, scale, reduced) {
  const buy = effect.side === "buy";
  const p = reduced ? 1 : ease(Math.min(1, raw));
  const start = buy ? w * 0.22 : w * 0.78;
  const end = buy ? front - 8 : front + 8;
  const x = start + (end - start) * p;
  const size = effect.tier === "volley" ? 7 : effect.tier === "dust" ? 3.4 : 4.6;
  ctx.strokeStyle = buy ? "#e8ff6a" : "#ffb15a";
  ctx.lineWidth = effect.tier === "volley" ? 5 : 3.5;
  ctx.beginPath();
  ctx.moveTo(x - (buy ? 1 : -1) * (effect.tier === "volley" ? 36 : 18), y);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.fillStyle = "#fff8d0";
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  if (p > 0.72) {
    const hit = (p - 0.72) / 0.28;
    ctx.globalAlpha *= 1 - hit;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(end, y, 6 + hit * (effect.tier === "volley" ? 22 : 12), 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(end - 8, y);
    ctx.lineTo(end + 8, y);
    ctx.moveTo(end, y - 8);
    ctx.lineTo(end, y + 8);
    ctx.stroke();
  }
}

function drawBomb(ctx, effect, raw, scene, y) {
  const buy = effect.side === "buy";
  const { w, front, scale, reduced } = scene;
  const p = reduced ? 1 : raw;
  const from = buy ? front - 36 * scale : front + 36 * scale;
  const boom = buy ? front + 28 * scale : front - 28 * scale;
  if (p < 0.38) {
    const x = from + (boom - from) * ease(p / 0.38);
    ctx.fillStyle = buy ? "#e9ff9a" : "#ffd0b0";
    ctx.beginPath();
    ctx.arc(x, y, 8 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff6df";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 8 * scale);
    ctx.lineTo(x + (buy ? 5 : -5) * scale, y - 16 * scale);
    ctx.stroke();
    return;
  }
  const blast = (p - 0.38) / 0.62;
  const radius = (18 + blast * 78) * scale;
  ctx.fillStyle = `rgba(40, 24, 16, ${0.35 * (1 - blast)})`;
  ctx.beginPath();
  ctx.ellipse(boom, y + 10 * scale, radius * 0.85, radius * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = buy ? `rgba(230, 255, 120, ${0.55 * (1 - blast)})` : `rgba(255, 120, 40, ${0.62 * (1 - blast)})`;
  ctx.strokeStyle = "#fff6c8";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(boom, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha *= 0.8;
  ctx.beginPath();
  ctx.arc(boom, y, radius * (0.45 + blast * 0.4), 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8;
    ctx.beginPath();
    ctx.moveTo(boom + Math.cos(angle) * 4, y + Math.sin(angle) * 4);
    ctx.lineTo(boom + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    ctx.stroke();
  }
  paintLabel(ctx, "炸弹", boom, y - radius - 4);
}

function drawAirdrop(ctx, effect, raw, scene) {
  const buy = effect.side === "buy";
  const { w, h, scale, reduced } = scene;
  const x = buy ? w * 0.28 : w * 0.72;
  const ground = h * 0.58;
  const p = reduced ? 1 : raw;
  const y = p < 0.62 ? -20 + (ground + 20) * ease(p / 0.62) : ground;
  ctx.strokeStyle = buy ? "#d8ffc0" : "#ffd8c4";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y - 22 * scale, 14 * scale, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 14 * scale, y - 22 * scale);
  ctx.lineTo(x, y - 4 * scale);
  ctx.moveTo(x + 14 * scale, y - 22 * scale);
  ctx.lineTo(x, y - 4 * scale);
  ctx.stroke();
  drawCrate(ctx, x, y, buy, scale);
  if (p >= 0.62) {
    ctx.globalAlpha *= 1 - (p - 0.62) / 0.38;
    ctx.beginPath();
    ctx.ellipse(x, ground + 8, 16 + (p - 0.62) * 50, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    paintLabel(ctx, "空投", x, y - 40 * scale);
  }
}

function drawCrate(ctx, x, y, buy, scale) {
  const s = scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = buy ? "#2c6b45" : "#6a4636";
  ctx.strokeStyle = buy ? "#e7ffc4" : "#ffe4d2";
  ctx.lineWidth = 2;
  roundRect(ctx, -9 * s, -8 * s, 18 * s, 14 * s, 2 * s);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-9 * s, -1 * s);
  ctx.lineTo(9 * s, -1 * s);
  ctx.moveTo(0, -8 * s);
  ctx.lineTo(0, 6 * s);
  ctx.stroke();
  ctx.restore();
}

function drawLiquidation(ctx, effect, raw, scene, y) {
  const buy = effect.side === "buy";
  const x = buy ? scene.front - 34 * scene.scale : scene.front + 34 * scene.scale;
  const radius = (14 + raw * 36) * scene.scale;
  ctx.strokeStyle = "#fff8ee";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  paintLabel(ctx, "强平", x, y - radius - 6);
}

function paintLabel(ctx, text, x, y) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.font = '700 13px "WenQuanYi Micro Hei", "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = "#fff8ea";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function poseFor(scene, side, lane, kind, rank) {
  if (scene.celebrate === side) return "cheer";
  for (const effect of scene.effects) {
    if (laneOf(effect.lane) !== lane) continue;
    const raw = (scene.now - effect.born) / effect.life;
    if (raw < 0 || raw > 1) continue;
    if ((effect.type === "bomb" && effect.side !== side && raw > 0.3 && rank >= 1) || (effect.type === "liq" && effect.side === side && rank >= 1)) {
      return "fall";
    }
    for (const hit of scene.impacts || []) {
      const age = (scene.now - hit.born) / hit.life;
      if (age < 0 || age > 1) continue;
      if (hit.side === side && laneOf(hit.lane) === lane && rank === 2) return "fall";
    }
    if (effect.type === "airdrop" && effect.side === side && raw > 0.5) return "cheer";
    if ((effect.type === "shot" || effect.type == null) && effect.side === side && kind !== "shield" && raw < 0.45) return "aim";
    if (effect.type === "bomb" && effect.side === side && kind !== "shield" && raw < 0.38) return "aim";
  }
  return "idle";
}

function slotX(scene, side, rank, ranks) {
  const { w, front, scale } = scene;
  const t = ranks <= 1 ? 0.7 : rank / (ranks - 1);
  const pad = 28 * scale;
  if (side === "buy") {
    const a = w * 0.18;
    const b = Math.max(a + 48 * scale, front - pad);
    return a + (b - a) * (0.08 + t * 0.84);
  }
  const b = w * 0.82;
  const a = Math.min(b - 48 * scale, front + pad);
  return b - (b - a) * (0.08 + t * 0.84);
}

function laneOf(lane) {
  const t = clamp((Number(lane) - 0.16) / 0.68, 0, 0.999);
  return Math.min(LANES.length - 1, Math.floor(t * LANES.length));
}

function bookSum(levels) {
  if (!Array.isArray(levels)) return 0;
  let total = 0;
  for (const level of levels) {
    if (!level) continue;
    const price = Number(level[0]);
    const qty = Number(level[1]);
    if (price > 0 && qty > 0) total += price * qty;
  }
  return total;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function ease(t) {
  const p = clamp(t, 0, 1);
  return 1 - (1 - p) * (1 - p);
}
