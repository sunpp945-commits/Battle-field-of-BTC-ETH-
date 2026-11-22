import { attachVolumes, marketsFromExchangeInfo, marketsFromTickers } from "./math.js";

// Public Binance USDⓈ-M futures only. The browser talks to Binance directly.
// Market streams (trades, mark, ticker, liquidations) use /market.
// Depth uses /public. Legacy /ws and /stream are not used: after the
// 2026-04-23 split, market streams on the old path no longer deliver.

const REST_ORIGIN = "https://fapi.binance.com";

export const EXCHANGE_INFO_URL = `${REST_ORIGIN}/fapi/v1/exchangeInfo`;
export const ALL_TICKERS_URL = `${REST_ORIGIN}/fapi/v1/ticker/24hr`;

export function marketStreamUrl(symbol) {
  const s = symbol.toLowerCase();
  const streams = [
    `${s}@aggTrade`,
    `${s}@markPrice@1s`,
    `${s}@forceOrder`,
    `${s}@ticker`,
  ].join("/");
  return `wss://fstream.binance.com/market/stream?streams=${streams}`;
}

export function marketSplitUrls(symbol) {
  const s = symbol.toLowerCase();
  return [
    `wss://fstream.binance.com/market/ws/${s}@aggTrade`,
    `wss://fstream.binance.com/market/ws/${s}@markPrice@1s`,
    `wss://fstream.binance.com/market/ws/${s}@forceOrder`,
    `wss://fstream.binance.com/market/ws/${s}@ticker`,
  ];
}

export function depthStreamUrls(symbol) {
  const stream = `${symbol.toLowerCase()}@depth20@100ms`;
  return [
    `wss://fstream.binance.com/public/stream?streams=${stream}`,
    `wss://fstream.binance.com/public/ws/${stream}`,
  ];
}

export function restUrls(symbol) {
  const q = encodeURIComponent(symbol);
  return {
    premium: `${REST_ORIGIN}/fapi/v1/premiumIndex?symbol=${q}`,
    ticker: `${REST_ORIGIN}/fapi/v1/ticker/24hr?symbol=${q}`,
    openInterest: `${REST_ORIGIN}/fapi/v1/openInterest?symbol=${q}`,
    depth: `${REST_ORIGIN}/fapi/v1/depth?symbol=${q}&limit=20`,
    accounts: `${REST_ORIGIN}/futures/data/globalLongShortAccountRatio?symbol=${q}&period=5m&limit=1`,
    taker: `${REST_ORIGIN}/futures/data/takerlongshortRatio?symbol=${q}&period=5m&limit=1`,
  };
}

export function unwrapStream(raw) {
  const message = JSON.parse(raw);
  if (message && message.data && message.stream) return message.data;
  return message;
}

export async function fetchJson(url, signal) {
  let response;
  try {
    response = await fetch(url, { signal, cache: "no-store", mode: "cors" });
  } catch (cause) {
    const error = new Error("network");
    error.kind = "network";
    error.cause = cause;
    throw error;
  }
  if (response.status === 451) {
    const error = new Error("451");
    error.kind = "restricted";
    error.status = 451;
    throw error;
  }
  if (!response.ok) {
    const error = new Error("http");
    error.kind = "http";
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export async function fetchMarketList(signal) {
  const [infoResult, tickerResult] = await Promise.all([
    fetchJson(EXCHANGE_INFO_URL, signal).then((data) => ({ ok: true, data })).catch((error) => ({ ok: false, error })),
    fetchJson(ALL_TICKERS_URL, signal).then((data) => ({ ok: true, data })).catch((error) => ({ ok: false, error })),
  ]);
  const restricted = [infoResult, tickerResult].some((result) => result.error?.status === 451 || result.error?.kind === "restricted");
  let markets = infoResult.ok ? marketsFromExchangeInfo(infoResult.data) : [];
  const tickers = tickerResult.ok ? tickerResult.data : null;
  if (!markets.length && tickers) markets = marketsFromTickers(tickers);
  markets = attachVolumes(markets, tickers);
  return { markets, restricted, live: markets.length > 0 };
}

function firstRow(data) {
  if (Array.isArray(data)) return data[0] || null;
  if (data && typeof data === "object" && !data.code) return data;
  return null;
}

export async function fetchSnapshot(symbol, signal) {
  const urls = restUrls(symbol);
  const entries = await Promise.all(
    Object.entries(urls).map(async ([key, url]) => {
      try {
        const data = await fetchJson(url, signal);
        return [key, { ok: true, data }];
      } catch (error) {
        return [key, { ok: false, kind: error.kind || "network", status: error.status || 0 }];
      }
    }),
  );
  const bag = Object.fromEntries(entries);
  const anyOk = entries.some(([, value]) => value.ok);
  const restricted = entries.some(([, value]) => value.status === 451 || value.kind === "restricted");
  return {
    anyOk,
    restricted,
    premium: bag.premium.ok ? bag.premium.data : null,
    ticker: bag.ticker.ok ? bag.ticker.data : null,
    openInterest: bag.openInterest.ok ? bag.openInterest.data : null,
    depth: bag.depth.ok ? bag.depth.data : null,
    accounts: bag.accounts.ok ? firstRow(bag.accounts.data) : null,
    taker: bag.taker.ok ? firstRow(bag.taker.data) : null,
  };
}

function openSocket(url, { onMessage, onClose, watchMs = 8000 }) {
  let socket;
  let closed = false;
  try {
    socket = new WebSocket(url);
  } catch (error) {
    onClose(error);
    return () => {};
  }
  const watchdog =
    watchMs > 0
      ? setTimeout(() => {
          if (!closed) {
            try {
              socket.close();
            } catch {
              /* already closing */
            }
          }
        }, watchMs)
      : 0;
  socket.onmessage = (event) => {
    if (watchdog) clearTimeout(watchdog);
    onMessage(event.data);
  };
  socket.onerror = () => {};
  socket.onclose = () => {
    if (watchdog) clearTimeout(watchdog);
    if (!closed) onClose();
  };
  return () => {
    closed = true;
    if (watchdog) clearTimeout(watchdog);
    socket.onclose = null;
    try {
      socket.close();
    } catch {
      /* ignore */
    }
  };
}

export function createFeed(symbol, handlers) {
  let stopped = false;
  let marketMode = "combined";
  let marketStops = [];
  let depthStop = () => {};
  let depthAttempt = 0;
  let marketAttempt = 0;
  let retryTimer = 0;
  let depthTimer = 0;
  let marketGotMessage = false;
  let openedAt = 0;
  let reconnecting = false;

  function emitLife(state) {
    handlers.onLife?.({
      market: state,
      failCount: marketAttempt,
      openedAt,
    });
  }

  function stopMarket() {
    for (const stop of marketStops) stop();
    marketStops = [];
  }

  function handleRaw(raw) {
    let data;
    try {
      data = unwrapStream(raw);
    } catch {
      return;
    }
    if (!data || !data.e) return;
    if (!marketGotMessage) {
      marketGotMessage = true;
      marketAttempt = 0;
      openedAt = Date.now();
      emitLife("open");
    }
    handlers.onEvent?.(data);
  }

  function reconnectMarket() {
    if (stopped || reconnecting) return;
    reconnecting = true;
    if (!marketGotMessage) {
      marketAttempt += 1;
      marketMode = marketMode === "combined" ? "split" : "combined";
    }
    emitLife("down");
    const delay = Math.min(12_000, 700 * 1.7 ** Math.min(marketAttempt, 6));
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      reconnecting = false;
      startMarket();
    }, delay);
  }

  function startMarket() {
    if (stopped) return;
    stopMarket();
    marketGotMessage = false;
    emitLife("connecting");
    if (marketMode === "combined") {
      marketStops.push(
        openSocket(marketStreamUrl(symbol), {
          watchMs: 8000,
          onMessage: handleRaw,
          onClose: reconnectMarket,
        }),
      );
      return;
    }
    for (const url of marketSplitUrls(symbol)) {
      const silent = url.includes("@forceOrder");
      const critical = url.includes("@aggTrade") || url.includes("@markPrice") || url.includes("@ticker");
      marketStops.push(
        openSocket(url, {
          watchMs: silent ? 0 : 8000,
          onMessage: handleRaw,
          onClose: () => {
            if (critical) reconnectMarket();
          },
        }),
      );
    }
  }

  function startDepth() {
    if (stopped) return;
    const urls = depthStreamUrls(symbol);
    const url = urls[depthAttempt % urls.length];
    depthStop = openSocket(url, {
      onOpen: () => {},
      onMessage: (raw) => {
        let data;
        try {
          data = unwrapStream(raw);
        } catch {
          return;
        }
        if (data && data.e === "depthUpdate") {
          depthAttempt = 0;
          handlers.onDepth?.(data);
        }
      },
      onClose: () => {
        if (stopped) return;
        depthAttempt += 1;
        depthTimer = setTimeout(startDepth, Math.min(10_000, 600 * depthAttempt));
      },
    });
  }

  startMarket();
  startDepth();

  return {
    stop() {
      stopped = true;
      clearTimeout(retryTimer);
      clearTimeout(depthTimer);
      stopMarket();
      depthStop();
    },
  };
}
