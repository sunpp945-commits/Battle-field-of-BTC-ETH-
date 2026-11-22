// Page-side volume energy for the battlefield.
// Shares, bombs, airdrops, and victory all come from aggressive notional
// this file computes. None of them are Binance indicators.

export const RULES = Object.freeze({
  windowMs: 60_000,
  advantageShare: 0.58,
  advantageMinTotalUsd: 500_000,
  victoryHoldMs: 20_000,
  victoryBannerMs: 6_000,
  shotMinUsd: 15_000,
  volleyUsd: 50_000,
  bombUsd: 250_000,
  airdropUsd: 1_000_000,
  bombSpikeMs: 3_000,
  bombSpikeUsd: 700_000,
  bombSpikeCooldownMs: 4_000,
  airdropSurgeMs: 5_000,
  airdropSurgeUsd: 1_500_000,
  airdropSurgeCooldownMs: 10_000,
  dustUsd: 2_000,
  dustRate: 0.12,
});

export const FALLBACK_SYMBOLS = Object.freeze([
  "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT",
  "AVAXUSDT", "LINKUSDT", "DOTUSDT", "LTCUSDT", "BCHUSDT", "TRXUSDT", "TONUSDT",
  "NEARUSDT", "APTUSDT", "SUIUSDT", "ARBUSDT", "OPUSDT", "FILUSDT", "ATOMUSDT",
  "UNIUSDT", "AAVEUSDT", "INJUSDT", "TIAUSDT", "SEIUSDT", "WLDUSDT", "1000PEPEUSDT",
  "1000SHIBUSDT", "WIFUSDT", "1000BONKUSDT", "ETCUSDT", "XLMUSDT", "HBARUSDT",
  "ICPUSDT", "RENDERUSDT", "FETUSDT", "TAOUSDT", "ENAUSDT", "ONDOUSDT", "JUPUSDT",
  "STXUSDT", "RUNEUSDT", "IMXUSDT", "GRTUSDT", "LDOUSDT", "MKRUSDT", "CRVUSDT",
  "SNXUSDT", "DYDXUSDT", "GALAUSDT", "SANDUSDT", "MANAUSDT", "AXSUSDT", "APEUSDT",
  "BLURUSDT", "ORDIUSDT", "1000SATSUSDT", "BOMEUSDT", "NOTUSDT", "PEOPLEUSDT",
  "PENDLEUSDT", "EIGENUSDT", "POLUSDT", "STRKUSDT", "ZKUSDT", "PENGUUSDT",
  "TRUMPUSDT", "PYTHUSDT", "JTOUSDT", "WUSDT", "ETHFIUSDT", "SAGAUSDT", "ALTUSDT",
  "MANTAUSDT", "DYMUSDT", "AEVOUSDT", "PIXELUSDT", "PORTALUSDT", "AIUSDT",
  "XAIUSDT", "MAVUSDT", "CYBERUSDT", "ARKMUSDT", "LQTYUSDT", "MINAUSDT", "CFXUSDT",
  "SSVUSDT", "ASTRUSDT", "GMTUSDT", "ROSEUSDT", "KAVAUSDT", "ZECUSDT", "DASHUSDT",
  "XTZUSDT", "NEOUSDT", "IOTAUSDT", "THETAUSDT", "VETUSDT", "ALGOUSDT", "EOSUSDT",
  "COMPUSDT", "SUSHIUSDT", "1INCHUSDT", "ENSUSDT", "LPTUSDT", "API3USDT", "MASKUSDT",
  "YFIUSDT", "CHZUSDT", "ENJUSDT", "BATUSDT", "ZRXUSDT", "SKLUSDT", "ANKRUSDT",
  "CELOUSDT", "FLOWUSDT", "KSMUSDT", "ZILUSDT", "ONEUSDT", "QTUMUSDT", "ICXUSDT",
  "ONTUSDT", "IOSTUSDT", "BANDUSDT", "STORJUSDT", "KNCUSDT", "RSRUSDT", "OCEANUSDT",
  "CTSIUSDT", "ALICEUSDT", "TLMUSDT", "LITUSDT", "UNFIUSDT", "REEFUSDT", "DODOUSDT",
  "LINAUSDT", "AUDIOUSDT",   "CELRUSDT", "C98USDT",
]);

export function normalizeCoinId(value) {
  if (value == null) return null;
  let coin = String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (coin.endsWith("usdt")) coin = coin.slice(0, -4);
  if (!/^[a-z0-9]{2,24}$/.test(coin)) return null;
  return coin;
}

export function parseCoin(search) {
  const raw = String(search || "").replace(/^\?/, "");
  const value = new URLSearchParams(raw).get("coin");
  return normalizeCoinId(value) || "btc";
}

export function describeCoin(id) {
  const clean = normalizeCoinId(id) || "btc";
  const label = clean.toUpperCase();
  return { id: clean, symbol: `${label}USDT`, label, name: `${label} 永续` };
}

export function fallbackMarkets() {
  const seen = new Set();
  const markets = [];
  for (const symbol of FALLBACK_SYMBOLS) {
    const id = normalizeCoinId(symbol);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    markets.push({ id, symbol: `${id.toUpperCase()}USDT`, label: id.toUpperCase(), quoteVolume: 0 });
  }
  return markets;
}

export function marketsFromExchangeInfo(info) {
  const rows = info && Array.isArray(info.symbols) ? info.symbols : [];
  const markets = [];
  for (const row of rows) {
    if (!row || row.contractType !== "PERPETUAL" || row.quoteAsset !== "USDT" || row.status !== "TRADING") continue;
    if (row.marginAsset && row.marginAsset !== "USDT") continue;
    const symbol = String(row.symbol || "");
    if (!symbol.endsWith("USDT") || symbol.includes("_")) continue;
    const id = normalizeCoinId(row.baseAsset || symbol);
    if (!id) continue;
    markets.push({ id, symbol: `${id.toUpperCase()}USDT`, label: id.toUpperCase(), quoteVolume: 0 });
  }
  return markets;
}

export function marketsFromTickers(tickers) {
  if (!Array.isArray(tickers)) return [];
  const markets = [];
  const seen = new Set();
  for (const row of tickers) {
    const symbol = String(row?.symbol || "");
    if (!/^[A-Z0-9]{2,24}USDT$/.test(symbol)) continue;
    const id = normalizeCoinId(symbol);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    markets.push({
      id,
      symbol: `${id.toUpperCase()}USDT`,
      label: id.toUpperCase(),
      quoteVolume: Number(row.quoteVolume) || 0,
    });
  }
  return markets;
}

export function attachVolumes(markets, tickers) {
  const volumes = new Map();
  if (Array.isArray(tickers)) {
    for (const row of tickers) {
      if (row && row.symbol) volumes.set(row.symbol, Number(row.quoteVolume) || 0);
    }
  }
  return markets
    .map((market) => ({ ...market, quoteVolume: volumes.get(market.symbol) || market.quoteVolume || 0 }))
    .sort((a, b) => b.quoteVolume - a.quoteVolume || a.label.localeCompare(b.label));
}

export function filterMarkets(markets, query) {
  const needle = String(query || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!needle) return markets;
  return markets.filter((market) => market.id.includes(needle) || market.symbol.toLowerCase().includes(needle));
}

export function customMarket(query, markets) {
  const id = normalizeCoinId(query);
  if (!id) return null;
  if (markets.some((market) => market.id === id)) return null;
  return { id, symbol: `${id.toUpperCase()}USDT`, label: id.toUpperCase(), quoteVolume: 0, custom: true };
}

export function usdNotional(price, qty) {
  const p = Number(price);
  const q = Number(qty);
  if (!(p > 0) || !(q > 0)) return 0;
  const notional = p * q;
  return Number.isFinite(notional) ? notional : 0;
}

/** Binance aggTrade `m`: true means the buyer is the maker, so the taker sold. */
export function aggressorSide(isBuyerMaker) {
  return isBuyerMaker ? "sell" : "buy";
}

export function formatCompactUsd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1e8) return sign + trimNumber(abs / 1e8) + "亿";
  if (abs >= 1e4) return sign + trimNumber(abs / 1e4) + "万";
  return sign + Math.round(abs).toLocaleString("zh-CN");
}

function trimNumber(n) {
  const digits = n >= 100 ? 0 : n >= 10 ? 1 : 2;
  return n
    .toFixed(digits)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

export function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const digits = n >= 1000 ? 0 : 2;
  return n.toLocaleString("zh-CN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

export function formatFunding(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return "—";
  const points = n * 100;
  const sign = points > 0 ? "+" : "";
  return `${sign}${points.toFixed(4)}%`;
}

export function formatSignedPct(percentPoints) {
  const n = Number(percentPoints);
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function formatCountdown(targetMs, nowMs) {
  const target = Number(targetMs);
  const now = Number(nowMs);
  if (!Number.isFinite(target) || !Number.isFinite(now)) return "—";
  let seconds = Math.floor((target - now) / 1000);
  if (seconds < 0) seconds = 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs].map((part) => String(part).padStart(2, "0")).join(":");
}

export function formatClock(ms) {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function sharePair(buyUsd, sellUsd) {
  const buy = buyUsd > 0 && Number.isFinite(buyUsd) ? buyUsd : 0;
  const sell = sellUsd > 0 && Number.isFinite(sellUsd) ? sellUsd : 0;
  const total = buy + sell;
  if (total <= 0) {
    return { buyUsd: 0, sellUsd: 0, total: 0, buy: 0.5, sell: 0.5 };
  }
  return { buyUsd: buy, sellUsd: sell, total, buy: buy / total, sell: sell / total };
}

export function advantageSide(totals, rules = RULES) {
  if (!totals || !(totals.total >= rules.advantageMinTotalUsd)) return null;
  if (totals.buy >= rules.advantageShare) return "buy";
  if (totals.sell >= rules.advantageShare) return "sell";
  return null;
}

export function sumNotional(levels) {
  if (!Array.isArray(levels)) return 0;
  let usd = 0;
  for (const level of levels) {
    if (!level) continue;
    usd += usdNotional(level[0], level[1]);
  }
  return usd;
}

export function logShare(value, max) {
  if (!(value > 0) || !(max > 0)) return 0;
  return Math.min(1, Math.log10(1 + value) / Math.log10(1 + max));
}

export function basisRate(mark, index) {
  const m = Number(mark);
  const i = Number(index);
  if (!(m > 0) || !(i > 0)) return null;
  return (m - i) / i;
}

export function shouldSampleDust(usd, rng, rules = RULES) {
  if (!(usd > 0) || usd >= rules.shotMinUsd) return false;
  if (usd < rules.dustUsd) return false;
  return rng() < rules.dustRate;
}

/**
 * One print, plus the spike/surge sums around it.
 * Whale and heavy prints win over accumulated spikes.
 * A surge airdrop wins over a spike bomb when both cross together.
 * Accumulated events replace the ordinary shot for that same print.
 */
export function visualsForPrint(input, rules = RULES) {
  const usd = input.usd;
  const side = input.side;
  if (!(usd > 0) || (side !== "buy" && side !== "sell")) return [];

  if (usd >= rules.airdropUsd) {
    return [{ type: "airdrop", side, usd, reason: "print" }];
  }
  if (usd >= rules.bombUsd) {
    return [{ type: "bomb", side, usd, reason: "print" }];
  }
  const surgeCross =
    input.surgeReady &&
    input.underPressure &&
    input.prevSurge < rules.airdropSurgeUsd &&
    input.nextSurge >= rules.airdropSurgeUsd;
  if (surgeCross) {
    return [{ type: "airdrop", side, usd: input.nextSurge, reason: "surge" }];
  }
  const spikeCross =
    input.spikeReady &&
    input.prevSpike < rules.bombSpikeUsd &&
    input.nextSpike >= rules.bombSpikeUsd;
  if (spikeCross) {
    return [{ type: "bomb", side, usd: input.nextSpike, reason: "spike" }];
  }
  if (usd >= rules.shotMinUsd) {
    return [
      {
        type: "shot",
        side,
        usd,
        tier: usd >= rules.volleyUsd ? "volley" : "spark",
        reason: "print",
      },
    ];
  }
  return [];
}

export function eventTitle(event) {
  const army = event.side === "buy" ? "蓝军" : "红军";
  if (event.type === "victory") return `${army}大获全胜`;
  if (event.type === "liq") return event.side === "buy" ? "多头强平" : "空头强平";
  if (event.type === "bomb") {
    return event.reason === "spike" ? `${army}炸弹 · 3秒量能` : `${army}炸弹`;
  }
  if (event.type === "airdrop") {
    return event.reason === "surge" ? `${army}空投支援 · 下风增援` : `${army}空投支援`;
  }
  if (event.tier === "volley") return event.side === "buy" ? "蓝军藤弩" : "红军裂弓";
  return event.side === "buy" ? "蓝军芽兵" : "红军尘卒";
}

export function barCaption(rules = RULES) {
  const seconds = Math.round(rules.windowMs / 1000);
  return `蓝军/红军占优条是近 ${seconds} 秒主动买入对主动卖出的名义金额，由本页计算，不是币安官方指标。`;
}

export function legendLines(rules = RULES) {
  const win = Math.round(rules.windowMs / 1000);
  const hold = Math.round(rules.victoryHoldMs / 1000);
  const spikeSec = Math.round(rules.bombSpikeMs / 1000);
  const surgeSec = Math.round(rules.airdropSurgeMs / 1000);
  const share = Math.round(rules.advantageShare * 100);
  const minTotal = formatCompactUsd(rules.advantageMinTotalUsd);
  return [
    {
      title: "两边各是谁",
      text: "左侧蓝军是芽兵和藤弩手，守在苔堡前，代表主动买入。右侧红军是尘卒和裂弓手，守在骨寨前，代表主动卖出。",
    },
    {
      title: "量能",
      text: `近 ${win} 秒主动买入名义金额对比主动卖出名义金额。占优条、炸弹、空投支援、大获全胜都在本页用这股量能计算，不是币安官方指标。`,
    },
    {
      title: "弹丸",
      text: `单笔 ${formatCompactUsd(rules.shotMinUsd)} 至 ${formatCompactUsd(rules.bombUsd)} 美元是弹丸。满 ${formatCompactUsd(rules.volleyUsd)} 画得更大。更小的成交仍计入量能，画面上只抽样。`,
    },
    {
      title: "炸弹",
      text: `单笔满 ${formatCompactUsd(rules.bombUsd)} 且不到 ${formatCompactUsd(rules.airdropUsd)} 美元；或同一方 ${spikeSec} 秒内合计第一次跨过 ${formatCompactUsd(rules.bombSpikeUsd)} 美元。从该侧爆开，不是普通弹丸。`,
    },
    {
      title: "空投支援",
      text: `单笔满 ${formatCompactUsd(rules.airdropUsd)} 美元；或对方正在占优时，这一方 ${surgeSec} 秒内合计第一次跨过 ${formatCompactUsd(rules.airdropSurgeUsd)} 美元。从空中落下，和弹丸、炸弹不同。`,
    },
    {
      title: "占优计时",
      text: `近 ${win} 秒占比至少 ${share}%，且两边合计至少 ${minTotal} 美元，才算占优。页面显示「蓝军占优 N 秒」或「红军占优 N 秒」。`,
    },
    {
      title: "大获全胜",
      text: `同一方连续占优满 ${hold} 秒，出现大获全胜。中途变成胶着或被对方占优，计时归零。庆祝之后，同一方必须先失去占优，再重新占优并再守满 ${hold} 秒，才会再次大获全胜。`,
    },
    {
      title: "不算进胜负的",
      text: "强平来自币安 forceOrder，该侧前排小人会倒下，并留下崩裂环。营地后面淡淡的一层是可见盘口，不触发炸弹、空投或大获全胜。",
    },
  ];
}

export function streakCopy(state, rules = RULES) {
  const need = Math.round(rules.victoryHoldMs / 1000);
  const win = Math.round(rules.windowMs / 1000);
  if (!state || !state.leader) {
    return {
      title: "胶着",
      sub: `近 ${win} 秒量能还没有一方占优。`,
      sec: 0,
      fill: 0,
    };
  }
  const sec = Math.max(0, Math.floor(state.elapsedMs / 1000));
  const name = state.leader === "buy" ? "蓝军" : "红军";
  const won = state.lockedSide === state.leader;
  return {
    title: `${name}占优 ${sec} 秒`,
    sub: won
      ? `这场优势已经大获全胜。要再来一次，得先丢掉占优，再重新守满 ${need} 秒。`
      : `连续占优满 ${need} 秒即大获全胜。被反超或回到胶着就归零。`,
    sec,
    fill: Math.min(1, state.elapsedMs / rules.victoryHoldMs),
  };
}

export function describeLink(input) {
  const market = input.market;
  const rest = input.rest;
  const quiet =
    input.msSinceTrade != null ? input.msSinceTrade : input.msSinceOpen;
  if (market === "open" && quiet != null && quiet > 8000) {
    return {
      code: "lagging",
      title: "连接还在，成交中断了几秒",
      detail:
        "实时流没有断开，但已经有几秒没有新的主动成交。若一直如此，检查到 fstream.binance.com 的网络。",
    };
  }
  if (market === "open" && rest === "fail") {
    return {
      code: "degraded",
      title: "成交流已连接，快照接口失败",
      detail:
        "价格和量能来自合约 WebSocket。持仓量、全网多空比需要 fapi.binance.com，这次没有拿到。部分网络会返回 451。",
    };
  }
  if (market === "open") {
    return {
      code: "live",
      title: "实时流已连接",
      detail: "行情直接来自币安 USDⓈ-M 永续公开流。",
    };
  }
  if (rest === "ok") {
    return {
      code: "snapshot",
      title: "只有快照，实时流未接通",
      detail: "页面会继续重试 wss://fstream.binance.com 。接通之前，价格不会逐笔跳动。",
    };
  }
  if (rest === "fail" && (input.failCount || 0) >= 2) {
    return {
      code: "blocked",
      title: "连不上币安合约",
      detail:
        "请确认当前网络能访问 fapi.binance.com 和 fstream.binance.com。受限网络常见 HTTP 451。中国大陆往往需要自行换一条能到达币安合约的网络。本页不提供代理。",
    };
  }
  return {
    code: "connecting",
    title: "正在连接币安合约行情",
    detail: "正在连接 fstream.binance.com 的 /market 与 /public 线路。",
  };
}

function createBucket(windowMs) {
  const rows = [];
  function prune(now) {
    const cut = now - windowMs;
    while (rows.length && rows[0].t < cut) rows.shift();
  }
  return {
    add(t, usd) {
      rows.push({ t, usd });
      prune(t);
    },
    sum(now) {
      prune(now);
      let total = 0;
      for (const row of rows) total += row.usd;
      return total;
    },
    clear() {
      rows.length = 0;
    },
  };
}

function createSideWindow(windowMs) {
  const rows = [];
  function prune(now) {
    const cut = now - windowMs;
    while (rows.length && rows[0].t < cut) rows.shift();
  }
  return {
    add(t, side, usd) {
      rows.push({ t, side, usd });
      prune(t);
    },
    totals(now) {
      prune(now);
      let buy = 0;
      let sell = 0;
      for (const row of rows) {
        if (row.side === "buy") buy += row.usd;
        else sell += row.usd;
      }
      return sharePair(buy, sell);
    },
    clear() {
      rows.length = 0;
    },
  };
}

export function createBattleEnergy(overrides = {}) {
  const rules = { ...RULES, ...overrides };
  const window = createSideWindow(rules.windowMs);
  const spikes = { buy: createBucket(rules.bombSpikeMs), sell: createBucket(rules.bombSpikeMs) };
  const surges = {
    buy: createBucket(rules.airdropSurgeMs),
    sell: createBucket(rules.airdropSurgeMs),
  };
  let leader = null;
  let leadSince = null;
  let lockedSide = null;
  let lastVictory = null;
  const lastSpike = { buy: Number.NEGATIVE_INFINITY, sell: Number.NEGATIVE_INFINITY };
  const lastSurge = { buy: Number.NEGATIVE_INFINITY, sell: Number.NEGATIVE_INFINITY };

  function snapshot(now) {
    const totals = window.totals(now);
    const elapsedMs = leader != null && leadSince != null ? Math.max(0, now - leadSince) : 0;
    return {
      ...totals,
      leader,
      elapsedMs,
      lockedSide,
      lastVictorySide: lastVictory ? lastVictory.side : null,
      lastVictoryAt: lastVictory ? lastVictory.at : null,
    };
  }

  function applyLead(now, events) {
    const totals = window.totals(now);
    const next = advantageSide(totals, rules);
    if (next !== leader) {
      if (lockedSide && next !== lockedSide) lockedSide = null;
      leader = next;
      leadSince = next == null ? null : now;
    }
    if (
      leader &&
      leadSince != null &&
      now - leadSince >= rules.victoryHoldMs &&
      lockedSide !== leader
    ) {
      lockedSide = leader;
      lastVictory = { side: leader, at: now };
      events.push({
        type: "victory",
        side: leader,
        usd: leader === "buy" ? totals.buyUsd : totals.sellUsd,
        reason: "hold",
      });
    }
    return totals;
  }

  function push(now, side, usd) {
    if ((side !== "buy" && side !== "sell") || !(usd > 0) || !Number.isFinite(now)) {
      return { events: [], state: snapshot(now) };
    }
    const before = window.totals(now);
    const opponent = advantageSide(before, rules);
    const underPressure = opponent != null && opponent !== side;
    const spike = spikes[side];
    const surge = surges[side];
    const prevSpike = spike.sum(now);
    const prevSurge = surge.sum(now);
    const events = visualsForPrint(
      {
        usd,
        side,
        prevSpike,
        nextSpike: prevSpike + usd,
        prevSurge,
        nextSurge: prevSurge + usd,
        underPressure,
        spikeReady: now - lastSpike[side] >= rules.bombSpikeCooldownMs,
        surgeReady: now - lastSurge[side] >= rules.airdropSurgeCooldownMs,
      },
      rules,
    );
    for (const event of events) {
      if (event.reason === "spike") lastSpike[side] = now;
      if (event.reason === "surge") lastSurge[side] = now;
    }
    spike.add(now, usd);
    surge.add(now, usd);
    window.add(now, side, usd);
    applyLead(now, events);
    return { events, state: snapshot(now) };
  }

  function tick(now) {
    const events = [];
    applyLead(now, events);
    return { events, state: snapshot(now) };
  }

  function reset() {
    window.clear();
    spikes.buy.clear();
    spikes.sell.clear();
    surges.buy.clear();
    surges.sell.clear();
    leader = null;
    leadSince = null;
    lockedSide = null;
    lastVictory = null;
    lastSpike.buy = Number.NEGATIVE_INFINITY;
    lastSpike.sell = Number.NEGATIVE_INFINITY;
    lastSurge.buy = Number.NEGATIVE_INFINITY;
    lastSurge.sell = Number.NEGATIVE_INFINITY;
  }

  return { push, tick, snapshot, reset, rules };
}
