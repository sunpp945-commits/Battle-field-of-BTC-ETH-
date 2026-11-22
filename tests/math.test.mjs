import assert from "node:assert/strict";
import test from "node:test";
import {
  RULES,
  advantageSide,
  aggressorSide,
  barCaption,
  createBattleEnergy,
  describeLink,
  formatCompactUsd,
  formatCountdown,
  formatFunding,
  legendLines,
  logShare,
  attachVolumes,
  customMarket,
  describeCoin,
  fallbackMarkets,
  filterMarkets,
  marketsFromExchangeInfo,
  marketsFromTickers,
  parseCoin,
  sharePair,
  shouldSampleDust,
  streakCopy,
  sumNotional,
  usdNotional,
  visualsForPrint,
} from "../js/math.js";
import { depthStreamUrls, marketSplitUrls, marketStreamUrl, restUrls } from "../js/binance.js";

test("notional and aggressor side", () => {
  assert.equal(usdNotional("100", "2.5"), 250);
  assert.equal(usdNotional(0, 10), 0);
  assert.equal(usdNotional("nope", 1), 0);
  assert.equal(aggressorSide(false), "buy");
  assert.equal(aggressorSide(true), "sell");
});

test("coin query accepts short names and typed symbols", () => {
  assert.equal(parseCoin(""), "btc");
  assert.equal(parseCoin("?coin=btc"), "btc");
  assert.equal(parseCoin("?coin=ETH"), "eth");
  assert.equal(parseCoin("?coin=ethusdt"), "eth");
  assert.equal(parseCoin("?coin=doge"), "doge");
  assert.equal(parseCoin("?coin=SOLUSDT"), "sol");
  assert.equal(parseCoin("?coin=1000pepe"), "1000pepe");
  assert.equal(parseCoin("?coin=!!!"), "btc");
  assert.equal(describeCoin("solusdt").symbol, "SOLUSDT");
});

test("perpetual universe keeps USDT perps and can be searched", () => {
  const parsed = marketsFromExchangeInfo({
    symbols: [
      { symbol: "SOLUSDT", baseAsset: "SOL", quoteAsset: "USDT", contractType: "PERPETUAL", status: "TRADING", marginAsset: "USDT" },
      { symbol: "BTCUSDT_240329", baseAsset: "BTC", quoteAsset: "USDT", contractType: "CURRENT_QUARTER", status: "TRADING" },
      { symbol: "ETHUSD_PERP", baseAsset: "ETH", quoteAsset: "USD", contractType: "PERPETUAL", status: "TRADING" },
      { symbol: "XRPUSDT", baseAsset: "XRP", quoteAsset: "USDT", contractType: "PERPETUAL", status: "BREAK" },
    ],
  });
  assert.deepEqual(parsed.map((market) => market.symbol), ["SOLUSDT"]);
  const ranked = attachVolumes(parsed, [{ symbol: "SOLUSDT", quoteVolume: "2500000" }]);
  assert.equal(ranked[0].quoteVolume, 2500000);
  const fromTickers = marketsFromTickers([
    { symbol: "DOGEUSDT", quoteVolume: "10" },
    { symbol: "BTCUSDT_240329", quoteVolume: "99" },
  ]);
  assert.deepEqual(fromTickers.map((market) => market.id), ["doge"]);
  const fallback = fallbackMarkets();
  assert.ok(fallback.some((market) => market.symbol === "BTCUSDT"));
  assert.ok(fallback.some((market) => market.symbol === "1000PEPEUSDT"));
  assert.equal(filterMarkets(fallback, "sol").some((market) => market.id === "sol"), true);
  assert.equal(customMarket("sol", fallback), null);
  assert.equal(customMarket("notalist", fallback).symbol, "NOTALISTUSDT");
  assert.equal(customMarket("??", fallback), null);
});

test("compact usd and countdown use synthetic values", () => {
  assert.equal(formatCompactUsd(15_000), "1.5万");
  assert.equal(formatCompactUsd(50_000), "5万");
  assert.equal(formatCompactUsd(250_000), "25万");
  assert.equal(formatCompactUsd(500_000), "50万");
  assert.equal(formatCompactUsd(700_000), "70万");
  assert.equal(formatCompactUsd(1_000_000), "100万");
  assert.equal(formatCompactUsd(1_500_000), "150万");
  assert.equal(formatFunding(0.0001), "+0.0100%");
  assert.equal(formatFunding(-0.00025), "-0.0250%");
  assert.equal(formatCountdown(3_661_000, 0), "01:01:01");
  assert.equal(formatCountdown(0, 5_000), "00:00:00");
  assert.equal(formatCountdown("nope", 0), "—");
});

test("advantage boundaries", () => {
  assert.equal(advantageSide({ buy: 0.58, sell: 0.42, total: 500_000 }), "buy");
  assert.equal(advantageSide({ buy: 0.42, sell: 0.58, total: 500_000 }), "sell");
  assert.equal(advantageSide({ buy: 0.579, sell: 0.421, total: 500_000 }), null);
  assert.equal(advantageSide({ buy: 1, sell: 0, total: 499_999 }), null);
  assert.equal(sharePair(0, 0).buy, 0.5);
});

test("book notional and log width stay inside 0..1", () => {
  assert.equal(sumNotional([["100", "2"], ["50", "1"]]), 250);
  assert.equal(sumNotional(null), 0);
  assert.equal(logShare(0, 10), 0);
  assert.ok(logShare(10, 10) <= 1);
  assert.ok(logShare(10, 100) > 0);
});

test("print tiers at the futures thresholds", () => {
  const base = {
    prevSpike: 0,
    nextSpike: 0,
    prevSurge: 0,
    nextSurge: 0,
    underPressure: false,
    spikeReady: true,
    surgeReady: true,
  };
  assert.deepEqual(visualsForPrint({ ...base, side: "buy", usd: 14_999 }), []);
  assert.equal(visualsForPrint({ ...base, side: "buy", usd: 15_000 })[0].tier, "spark");
  assert.equal(visualsForPrint({ ...base, side: "sell", usd: 50_000 })[0].tier, "volley");
  assert.equal(visualsForPrint({ ...base, side: "sell", usd: 249_999 })[0].type, "shot");
  const bomb = visualsForPrint({ ...base, side: "buy", usd: 250_000 })[0];
  assert.equal(bomb.type, "bomb");
  assert.equal(bomb.reason, "print");
  assert.equal(visualsForPrint({ ...base, side: "buy", usd: 999_999 })[0].type, "bomb");
  const drop = visualsForPrint({ ...base, side: "sell", usd: 1_000_000 })[0];
  assert.equal(drop.type, "airdrop");
  assert.equal(drop.reason, "print");
});

test("a 3 second spike becomes one bomb, not another shot", () => {
  const event = visualsForPrint({
    side: "sell",
    usd: 200_000,
    prevSpike: 600_000,
    nextSpike: 800_000,
    prevSurge: 0,
    nextSurge: 200_000,
    underPressure: false,
    spikeReady: true,
    surgeReady: true,
  })[0];
  assert.equal(event.type, "bomb");
  assert.equal(event.reason, "spike");
  assert.equal(event.usd, 800_000);
});

test("support airdrop only while that side is under pressure", () => {
  const surge = visualsForPrint({
    side: "buy",
    usd: 200_000,
    prevSpike: 0,
    nextSpike: 200_000,
    prevSurge: 1_400_000,
    nextSurge: 1_600_000,
    underPressure: true,
    spikeReady: true,
    surgeReady: true,
  })[0];
  assert.equal(surge.type, "airdrop");
  assert.equal(surge.reason, "surge");
  const ignored = visualsForPrint({
    side: "buy",
    usd: 200_000,
    prevSpike: 0,
    nextSpike: 200_000,
    prevSurge: 1_400_000,
    nextSurge: 1_600_000,
    underPressure: false,
    spikeReady: true,
    surgeReady: true,
  });
  assert.equal(ignored[0].type, "shot");
});

test("whale print is an airdrop and does not also become a bomb", () => {
  const events = visualsForPrint({
    side: "buy",
    usd: 2_000_000,
    prevSpike: 0,
    nextSpike: 2_000_000,
    prevSurge: 0,
    nextSurge: 2_000_000,
    underPressure: true,
    spikeReady: true,
    surgeReady: true,
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].reason, "print");
});

test("battle energy: spike, surge, and print paths", () => {
  const battle = createBattleEnergy();
  const seen = [];
  for (let i = 0; i < 4; i += 1) {
    const result = battle.push(i * 100, "buy", 200_000);
    seen.push(result.events.map((event) => `${event.type}:${event.reason}`).join("|"));
  }
  assert.deepEqual(seen, ["shot:print", "shot:print", "shot:print", "bomb:spike"]);

  const calm = createBattleEnergy();
  calm.push(0, "buy", 5_000_000);
  calm.push(0, "sell", 200_000);
  const drops = [];
  for (let i = 1; i <= 8; i += 1) {
    drops.push(...calm.push(i * 400, "sell", 200_000).events.filter((event) => event.type === "airdrop"));
  }
  assert.equal(drops.length, 1);
  assert.equal(drops[0].reason, "surge");

  const leading = createBattleEnergy();
  const leadingDrops = [];
  for (let i = 0; i < 8; i += 1) {
    leadingDrops.push(
      ...leading.push(i * 400, "sell", 200_000).events.filter((event) => event.type === "airdrop"),
    );
  }
  assert.equal(leadingDrops.length, 0);
});

test("spike bomb respects cooldown until the burst is rebuilt", () => {
  const battle = createBattleEnergy({ bombSpikeCooldownMs: 10_000 });
  battle.push(0, "buy", 200_000);
  battle.push(100, "buy", 200_000);
  battle.push(200, "buy", 200_000);
  const first = battle.push(300, "buy", 200_000);
  assert.equal(first.events.some((event) => event.reason === "spike"), true);

  battle.push(4_000, "buy", 200_000);
  battle.push(4_100, "buy", 200_000);
  battle.push(4_200, "buy", 200_000);
  const cooled = battle.push(4_300, "buy", 200_000);
  assert.equal(cooled.events.some((event) => event.reason === "spike"), false);

  battle.push(12_000, "buy", 200_000);
  battle.push(12_100, "buy", 200_000);
  battle.push(12_200, "buy", 200_000);
  const again = battle.push(12_300, "buy", 200_000);
  assert.equal(again.events.some((event) => event.reason === "spike"), true);
});

test("victory needs 20 continuous seconds and does not repeat until the lead drops", () => {
  const battle = createBattleEnergy();
  battle.push(0, "buy", 600_000);
  battle.push(0, "sell", 100_000);
  assert.equal(battle.snapshot(0).leader, "buy");
  assert.equal(battle.tick(19_999).events.some((event) => event.type === "victory"), false);

  const won = battle.tick(20_000);
  assert.equal(won.events.filter((event) => event.type === "victory").length, 1);
  assert.equal(won.events[0].side, "buy");
  assert.equal(battle.tick(21_000).events.some((event) => event.type === "victory"), false);
  assert.equal(battle.tick(40_000).events.some((event) => event.type === "victory"), false);
  assert.equal(streakCopy(battle.snapshot(8_000)).title, "蓝军占优 8 秒");

  const dropped = battle.push(21_000, "sell", 400_000);
  assert.equal(dropped.state.leader, null);
  battle.push(22_000, "buy", 1_000_000);
  assert.equal(battle.snapshot(22_000).leader, "buy");
  assert.equal(battle.tick(41_999).events.some((event) => event.type === "victory"), false);
  const second = battle.tick(42_000);
  assert.equal(second.events.filter((event) => event.type === "victory").length, 1);
  assert.equal(second.events[0].side, "buy");
});

test("the other side taking the lead resets the 20 second clock", () => {
  const battle = createBattleEnergy();
  battle.push(0, "buy", 600_000);
  battle.push(0, "sell", 100_000);
  battle.push(10_000, "sell", 2_000_000);
  assert.equal(battle.snapshot(10_000).leader, "sell");
  assert.equal(battle.tick(20_000).events.some((event) => event.type === "victory"), false);
  const won = battle.tick(30_000);
  assert.equal(won.events.filter((event) => event.type === "victory").length, 1);
  assert.equal(won.events[0].side, "sell");
});

test("thin volume never starts the victory clock", () => {
  const battle = createBattleEnergy();
  battle.push(0, "buy", 100);
  battle.push(0, "sell", 10);
  assert.equal(battle.snapshot(0).leader, null);
  assert.equal(battle.tick(30_000).events.length, 0);
  assert.equal(streakCopy(battle.snapshot(30_000)).title, "胶着");
});

test("legend and link copy stay tied to the rules", () => {
  const text = legendLines().map((line) => `${line.title} ${line.text}`).join("\n");
  assert.match(text, /20 秒/);
  assert.match(text, /25万/);
  assert.match(text, /100万/);
  assert.match(text, /70万/);
  assert.match(text, /150万/);
  assert.match(text, /58%/);
  assert.match(text, /50万/);
  assert.match(text, /不是币安官方指标/);
  assert.match(barCaption(), /不是币安官方指标/);
  assert.equal(describeLink({ market: "open", msSinceTrade: 1000, rest: "ok" }).code, "live");
  assert.equal(describeLink({ market: "open", msSinceTrade: 9000, rest: "ok" }).code, "lagging");
  assert.equal(describeLink({ market: "open", msSinceTrade: 1000, rest: "fail" }).code, "degraded");
  assert.equal(describeLink({ market: "connecting", rest: "fail", failCount: 2 }).code, "blocked");
  assert.equal(describeLink({ market: "down", rest: "ok", failCount: 3 }).code, "snapshot");
});

test("dust sampling never promotes a full shot", () => {
  assert.equal(shouldSampleDust(20_000, () => 0), false);
  assert.equal(shouldSampleDust(3_000, () => 0), true);
  assert.equal(shouldSampleDust(3_000, () => 0.99), false);
  assert.equal(shouldSampleDust(100, () => 0), false);
});

test("stream urls stay on the futures market and public paths", () => {
  assert.match(marketStreamUrl("BTCUSDT"), /^wss:\/\/fstream\.binance\.com\/market\/stream\?streams=btcusdt@aggTrade/);
  assert.match(marketStreamUrl("ETHUSDT"), /ethusdt@forceOrder/);
  for (const url of marketSplitUrls("BTCUSDT")) {
    assert.match(url, /^wss:\/\/fstream\.binance\.com\/market\/ws\//);
  }
  const depth = depthStreamUrls("ETHUSDT");
  assert.match(depth[0], /\/public\/stream\?streams=ethusdt@depth20@100ms/);
  assert.match(depth[1], /\/public\/ws\/ethusdt@depth20@100ms/);
  const rest = restUrls("BTCUSDT");
  assert.match(rest.premium, /^https:\/\/fapi\.binance\.com\/fapi\/v1\/premiumIndex/);
  assert.match(rest.openInterest, /openInterest\?symbol=BTCUSDT/);
  assert.match(rest.accounts, /globalLongShortAccountRatio/);
  assert.match(rest.taker, /takerlongshortRatio/);
  assert.equal(RULES.victoryHoldMs, 20_000);
  assert.equal(RULES.bombUsd, 250_000);
  assert.equal(RULES.airdropUsd, 1_000_000);
});
