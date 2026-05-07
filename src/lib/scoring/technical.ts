import {
  bucket,
  isFiniteNum,
  weightedAverage,
  type Bias,
  type Score,
  type ScoreInput,
  type SubScore,
} from "./types";

/**
 * Technical analysis from 5y daily OHLC closes.
 *
 *   Indicators:
 *     - SMA 50, SMA 200 (trend)
 *     - EMA 12, EMA 26 (used by MACD)
 *     - MACD line + signal line (12, 26, 9)
 *     - RSI 14 (Wilder's smoothing)
 *     - Bollinger Bands (20, 2σ)
 *     - 52-week high / low position
 *     - Returns: 1m, 3m, 6m, 1y
 *
 *   Score composition (each 0-100):
 *     - Trend       (40%): price vs SMA200, SMA50 vs SMA200
 *     - Momentum    (35%): RSI position, MACD signal cross
 *     - Position    (25%): % from 52w high, BB band position
 *
 *   Bias label is derived independently from the same indicator votes — it's
 *   a *current state* signal, not a forecast. We never claim to predict price
 *   movement.
 */

export interface TechnicalBar {
  /** ISO date string. */
  date: string;
  /** Adjusted close. */
  close: number;
}

export interface TechnicalScore extends Score {
  bias: Bias | null;
  /** Snapshot of the most recent indicator values, used by the UI. */
  snapshot: {
    price: number | null;
    sma50: number | null;
    sma200: number | null;
    rsi14: number | null;
    macd: number | null;
    macdSignal: number | null;
    macdHist: number | null;
    bbUpper: number | null;
    bbLower: number | null;
    bbMid: number | null;
    high52w: number | null;
    low52w: number | null;
    returns: { period: string; value: number | null }[];
  };
}

export function scoreTechnical(bars: TechnicalBar[]): TechnicalScore {
  const closes = bars.map((b) => b.close).filter((c) => isFiniteNum(c));
  if (closes.length < 30) {
    return emptyTechnical("Not enough price history (need at least 30 bars).");
  }

  const last = closes[closes.length - 1];
  const sma50 = closes.length >= 50 ? sma(closes, 50) : null;
  const sma200 = closes.length >= 200 ? sma(closes, 200) : null;
  const rsi14 = closes.length >= 15 ? rsi(closes, 14) : null;
  const macdRes = closes.length >= 35 ? macd(closes, 12, 26, 9) : null;
  const bbRes = closes.length >= 20 ? bollinger(closes, 20, 2) : null;
  const window52w = closes.slice(-Math.min(252, closes.length));
  const high52w = window52w.length ? Math.max(...window52w) : null;
  const low52w = window52w.length ? Math.min(...window52w) : null;
  const returns = computeReturns(closes);

  const trend = scoreTrend({ price: last, sma50, sma200 });
  const momentum = scoreMomentum({
    rsi: rsi14,
    macdHist: macdRes?.histogram ?? null,
    macdLine: macdRes?.macd ?? null,
    macdSignal: macdRes?.signal ?? null,
  });
  const position = scorePosition({
    price: last,
    high52w,
    low52w,
    bbUpper: bbRes?.upper ?? null,
    bbLower: bbRes?.lower ?? null,
    bbMid: bbRes?.mid ?? null,
  });

  const subscores: SubScore[] = [trend, momentum, position];
  const { value, coverage } = weightedAverage(subscores);

  const bias = deriveBias({
    price: last,
    sma50,
    sma200,
    rsi: rsi14,
    macdHist: macdRes?.histogram ?? null,
  });

  return {
    value: value != null ? Math.round(value) : null,
    coverage,
    subscores,
    headline: headlineFor(value, bias, coverage),
    bias,
    snapshot: {
      price: last,
      sma50,
      sma200,
      rsi14,
      macd: macdRes?.macd ?? null,
      macdSignal: macdRes?.signal ?? null,
      macdHist: macdRes?.histogram ?? null,
      bbUpper: bbRes?.upper ?? null,
      bbLower: bbRes?.lower ?? null,
      bbMid: bbRes?.mid ?? null,
      high52w,
      low52w,
      returns,
    },
  };
}

function emptyTechnical(reason: string): TechnicalScore {
  return {
    value: null,
    coverage: 0,
    subscores: [],
    headline: reason,
    bias: null,
    snapshot: {
      price: null,
      sma50: null,
      sma200: null,
      rsi14: null,
      macd: null,
      macdSignal: null,
      macdHist: null,
      bbUpper: null,
      bbLower: null,
      bbMid: null,
      high52w: null,
      low52w: null,
      returns: [],
    },
  };
}

function headlineFor(value: number | null, bias: Bias | null, coverage: number): string {
  if (value == null) return "Insufficient price history";
  const band =
    value >= 75 ? "Strong technicals" : value >= 55 ? "Mixed but constructive" : value >= 40 ? "Mixed with red flags" : "Weak technicals";
  const biasNote = bias ? ` · bias ${bias}` : "";
  const lowConf = coverage < 0.6 ? " (partial — short price history)" : "";
  return `${band}${biasNote}${lowConf}`;
}

// ─── Sub-score: Trend ───────────────────────────────────────────────────

function scoreTrend(args: { price: number; sma50: number | null; sma200: number | null }): SubScore {
  const inputs: ScoreInput[] = [];

  // Price vs SMA200 — long-term trend filter.
  let pVsSmaScore: number | null = null;
  if (args.sma200 != null) {
    const pct = ((args.price - args.sma200) / args.sma200) * 100;
    pVsSmaScore = bucket(pct, [
      { lt: -20, score: 5 },
      { lt: -10, score: 25 },
      { lt: -5, score: 45 },
      { lt: 0, score: 55 },
      { lt: 5, score: 70 },
      { lt: 15, score: 90 },
      { lt: 30, score: 100 },
      { lt: Infinity, score: 80 }, // very far above can imply overextension
    ]);
    inputs.push({
      label: "Price vs 200-day SMA",
      value: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`,
      contribution: pVsSmaScore,
      note:
        pct < -10
          ? "Well below long-term average — sustained downtrend."
          : pct < 0
            ? "Below long-term average — caution."
            : pct < 15
              ? "Above long-term average — uptrend intact."
              : "Far above — extended; mean-reversion risk.",
    });
  } else {
    inputs.push({
      label: "Price vs 200-day SMA",
      value: "—",
      contribution: null,
      note: "Need 200 days of history.",
    });
  }

  // SMA50 vs SMA200 — golden/death cross.
  let crossScore: number | null = null;
  if (args.sma50 != null && args.sma200 != null) {
    const diff = ((args.sma50 - args.sma200) / args.sma200) * 100;
    crossScore = bucket(diff, [
      { lt: -10, score: 0 },
      { lt: -3, score: 25 },
      { lt: 0, score: 45 },
      { lt: 3, score: 65 },
      { lt: 10, score: 90 },
      { lt: Infinity, score: 100 },
    ]);
    inputs.push({
      label: "50-day vs 200-day SMA",
      value: `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`,
      contribution: crossScore,
      note:
        diff < 0
          ? "50-day below 200-day — death-cross territory; bearish bias."
          : diff < 5
            ? "50-day just above 200-day — early uptrend."
            : "Golden cross intact — established uptrend.",
    });
  } else {
    inputs.push({
      label: "50-day vs 200-day SMA",
      value: "—",
      contribution: null,
      note: "Need both 50d and 200d MAs.",
    });
  }

  return {
    label: "Trend",
    weight: 0.4,
    value: avg(inputs.map((i) => i.contribution)),
    verdict: trendVerdict(pVsSmaScore, crossScore),
    inputs,
  };
}

function trendVerdict(pVsSma: number | null, cross: number | null): string {
  const a = avg([pVsSma, cross]);
  if (a == null) return "Insufficient history.";
  if (a >= 75) return "Strong uptrend on both timeframes.";
  if (a >= 50) return "Moderate uptrend / consolidation.";
  if (a >= 30) return "Weak trend — sideways or rolling over.";
  return "Downtrend on both timeframes.";
}

// ─── Sub-score: Momentum ────────────────────────────────────────────────

function scoreMomentum(args: {
  rsi: number | null;
  macdHist: number | null;
  macdLine: number | null;
  macdSignal: number | null;
}): SubScore {
  const inputs: ScoreInput[] = [];

  // RSI: 30-70 healthy. <30 oversold, >70 overbought. We give MID-range
  // a high score (sustainable), penalize extremes.
  let rsiScore: number | null = null;
  if (args.rsi != null) {
    rsiScore = bucket(args.rsi, [
      { lt: 25, score: 35 }, // oversold — could bounce, but bearish trend
      { lt: 35, score: 70 },
      { lt: 45, score: 80 },
      { lt: 55, score: 90 },
      { lt: 65, score: 95 },
      { lt: 75, score: 70 }, // overbought
      { lt: Infinity, score: 30 }, // extreme overbought — pullback risk
    ]);
    inputs.push({
      label: "RSI (14d)",
      value: args.rsi.toFixed(1),
      contribution: rsiScore,
      note:
        args.rsi < 30
          ? "Oversold — short-term bounce possible, but in downtrend."
          : args.rsi < 45
            ? "Cooling off — neutral-to-soft momentum."
            : args.rsi < 60
              ? "Healthy momentum — neither stretched nor weak."
              : args.rsi < 70
                ? "Strong momentum — getting stretched."
                : "Overbought — short-term pullback risk.",
    });
  } else {
    inputs.push({ label: "RSI (14d)", value: "—", contribution: null, note: "Need 15+ bars." });
  }

  // MACD histogram — momentum direction.
  let macdScore: number | null = null;
  if (args.macdHist != null && args.macdLine != null && args.macdSignal != null) {
    const above = args.macdLine > args.macdSignal;
    const histStrength = Math.min(100, Math.abs(args.macdHist) * 50); // arbitrary scaling
    macdScore = above ? 60 + histStrength * 0.4 : 40 - histStrength * 0.4;
    macdScore = Math.max(0, Math.min(100, macdScore));
    inputs.push({
      label: "MACD signal",
      value: above ? "above signal" : "below signal",
      contribution: macdScore,
      note:
        above
          ? "MACD line above signal — momentum positive."
          : "MACD line below signal — momentum negative.",
    });
  } else {
    inputs.push({ label: "MACD signal", value: "—", contribution: null, note: "Need 35+ bars." });
  }

  return {
    label: "Momentum",
    weight: 0.35,
    value: avg(inputs.map((i) => i.contribution)),
    verdict: momentumVerdict(rsiScore, macdScore),
    inputs,
  };
}

function momentumVerdict(rsi: number | null, macd: number | null): string {
  const a = avg([rsi, macd]);
  if (a == null) return "Insufficient history.";
  if (a >= 75) return "Strong positive momentum.";
  if (a >= 55) return "Constructive momentum, neither stretched nor weak.";
  if (a >= 40) return "Mixed momentum signals.";
  return "Weak / negative momentum.";
}

// ─── Sub-score: Position ────────────────────────────────────────────────

function scorePosition(args: {
  price: number;
  high52w: number | null;
  low52w: number | null;
  bbUpper: number | null;
  bbLower: number | null;
  bbMid: number | null;
}): SubScore {
  const inputs: ScoreInput[] = [];

  // Distance from 52w high — trending stocks keep printing new highs.
  let highScore: number | null = null;
  if (args.high52w != null && args.high52w > 0) {
    const pctOff = ((args.high52w - args.price) / args.high52w) * 100;
    highScore = bucket(pctOff, [
      { lt: 2, score: 100 }, // at or near new high
      { lt: 5, score: 90 },
      { lt: 10, score: 75 },
      { lt: 20, score: 55 },
      { lt: 35, score: 35 },
      { lt: 50, score: 15 },
      { lt: Infinity, score: 5 },
    ]);
    inputs.push({
      label: "% off 52-week high",
      value: `${pctOff.toFixed(1)}%`,
      contribution: highScore,
      note:
        pctOff < 5
          ? "Near 52-week high — strength."
          : pctOff < 20
            ? "Modest pullback — healthy consolidation possible."
            : pctOff < 40
              ? "Significant drawdown — assess fundamentals."
              : "Deep drawdown — value or value trap.",
    });
  } else {
    inputs.push({
      label: "% off 52-week high",
      value: "—",
      contribution: null,
      note: "Need 1y of history.",
    });
  }

  // Position within Bollinger band — extremes signal mean-reversion.
  let bbScore: number | null = null;
  if (args.bbUpper != null && args.bbLower != null && args.bbUpper > args.bbLower) {
    const pct = ((args.price - args.bbLower) / (args.bbUpper - args.bbLower)) * 100;
    bbScore = bucket(pct, [
      { lt: 0, score: 30 }, // outside lower band
      { lt: 20, score: 60 },
      { lt: 40, score: 75 },
      { lt: 60, score: 85 },
      { lt: 80, score: 80 },
      { lt: 100, score: 65 },
      { lt: Infinity, score: 35 }, // outside upper band — overextended
    ]);
    inputs.push({
      label: "Bollinger position",
      value: `${pct.toFixed(0)}% of band`,
      contribution: bbScore,
      note:
        pct < 20
          ? "Near / below lower band — oversold short-term."
          : pct < 80
            ? "Inside the band — normal range."
            : "Near / above upper band — overextended short-term.",
    });
  } else {
    inputs.push({
      label: "Bollinger position",
      value: "—",
      contribution: null,
      note: "Need 20+ bars.",
    });
  }

  return {
    label: "Position",
    weight: 0.25,
    value: avg(inputs.map((i) => i.contribution)),
    verdict: positionVerdict(highScore, bbScore),
    inputs,
  };
}

function positionVerdict(high: number | null, bb: number | null): string {
  const a = avg([high, bb]);
  if (a == null) return "Insufficient history.";
  if (a >= 75) return "Trading near highs, in healthy band position.";
  if (a >= 55) return "Constructive position — not extended.";
  if (a >= 35) return "Below highs but no immediate reversal signal.";
  return "Weak position — far below highs and / or stretched.";
}

// ─── Bias derivation ────────────────────────────────────────────────────

function deriveBias(args: {
  price: number;
  sma50: number | null;
  sma200: number | null;
  rsi: number | null;
  macdHist: number | null;
}): Bias | null {
  const votes: number[] = []; // +1 bullish, -1 bearish, 0 neutral
  if (args.sma200 != null) {
    votes.push(args.price > args.sma200 ? 1 : -1);
  }
  if (args.sma50 != null && args.sma200 != null) {
    votes.push(args.sma50 > args.sma200 ? 1 : -1);
  }
  if (args.rsi != null) {
    if (args.rsi > 55) votes.push(1);
    else if (args.rsi < 45) votes.push(-1);
    else votes.push(0);
  }
  if (args.macdHist != null) {
    votes.push(args.macdHist > 0 ? 1 : -1);
  }
  if (votes.length === 0) return null;
  const sum = votes.reduce((a, b) => a + b, 0);
  if (sum >= 2) return "bullish";
  if (sum <= -2) return "bearish";
  return "neutral";
}

// ─── Returns ────────────────────────────────────────────────────────────

function computeReturns(closes: number[]): { period: string; value: number | null }[] {
  const periods: Array<{ label: string; bars: number }> = [
    { label: "1m", bars: 21 },
    { label: "3m", bars: 63 },
    { label: "6m", bars: 126 },
    { label: "1y", bars: 252 },
  ];
  const last = closes[closes.length - 1];
  return periods.map(({ label, bars }) => {
    if (closes.length <= bars) return { period: label, value: null };
    const past = closes[closes.length - 1 - bars];
    if (!isFiniteNum(past) || past <= 0) return { period: label, value: null };
    return { period: label, value: ((last - past) / past) * 100 };
  });
}

// ─── Indicator math (pure) ──────────────────────────────────────────────

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  // Seed with SMA of first `period` values, then propagate EMA.
  let seed = 0;
  for (let i = 0; i < Math.min(period, values.length); i++) seed += values[i];
  if (values.length < period) return out;
  seed = seed / period;
  out.push(seed);
  for (let i = period; i < values.length; i++) {
    const prev = out[out.length - 1];
    out.push(values[i] * k + prev * (1 - k));
  }
  return out;
}

/** Wilder's smoothed RSI. */
export function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): { macd: number; signal: number; histogram: number } | null {
  if (values.length < slow + signal) return null;
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  // Align the two EMA streams: slow starts later, so trim fast to match.
  const offset = slowEma.length;
  const macdLine: number[] = [];
  const fastTrim = fastEma.slice(fastEma.length - offset);
  for (let i = 0; i < offset; i++) macdLine.push(fastTrim[i] - slowEma[i]);
  const signalLine = ema(macdLine, signal);
  if (signalLine.length === 0) return null;
  const lastMacd = macdLine[macdLine.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];
  return {
    macd: lastMacd,
    signal: lastSignal,
    histogram: lastMacd - lastSignal,
  };
}

export function bollinger(
  values: number[],
  period = 20,
  stdDevs = 2,
): { upper: number; mid: number; lower: number } | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return {
    mid: mean,
    upper: mean + sd * stdDevs,
    lower: mean - sd * stdDevs,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────

function avg(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v != null);
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0) / present.length;
}
