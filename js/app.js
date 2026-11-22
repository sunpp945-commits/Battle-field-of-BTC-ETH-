import {
  RULES,
  aggressorSide,
  barCaption,
  basisRate,
  createBattleEnergy,
  customMarket,
  describeCoin,
  describeLink,
  eventTitle,
  fallbackMarkets,
  filterMarkets,
  formatClock,
  formatCompactUsd,
  formatCountdown,
  formatFunding,
  formatPrice,
  formatQty,
  formatSignedPct,
  legendLines,
  parseCoin,
  shouldSampleDust,
  streakCopy,
  sumNotional,
  usdNotional,
} from "./math.js";
import { createFeed, fetchMarketList, fetchSnapshot } from "./binance.js";
import { mountField } from "./field.js?v=2";

const $ = (id) => document.getElementById(id);

const field = mountField($("battle"));
const energy = createBattleEnergy();

const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let motionOverride = null;
try {
  motionOverride = localStorage.getItem("vinebone-motion");
} catch {
  motionOverride = null;
}
let coinId = parseCoin(location.search);
let markets = fallbackMarkets();
let marketNote = "正在读取币安永续列表…";
let latestMark = NaN;
let restGen = 0;
let feed = null;
let restAbort = null;
let restTimer = 0;
let bannerTimer = 0;
let market = "connecting";
let rest = "unknown";
let failCount = 0;
let openedAt = 0;
let lastTradeAt = 0;
let nextFunding = null;
let shownStreak = "";

const els = {
  coinOpen: $("coin-open"),
  coinDialog: $("coin-dialog"),
  coinSearch: $("coin-search"),
  coinList: $("coin-list"),
  coinSource: $("coin-source"),
  coinClose: $("coin-close"),
  motion: $("motion"),
  status: $("status"),
  statusDetail: $("status-detail"),
  symbol: $("symbol-label"),
  last: $("last"),
  chg: $("chg"),
  vol: $("vol"),
  mark: $("mark"),
  basis: $("basis"),
  funding: $("funding"),
  fundTime: $("fund-time"),
  oi: $("oi"),
  oiUsd: $("oi-usd"),
  acct: $("acct"),
  acctSub: $("acct-sub"),
  taker: $("taker"),
  takerSub: $("taker-sub"),
  streakTitle: $("streak-title"),
  streakSub: $("streak-sub"),
  meter: $("hold-meter"),
  meterFill: $("hold-fill"),
  barBuy: $("bar-buy"),
  barSell: $("bar-sell"),
  sums: $("energy-sums"),
  note: $("energy-note"),
  book: $("book-line"),
  victory: $("victory"),
  victoryKicker: $("victory-kicker"),
  victorySub: $("victory-sub"),
  lastEvent: $("last-event"),
  tape: $("tape"),
  rules: $("rules"),
  chips: $("chips"),
  energy: $("energy"),
};

boot();

function boot() {
  els.note.textContent = barCaption();
  renderLegend();
  renderChips();
  applyMotion();
  els.coinOpen.addEventListener("click", openPicker);
  els.coinClose.addEventListener("click", closePicker);
  els.coinDialog.addEventListener("click", (event) => {
    if (event.target === els.coinDialog) closePicker();
  });
  els.coinSearch.addEventListener("input", renderCoinList);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.coinDialog.hidden) closePicker();
  });
  els.motion.addEventListener("click", () => {
    motionOverride = reducedNow() ? "full" : "reduce";
    try {
      localStorage.setItem("vinebone-motion", motionOverride);
    } catch {
      /* private mode */
    }
    applyMotion();
  });
  motionQuery.addEventListener?.("change", applyMotion);
  window.addEventListener("popstate", () => selectCoin(parseCoin(location.search), { history: "none" }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") paintLink();
  });
  selectCoin(coinId, { history: "replace" });
  loadMarkets();
  setInterval(heartbeat, 250);
}

function reducedNow() {
  if (motionOverride === "reduce") return true;
  if (motionOverride === "full") return false;
  return motionQuery.matches;
}

function applyMotion() {
  const reduced = reducedNow();
  document.body.classList.toggle("is-reduced", reduced);
  field.setReduced(reduced);
  els.motion.setAttribute("aria-pressed", reduced ? "true" : "false");
  els.motion.textContent = reduced ? "恢复动画" : "减少动画";
}

function selectCoin(nextId, options = {}) {
  const historyMode = options.history || "push";
  const coin = describeCoin(nextId);
  if (historyMode === "push" && coin.id === coinId && feed) return;
  coinId = coin.id;
  const url = new URL(location.href);
  url.searchParams.set("coin", coinId);
  if (historyMode === "push") history.pushState({}, "", url);
  else if (historyMode === "replace") history.replaceState({}, "", url);

  els.symbol.textContent = `${coin.symbol} 永续`;
  els.coinOpen.textContent = `${coin.label} 永续`;
  document.title = `藤骨战线 · ${coin.label} 永续`;
  if (!els.coinDialog.hidden) renderCoinList();

  energy.reset();
  field.clear();
  hideVictory();
  lastTradeAt = 0;
  openedAt = 0;
  nextFunding = null;
  latestMark = NaN;
  market = "connecting";
  rest = "unknown";
  failCount = 0;
  shownStreak = "";
  clearTape();
  resetQuote();
  paintEnergy(energy.snapshot(Date.now()));
  paintLink();

  if (feed) feed.stop();
  feed = createFeed(coin.symbol, {
    onEvent: onStream,
    onDepth: onDepth,
    onLife: onLife,
  });
  pullRest();
}

function resetQuote() {
  setText(els.last, "—");
  setText(els.chg, "24 小时 —");
  setText(els.vol, "");
  setText(els.mark, "—");
  setText(els.basis, "基差 —");
  setText(els.funding, "—");
  setText(els.fundTime, "距结算 —");
  setText(els.oi, "—");
  setText(els.oiUsd, "快照未到");
  delete els.oi.dataset.qty;
  setText(els.acct, "—");
  setText(els.acctSub, "5 分钟 · 币安公开");
  setText(els.taker, "—");
  setText(els.takerSub, "5 分钟 · 币安公开");
  setText(els.book, "盘口还没有到");
  els.chg.className = "sub";
}

function onLife(info) {
  market = info.market === "open" ? "open" : info.market === "down" ? "down" : "connecting";
  failCount = info.failCount || 0;
  if (info.openedAt) openedAt = info.openedAt;
  paintLink();
}

function currentSymbol() {
  return describeCoin(coinId).symbol;
}

function openPicker() {
  els.coinDialog.hidden = false;
  els.coinOpen.setAttribute("aria-expanded", "true");
  renderCoinList();
  els.coinSearch.focus();
}

function closePicker() {
  els.coinDialog.hidden = true;
  els.coinOpen.setAttribute("aria-expanded", "false");
  els.coinOpen.focus();
}

function renderCoinList() {
  const query = els.coinSearch.value;
  const shown = filterMarkets(markets, query);
  const extra = customMarket(query, markets);
  els.coinSource.textContent = marketNote;
  els.coinList.replaceChildren();
  const rows = extra ? [extra, ...shown] : shown;
  if (!rows.length) {
    const empty = document.createElement("li");
    empty.className = "coin-empty";
    empty.textContent = "没有匹配的合约。输入如 SOL 或 DOGEUSDT 也可以直接切换。";
    els.coinList.append(empty);
    return;
  }
  for (const market of rows) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = market.id === coinId ? "is-on" : "";
    button.setAttribute("aria-pressed", market.id === coinId ? "true" : "false");
    const name = document.createElement("span");
    name.textContent = market.custom ? `使用 ${market.symbol}` : market.symbol;
    const meta = document.createElement("span");
    meta.textContent = market.quoteVolume > 0 ? formatCompactUsd(market.quoteVolume) : market.custom ? "手输" : "";
    button.append(name, meta);
    button.addEventListener("click", () => {
      closePicker();
      selectCoin(market.id);
    });
    item.append(button);
    els.coinList.append(item);
  }
}

async function loadMarkets() {
  try {
    const result = await fetchMarketList();
    if (!result.live) throw new Error("empty");
    markets = result.markets;
    marketNote = `币安合约列表 · ${markets.length} 个 USDT 永续，按 24 小时成交额排序。`;
  } catch {
    markets = fallbackMarkets();
    marketNote = "连不上 fapi.binance.com（常见是 451 或网络限制）。下面是内置常用永续，也可以直接输入合约名。";
  }
  renderCoinList();
}

function onStream(data) {
  const symbol = currentSymbol();
  if (data.s && data.s !== symbol) return;
  if (data.e === "aggTrade") {
    lastTradeAt = Date.now();
    const price = Number(data.p);
    const usd = usdNotional(data.p, data.q);
    if (Number.isFinite(price)) setText(els.last, formatPrice(price));
    if (usd > 0) absorbTrade(aggressorSide(data.m), usd);
    return;
  }
  if (data.e === "markPriceUpdate") {
    latestMark = Number(data.p);
    setText(els.mark, formatPrice(data.p));
    const basis = basisRate(data.p, data.i);
    setText(els.basis, basis == null ? "基差 —" : `基差 ${formatSignedPct(basis * 100)}`);
    setText(els.funding, formatFunding(data.r));
    nextFunding = Number(data.T);
    paintFundingClock();
    if (els.oi.dataset.qty) paintOi(Number(els.oi.dataset.qty), latestMark);
    return;
  }
  if (data.e === "24hrTicker") {
    paintTicker(data.P, data.q, data.c);
    return;
  }
  if (data.e === "forceOrder" && data.o) {
    const order = data.o;
    if (order.s && order.s !== symbol) return;
    const price = Number(order.ap) || Number(order.p);
    const qty = Number(order.z) || Number(order.q);
    const usd = usdNotional(price, qty);
    const longLiq = order.S === "SELL";
    const event = { type: "liq", side: longLiq ? "buy" : "sell", usd, reason: "liq" };
    field.spawn(event);
    pushTape(event, Date.now());
    els.lastEvent.textContent = `最近：${eventTitle(event)}${usd ? " " + formatCompactUsd(usd) : ""}`;
  }
}

function onDepth(data) {
  const bids = data.b || data.bids || [];
  const asks = data.a || data.asks || [];
  field.setBook(bids, asks);
  paintBook(bids, asks);
}

function absorbTrade(side, usd) {
  const now = Date.now();
  const { events, state } = energy.push(now, side, usd);
  if (events.length === 0 && shouldSampleDust(usd, Math.random)) {
    field.spawn({ type: "shot", side, usd, tier: "dust", reason: "sample" });
  }
  for (const event of events) {
    if (event.type === "victory") showVictory(event.side);
    else field.spawn(event);
    if (isTapeWorthy(event)) pushTape(event, now);
    if (event.type === "bomb" || event.type === "airdrop" || event.type === "victory") {
      els.lastEvent.textContent = `最近：${eventTitle(event)} ${formatCompactUsd(event.usd)}`;
    }
  }
  paintEnergy(state);
}

function heartbeat() {
  const now = Date.now();
  const { events, state } = energy.tick(now);
  for (const event of events) {
    if (event.type === "victory") showVictory(event.side);
    if (isTapeWorthy(event)) pushTape(event, now);
    if (event.type === "victory") {
      els.lastEvent.textContent = `最近：${eventTitle(event)}`;
    }
  }
  paintEnergy(state);
  paintFundingClock();
  paintLink();
}

function paintEnergy(state) {
  const has = state.total > 0;
  const buyPct = has ? state.buy * 100 : 50;
  const sellPct = has ? state.sell * 100 : 50;
  els.barBuy.style.width = `${buyPct}%`;
  els.barSell.style.width = `${sellPct}%`;
  els.barBuy.textContent = buyPct >= 16 ? `多军 ${buyPct.toFixed(0)}%` : "";
  els.barSell.textContent = sellPct >= 16 ? `空军 ${sellPct.toFixed(0)}%` : "";
  const copy = streakCopy(state);
  if (copy.title !== shownStreak) {
    shownStreak = copy.title;
    els.streakTitle.textContent = copy.title;
  }
  els.streakSub.textContent = copy.sub;
  els.meterFill.style.width = `${copy.fill * 100}%`;
  els.meter.setAttribute("aria-valuenow", String(Math.min(20, copy.sec)));
  els.meter.setAttribute("aria-valuetext", copy.title);
  els.sums.textContent = has
    ? `多军 ${formatCompactUsd(state.buyUsd)} · 空军 ${formatCompactUsd(state.sellUsd)} · 近 60 秒`
    : "还没有计入的主动成交";
  els.energy.classList.toggle("is-buy", state.leader === "buy");
  els.energy.classList.toggle("is-sell", state.leader === "sell");
  els.energy.classList.toggle("is-even", !state.leader);
  field.setShare(has ? state.buy : 0.5);
}

function paintLink() {
  const now = Date.now();
  const view = describeLink({
    market: market === "down" ? "down" : market,
    msSinceTrade: lastTradeAt ? now - lastTradeAt : null,
    msSinceOpen: openedAt ? now - openedAt : null,
    rest,
    failCount,
  });
  els.status.textContent = view.title;
  els.statusDetail.textContent = view.detail;
  els.status.className = `status is-${view.code}`;
}

function paintFundingClock() {
  els.fundTime.textContent = nextFunding
    ? `距结算 ${formatCountdown(nextFunding, Date.now())}`
    : "距结算 —";
}

function paintTicker(percent, quote, last) {
  const pct = Number(percent);
  if (Number.isFinite(pct)) {
    els.chg.textContent = `24 小时 ${formatSignedPct(pct)}`;
    els.chg.className = pct > 0 ? "sub is-up" : pct < 0 ? "sub is-down" : "sub";
  }
  const vol = Number(quote);
  if (Number.isFinite(vol) && vol > 0) els.vol.textContent = `24 小时成交额 ${formatCompactUsd(vol)}`;
  if (!lastTradeAt && last != null) setText(els.last, formatPrice(last));
}

function paintOi(qty, mark) {
  els.oi.textContent = formatQty(qty);
  els.oi.dataset.qty = String(qty);
  const usd = Number(mark) > 0 ? qty * Number(mark) : NaN;
  els.oiUsd.textContent = Number.isFinite(usd) ? `约 ${formatCompactUsd(usd)} 美元` : "张数 / 币数";
}

function paintBook(bids, asks) {
  const bid = sumNotional(bids);
  const ask = sumNotional(asks);
  if (bid + ask <= 0) {
    els.book.textContent = "盘口还没有到";
    return;
  }
  els.book.textContent = `买盘 ${formatCompactUsd(bid)} · 卖盘 ${formatCompactUsd(ask)} · 可见盘口，不计入胜负`;
}

function showVictory(side) {
  const buy = side === "buy";
  els.victory.hidden = false;
  els.victory.className = buy ? "victory is-buy" : "victory is-sell";
  els.victoryKicker.textContent = buy ? "多军" : "空军";
  els.victorySub.textContent = `连续占优 ${RULES.victoryHoldMs / 1000} 秒`;
  field.celebrate(side);
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(hideVictory, RULES.victoryBannerMs);
}

function hideVictory() {
  els.victory.hidden = true;
  clearTimeout(bannerTimer);
}

function isTapeWorthy(event) {
  return (
    event.type === "bomb" ||
    event.type === "airdrop" ||
    event.type === "victory" ||
    event.type === "liq" ||
    event.tier === "volley"
  );
}

function pushTape(event, now) {
  const empty = els.tape.querySelector(".empty");
  if (empty) empty.remove();
  const item = document.createElement("li");
  const amount = event.usd ? ` ${formatCompactUsd(event.usd)}` : "";
  item.textContent = `${formatClock(now)}  ${eventTitle(event)}${amount}`;
  els.tape.prepend(item);
  while (els.tape.children.length > 8) els.tape.lastElementChild.remove();
}

function clearTape() {
  els.tape.replaceChildren();
  const item = document.createElement("li");
  item.className = "empty";
  item.textContent = "齐射以上的成交、炸弹、空投和强平会列在这里。";
  els.tape.append(item);
  els.lastEvent.textContent = "最近重击：还没有炸弹、空投或强平";
}

function renderLegend() {
  els.rules.replaceChildren();
  for (const line of legendLines()) {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = line.title;
    item.append(title, document.createTextNode(line.text));
    els.rules.append(item);
  }
}

function renderChips() {
  const chips = [
    `弹丸 ${formatCompactUsd(RULES.shotMinUsd)}`,
    `齐射 ${formatCompactUsd(RULES.volleyUsd)}`,
    `炸弹 ${formatCompactUsd(RULES.bombUsd)}`,
    `空投 ${formatCompactUsd(RULES.airdropUsd)}`,
    `占优 ${RULES.victoryHoldMs / 1000} 秒`,
  ];
  els.chips.replaceChildren();
  for (const text of chips) {
    const chip = document.createElement("span");
    chip.textContent = text;
    els.chips.append(chip);
  }
}

async function pullRest() {
  const gen = ++restGen;
  if (restAbort) restAbort.abort();
  const ac = new AbortController();
  restAbort = ac;
  clearTimeout(restTimer);
  const symbol = currentSymbol();
  let delay = 60_000;
  try {
    const snap = await fetchSnapshot(symbol, ac.signal);
    if (gen !== restGen || ac.signal.aborted) return;
    rest = snap.anyOk ? "ok" : "fail";
    if (snap.anyOk) delay = 20_000;
    applyRest(snap);
  } catch (error) {
    if (gen !== restGen || error?.name === "AbortError") return;
    rest = "fail";
  }
  if (gen !== restGen) return;
  paintLink();
  restTimer = setTimeout(pullRest, delay);
}

function applyRest(snap) {
  if (snap.premium) {
    latestMark = Number(snap.premium.markPrice);
    setText(els.mark, formatPrice(snap.premium.markPrice));
    const basis = basisRate(snap.premium.markPrice, snap.premium.indexPrice);
    setText(els.basis, basis == null ? "基差 —" : `基差 ${formatSignedPct(basis * 100)}`);
    setText(els.funding, formatFunding(snap.premium.lastFundingRate));
    nextFunding = Number(snap.premium.nextFundingTime);
    paintFundingClock();
  }
  if (snap.ticker) {
    paintTicker(snap.ticker.priceChangePercent, snap.ticker.quoteVolume, snap.ticker.lastPrice);
  }
  if (snap.openInterest) {
    paintOi(Number(snap.openInterest.openInterest), latestMark);
  }
  if (snap.depth && (snap.depth.bids || snap.depth.asks)) {
    onDepth(snap.depth);
  }
  if (snap.accounts && snap.accounts.longAccount) {
    const long = Number(snap.accounts.longAccount) * 100;
    const short = Number(snap.accounts.shortAccount) * 100;
    els.acct.textContent = `多 ${long.toFixed(1)}% · 空 ${short.toFixed(1)}%`;
    els.acctSub.textContent = "5 分钟 · 币安全网账户多空比";
  } else if (snap.accounts && snap.accounts.longShortRatio) {
    els.acct.textContent = `多空比 ${Number(snap.accounts.longShortRatio).toFixed(2)}`;
    els.acctSub.textContent = "5 分钟 · 币安全网账户多空比";
  }
  if (snap.taker && snap.taker.buySellRatio) {
    els.taker.textContent = `买卖比 ${Number(snap.taker.buySellRatio).toFixed(2)}`;
    els.takerSub.textContent = "5 分钟 · 币安主动买卖量比";
  }
  if (!snap.openInterest) els.oiUsd.textContent = "快照接口失败";
  if (!snap.accounts) els.acctSub.textContent = "5 分钟 · 快照接口失败";
  if (!snap.taker) els.takerSub.textContent = "5 分钟 · 快照接口失败";
}

function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}
