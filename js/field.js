// Original little armies for this page. Round-headed sprout scouts and
// hooded dust grunts, drawn with canvas shapes. No borrowed sprites.

const LANES = [0.4, 0.52, 0.64, 0.76];

export function mountField(canvas) {
  const ctx = canvas.getContext("2d");
  const effects = [];
  let confetti = [];
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
    };
    ctx.clearRect(0, 0, w, h);
    drawBackdrop(ctx, scene);
    drawDepthWash(ctx, scene, bids, asks);
    drawTracks(ctx, scene);
    drawFort(ctx, scene, "buy");
    drawFort(ctx, scene, "sell");
    drawFront(ctx, scene);
    drawCrowd(ctx, scene);
    drawEffects(ctx, scene);
    if (!reduced) drawConfetti(ctx, scene, confetti);
    if (scene.celebrate && !reduced) {
      ctx.save();
      const left = Math.max(0, (celebrateUntil - now) / 6000);
      ctx.globalAlpha = 0.12 * left;
      ctx.fillStyle = scene.celebrate === "buy" ? "#b6ffd8" : "#ffc2ae";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    } else if (now >= celebrateUntil) {
      celebrateSide = null;
    }
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
      const life =
        event.type === "airdrop" ? 1800 : event.type === "bomb" ? 1500 : event.type === "liq" ? 1600 : event.tier === "volley" ? 1200 : 980;
      effects.push({
        ...event,
        born: performance.now(),
        life,
        lane: 0.16 + Math.random() * 0.68,
      });
      if (effects.length > 80) effects.splice(0, effects.length - 80);
    },
    celebrate(side) {
      celebrateSide = side;
      celebrateUntil = performance.now() + 6000;
      if (reduced) return;
      const now = performance.now();
      for (let i = 0; i < 22; i += 1) {
        confetti.push({
          side,
          born: now + i * 18,
          life: 1300 + Math.random() * 600,
          x: side === "buy" ? 0.12 + Math.random() * 0.28 : 0.6 + Math.random() * 0.28,
          drift: (Math.random() - 0.5) * 0.08,
        });
      }
    },
    clear() {
      effects.length = 0;
      confetti = [];
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
  const { w, h } = scene;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#243044");
  sky.addColorStop(0.28, "#3c4d46");
  sky.addColorStop(0.28, "#6a8a52");
  sky.addColorStop(1, "#2b3a28");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255, 244, 210, 0.8)";
  for (let i = 0; i < 16; i += 1) {
    const x = ((i * 97) % 100) / 100 * w;
    const y = ((i * 37) % 22) / 100 * h;
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  ctx.fillStyle = "#5f7d48";
  ctx.beginPath();
  ctx.moveTo(0, h * 0.32);
  ctx.quadraticCurveTo(w * 0.2, h * 0.24, w * 0.4, h * 0.31);
  ctx.lineTo(w * 0.4, h * 0.36);
  ctx.lineTo(0, h * 0.36);
  ctx.fill();
  ctx.fillStyle = "#6d5a48";
  ctx.beginPath();
  ctx.moveTo(w, h * 0.33);
  ctx.quadraticCurveTo(w * 0.78, h * 0.25, w * 0.58, h * 0.32);
  ctx.lineTo(w * 0.58, h * 0.37);
  ctx.lineTo(w, h * 0.37);
  ctx.fill();
  const dirt = ctx.createLinearGradient(0, h * 0.34, 0, h);
  dirt.addColorStop(0, "#6e8b4e");
  dirt.addColorStop(1, "#3e4d32");
  ctx.fillStyle = dirt;
  ctx.fillRect(0, h * 0.34, w, h);
  ctx.fillStyle = "rgba(80, 170, 140, 0.16)";
  ctx.fillRect(0, h * 0.34, scene.front, h);
  ctx.fillStyle = "rgba(180, 70, 48, 0.12)";
  ctx.fillRect(scene.front, h * 0.34, w - scene.front, h);
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
  const { w, h } = scene;
  ctx.strokeStyle = "rgba(255, 236, 190, 0.16)";
  ctx.lineWidth = 2;
  for (const lane of LANES) {
    const y = h * lane + 8;
    ctx.beginPath();
    ctx.moveTo(w * 0.1, y);
    ctx.lineTo(w * 0.9, y);
    ctx.stroke();
  }
}

function drawFort(ctx, scene, side) {
  const buy = side === "buy";
  const { w, h, scale, now, reduced, celebrate } = scene;
  const x = buy ? w * 0.08 : w * 0.92;
  const foot = h * 0.84;
  const s = scale;
  ctx.save();
  ctx.translate(x, foot);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 4, 28 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = buy ? "#246b49" : "#6a4034";
  roundRect(ctx, -30 * s, -16 * s, 60 * s, 22 * s, 5 * s);
  ctx.fill();
  ctx.fillStyle = buy ? "#3e9a6c" : "#8d5344";
  roundRect(ctx, -18 * s, -62 * s, 36 * s, 50 * s, 7 * s);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = buy ? "#f2e2a8" : "#ffd0b4";
  ctx.fillRect(-8 * s, -42 * s, 7 * s, 8 * s);
  ctx.fillRect(3 * s, -42 * s, 7 * s, 8 * s);
  ctx.fillStyle = buy ? "#173628" : "#2a1814";
  roundRect(ctx, -6 * s, -14 * s, 12 * s, 16 * s, 2 * s);
  ctx.fill();
  const wave = reduced ? 0 : Math.sin(now / 500) * 2 * s;
  const pole = buy ? 20 * s : -20 * s;
  ctx.strokeStyle = buy ? "#d9f5a8" : "#f0c7b0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pole, -62 * s);
  ctx.lineTo(pole, -84 * s);
  ctx.stroke();
  ctx.fillStyle = buy ? "#9be27a" : "#e25b45";
  ctx.beginPath();
  ctx.moveTo(pole, -84 * s + wave);
  ctx.lineTo(pole + (buy ? 16 : -16) * s, -78 * s);
  ctx.lineTo(pole, -72 * s);
  ctx.fill();
  ctx.restore();
  drawPerson(ctx, x, foot - 64 * s, {
    side,
    kind: "scout",
    scale: s * 0.62,
    phase: now / 280,
    pose: celebrate === side ? "cheer" : "idle",
    reduced,
  });
}

function drawFront(ctx, scene) {
  const { h, front, now, reduced } = scene;
  const glow = reduced ? 0.9 : 0.65 + Math.sin(now / 400) * 0.25;
  ctx.strokeStyle = `rgba(255, 228, 170, ${glow})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(front, h * 0.36);
  ctx.lineTo(front, h * 0.9);
  ctx.stroke();
  ctx.fillStyle = "#f4e2b0";
  ctx.beginPath();
  ctx.moveTo(front, h * 0.36);
  ctx.lineTo(front + 14, h * 0.36 + 8);
  ctx.lineTo(front, h * 0.36 + 16);
  ctx.fill();
}

function drawCrowd(ctx, scene) {
  const { h, now, reduced, w, scale } = scene;
  const ranks = w < 640 ? 2 : 3;
  for (let lane = 0; lane < LANES.length; lane += 1) {
    const foot = h * LANES[lane];
    for (const side of ["buy", "sell"]) {
      for (let rank = 0; rank < ranks; rank += 1) {
        const kind = rank === ranks - 1 ? "archer" : "scout";
        const march = reduced ? 0 : Math.sin(now / 520 + lane + rank) * 5 * scale * (side === "buy" ? 1 : -1);
        drawPerson(ctx, slotX(scene, side, rank, ranks) + march, foot, {
          side,
          kind,
          scale: scale * (kind === "archer" ? 1.08 : 0.96),
          phase: now / 180 + lane * 1.3 + rank,
          pose: poseFor(scene, side, lane, kind, rank === ranks - 1 ? 2 : rank),
          reduced,
        });
      }
    }
  }
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
  ctx.fillText("蓝军 · 芽兵", 13, 22);
  ctx.fillText("苔堡", 13, 40);
  ctx.fillStyle = "#f3fff6";
  ctx.fillText("蓝军 · 芽兵", 12, 21);
  ctx.fillStyle = "#d9ffb0";
  ctx.fillText("苔堡", 12, 39);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillText("红军 · 尘卒", w - 11, 22);
  ctx.fillText("骨寨", w - 11, 40);
  ctx.fillStyle = "#fff4ee";
  ctx.fillText("红军 · 尘卒", w - 12, 21);
  ctx.fillStyle = "#ffc7b4";
  ctx.fillText("骨寨", w - 12, 39);
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

  ctx.fillStyle = buy ? (options.kind === "archer" ? "#7ddea0" : "#1fa978") : options.kind === "archer" ? "#ff8a6a" : "#d24b38";
  roundRect(ctx, -6 * s, -22 * s, 12 * s, 14 * s, 4 * s);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = buy ? "#f6d7b0" : "#f4e6d6";
  ctx.beginPath();
  ctx.arc(0, -28 * s, 6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (!buy) {
    ctx.strokeStyle = "#7a3028";
    ctx.lineWidth = 2.4 * s;
    ctx.beginPath();
    ctx.arc(0, -29 * s, 6.4 * s, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#8ed45a";
    ctx.beginPath();
    ctx.ellipse(-2.4 * s, -34 * s, 4 * s, 2 * s, -0.7, 0, Math.PI * 2);
    ctx.ellipse(2.6 * s, -34.2 * s, 4.2 * s, 2.1 * s, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

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

  if (options.kind === "archer" && pose !== "fall") {
    ctx.strokeStyle = buy ? "#e4ffb0" : "#ffe1c8";
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    const bx = face * 11 * s;
    ctx.arc(bx, -16 * s, 6 * s, face === 1 ? -1.15 : Math.PI - 1.15, face === 1 ? 1.15 : Math.PI + 1.15);
    ctx.stroke();
  } else if (pose === "aim") {
    ctx.strokeStyle = buy ? "#d9f29a" : "#f0d8c4";
    ctx.lineWidth = 1.8 * s;
    ctx.beginPath();
    ctx.moveTo(face * 8 * s, -16 * s);
    ctx.lineTo(face * 15 * s, -20 * s);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShot(ctx, effect, raw, w, y, front, scale, reduced) {
  const buy = effect.side === "buy";
  const p = reduced ? 1 : ease(Math.min(1, raw));
  const start = buy ? w * 0.22 : w * 0.78;
  const end = buy ? front - 8 : front + 8;
  const x = start + (end - start) * p;
  const size = effect.tier === "volley" ? 7 : effect.tier === "dust" ? 3.2 : 4.5;
  ctx.fillStyle = buy ? "#f4ffcf" : "#ffe7d4";
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = buy ? "#8ee07a" : "#e07a58";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - (buy ? 1 : -1) * (10 + size), y + 1);
  ctx.stroke();
  if (effect.tier === "volley") {
    ctx.beginPath();
    ctx.arc(x, y, size + 3, 0, Math.PI * 2);
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
  const radius = (12 + blast * 42) * scale;
  ctx.fillStyle = buy ? `rgba(210, 255, 140, ${0.45 * (1 - blast)})` : `rgba(255, 150, 90, ${0.5 * (1 - blast)})`;
  ctx.strokeStyle = "#fff4d2";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(boom, y, radius, 0, Math.PI * 2);
  ctx.fill();
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
    if ((effect.type === "bomb" && effect.side !== side && raw > 0.38 && rank === 2) || (effect.type === "liq" && effect.side === side && rank === 2)) {
      return "fall";
    }
    if (effect.type === "airdrop" && effect.side === side && raw > 0.5) return "cheer";
    if ((effect.type === "shot" || effect.type == null) && effect.side === side && kind === "archer" && raw < 0.45) return "aim";
    if (effect.type === "bomb" && effect.side === side && kind === "archer" && raw < 0.38) return "aim";
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
