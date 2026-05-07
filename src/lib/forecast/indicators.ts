/**
 * Indicator math — series variants for backtesting and time-series analysis.
 *
 *   The point-value functions in `lib/scoring/technical.ts` return the LAST
 *   value of each indicator (good for the snapshot UI). The walk-forward
 *   backtest needs the entire time series of every indicator so it can
 *   evaluate the model's vote at each historical day. So this module
 *   re-implements the same indicators as O(N) series functions, returning
 *   one value per input bar (with leading nulls during warmup).
 *
 *   All functions here take "rich" bars (OHLCV) since the new indicators
 *   require high/low/volume that the closes-only series doesn't have.
 *
 *   Indicators implemented:
 *     - smaSeries(period)          (close-only)
 *     - emaSeries(period)          (close-only)
 *     - rsiSeries(period=14)       (close-only)
 *     - macdSeries(12, 26, 9)      (close-only)
 *     - bollingerSeries(20, 2)     (close-only)
 *     - atrSeries(period=14)       (TR — needs HLC)
 *     - adxSeries(period=14)       (trend strength — needs HLC)
 *     - obvSeries()                (volume-price agreement)
 *     - stochasticSeries(14, 3)    (%K %D — needs HLC)
 *     - cmfSeries(period=20)       (Chaikin Money Flow — needs HLCV)
 *
 *   Each returns an array of length === bars.length, with nulls during
 *   warmup. Aligned indices make backtest day-i lookups cheap.
 */

export interface RichBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Series = (number | null)[];

// ─── Close-only series ──────────────────────────────────────────────────

export function smaSeries(closes: number[], period: number): Series {
  const out: Series = new Array(closes.length).fill(null);
  if (closes.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  out[period - 1] = sum / period;
  for (let i = period; i < closes.length; i++) {
    sum += closes[i] - closes[i - period];
    out[i] = sum / period;
  }
  return out;
}

export function emaSeries(closes: number[], period: number): Series {
  const out: Series = new Array(closes.length).fill(null);
  if (closes.length < period) return out;
  const k = 2 / (period + 1);
  // Seed with SMA over first `period` values.
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  let ema = sum / period;
  out[period - 1] = ema;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

/** Wilder's smoothed RSI series. */
export function rsiSeries(closes: number[], period = 14): Series {
  const out: Series = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return out;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export interface MacdValue {
  macd: number;
  signal: number;
  histogram: number;
}

export function macdSeries(closes: number[], fast = 12, slow = 26, signalPeriod = 9): Array<MacdValue | null> {
  const out: Array<MacdValue | null> = new Array(closes.length).fill(null);
  if (closes.length < slow + signalPeriod) return out;

  const fastEma = emaSeries(closes, fast);
  const slowEma = emaSeries(closes, slow);

  // MACD line = fastEma - slowEma. Defined only where both EMAs exist.
  const macdLine: Series = closes.map((_, i) => {
    if (fastEma[i] == null || slowEma[i] == null) return null;
    return (fastEma[i] as number) - (slowEma[i] as number);
  });

  // Signal line = EMA of MACD line (skip nulls in seed phase).
  const macdValues: number[] = [];
  const macdIndices: number[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] != null) {
      macdValues.push(macdLine[i] as number);
      macdIndices.push(i);
    }
  }
  if (macdValues.length < signalPeriod) return out;

  const signalRaw = emaSeries(macdValues, signalPeriod);

  for (let j = 0; j < macdIndices.length; j++) {
    const i = macdIndices[j];
    const m = macdLine[i] as number;
    const s = signalRaw[j];
    if (s == null) continue;
    out[i] = { macd: m, signal: s, histogram: m - s };
  }

  return out;
}

export interface BollingerValue {
  upper: number;
  mid: number;
  lower: number;
}

export function bollingerSeries(
  closes: number[],
  period = 20,
  stdDevs = 2,
): Array<BollingerValue | null> {
  const out: Array<BollingerValue | null> = new Array(closes.length).fill(null);
  if (closes.length < period) return out;

  // Rolling sum + sum-of-squares for O(N) variance.
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < period; i++) {
    sum += closes[i];
    sumSq += closes[i] ** 2;
  }
  const fillBand = (i: number) => {
    const mean = sum / period;
    const variance = sumSq / period - mean * mean;
    const sd = Math.sqrt(Math.max(0, variance));
    out[i] = { mid: mean, upper: mean + sd * stdDevs, lower: mean - sd * stdDevs };
  };
  fillBand(period - 1);
  for (let i = period; i < closes.length; i++) {
    const drop = closes[i - period];
    const add = closes[i];
    sum += add - drop;
    sumSq += add * add - drop * drop;
    fillBand(i);
  }
  return out;
}

// ─── HLC / OHLCV series ─────────────────────────────────────────────────

/** True Range series. TR = max(H-L, |H-prevC|, |L-prevC|). */
export function trSeries(bars: RichBar[]): Series {
  const out: Series = new Array(bars.length).fill(null);
  if (bars.length === 0) return out;
  out[0] = bars[0].high - bars[0].low;
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].close;
    out[i] = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - prev),
      Math.abs(bars[i].low - prev),
    );
  }
  return out;
}

/** ATR (Wilder's smoothed True Range). */
export function atrSeries(bars: RichBar[], period = 14): Series {
  const out: Series = new Array(bars.length).fill(null);
  if (bars.length < period + 1) return out;
  const tr = trSeries(bars);

  // Initial ATR: simple average of first `period` TR values.
  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i] as number;
  let atr = sum / period;
  out[period - 1] = atr;
  for (let i = period; i < bars.length; i++) {
    atr = (atr * (period - 1) + (tr[i] as number)) / period;
    out[i] = atr;
  }
  return out;
}

export interface AdxValue {
  adx: number;
  plusDi: number;
  minusDi: number;
}

/** ADX (Average Directional Index) — trend strength 0-100, direction-agnostic.
 *  Above 25 = trending; below 20 = ranging. Uses Wilder's smoothing. */
export function adxSeries(bars: RichBar[], period = 14): Array<AdxValue | null> {
  const out: Array<AdxValue | null> = new Array(bars.length).fill(null);
  if (bars.length < period * 2 + 1) return out;

  const tr = trSeries(bars);
  // Directional movement +DM / -DM
  const plusDM: number[] = new Array(bars.length).fill(0);
  const minusDM: number[] = new Array(bars.length).fill(0);
  for (let i = 1; i < bars.length; i++) {
    const upMove = bars[i].high - bars[i - 1].high;
    const downMove = bars[i - 1].low - bars[i].low;
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
  }

  // Wilder smoothing: initial sum, then x = x - x/period + new
  let trSmooth = 0;
  let plusDmSmooth = 0;
  let minusDmSmooth = 0;
  for (let i = 1; i <= period; i++) {
    trSmooth += tr[i] as number;
    plusDmSmooth += plusDM[i];
    minusDmSmooth += minusDM[i];
  }

  const dxValues: number[] = [];
  const dxIndices: number[] = [];

  function emit(i: number) {
    const plusDI = trSmooth > 0 ? (plusDmSmooth / trSmooth) * 100 : 0;
    const minusDI = trSmooth > 0 ? (minusDmSmooth / trSmooth) * 100 : 0;
    const sumDI = plusDI + minusDI;
    const dx = sumDI > 0 ? (Math.abs(plusDI - minusDI) / sumDI) * 100 : 0;
    dxValues.push(dx);
    dxIndices.push(i);
    return { plusDI, minusDI };
  }
  emit(period);
  for (let i = period + 1; i < bars.length; i++) {
    trSmooth = trSmooth - trSmooth / period + (tr[i] as number);
    plusDmSmooth = plusDmSmooth - plusDmSmooth / period + plusDM[i];
    minusDmSmooth = minusDmSmooth - minusDmSmooth / period + minusDM[i];
    emit(i);
  }

  // ADX = Wilder smoothing of DX. Need `period` more bars.
  if (dxValues.length < period) return out;
  let adx = 0;
  for (let k = 0; k < period; k++) adx += dxValues[k];
  adx /= period;
  // Compute current +DI / -DI at each emit point so the consumer gets them paired.
  function diAt(j: number): { plusDI: number; minusDI: number } {
    // Recompute by walking smoothing — simpler: store diSeries during emit instead.
    return { plusDI: 0, minusDI: 0 };
    // (Unused — we re-walk below. See diSeries below.)
  }
  void diAt;

  // Re-run +DI / -DI walk to keep them aligned. Slight extra cost, much simpler.
  const diSeries: Array<{ plusDI: number; minusDI: number }> = [];
  let trS = 0;
  let pS = 0;
  let mS = 0;
  for (let i = 1; i <= period; i++) {
    trS += tr[i] as number;
    pS += plusDM[i];
    mS += minusDM[i];
  }
  diSeries.push({
    plusDI: trS > 0 ? (pS / trS) * 100 : 0,
    minusDI: trS > 0 ? (mS / trS) * 100 : 0,
  });
  for (let i = period + 1; i < bars.length; i++) {
    trS = trS - trS / period + (tr[i] as number);
    pS = pS - pS / period + plusDM[i];
    mS = mS - mS / period + minusDM[i];
    diSeries.push({
      plusDI: trS > 0 ? (pS / trS) * 100 : 0,
      minusDI: trS > 0 ? (mS / trS) * 100 : 0,
    });
  }

  out[dxIndices[period - 1]] = {
    adx,
    plusDi: diSeries[period - 1].plusDI,
    minusDi: diSeries[period - 1].minusDI,
  };
  for (let k = period; k < dxValues.length; k++) {
    adx = (adx * (period - 1) + dxValues[k]) / period;
    out[dxIndices[k]] = {
      adx,
      plusDi: diSeries[k].plusDI,
      minusDi: diSeries[k].minusDI,
    };
  }

  return out;
}

/** OBV (On-Balance Volume) — cumulative; only relative direction matters. */
export function obvSeries(bars: RichBar[]): Series {
  const out: Series = new Array(bars.length).fill(null);
  if (bars.length === 0) return out;
  let obv = 0;
  out[0] = 0;
  for (let i = 1; i < bars.length; i++) {
    const v = bars[i].volume;
    if (bars[i].close > bars[i - 1].close) obv += v;
    else if (bars[i].close < bars[i - 1].close) obv -= v;
    out[i] = obv;
  }
  return out;
}

export interface StochValue {
  k: number;
  d: number;
}

/** Stochastic oscillator — %K and %D smoothed. */
export function stochasticSeries(
  bars: RichBar[],
  period = 14,
  smooth = 3,
): Array<StochValue | null> {
  const out: Array<StochValue | null> = new Array(bars.length).fill(null);
  if (bars.length < period + smooth) return out;

  const kRaw: Series = new Array(bars.length).fill(null);
  for (let i = period - 1; i < bars.length; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (bars[j].high > hh) hh = bars[j].high;
      if (bars[j].low < ll) ll = bars[j].low;
    }
    const range = hh - ll;
    kRaw[i] = range > 0 ? ((bars[i].close - ll) / range) * 100 : 50;
  }

  // %K is typically smoothed (slow K). %D is SMA of %K. We do SMA(3) for both.
  const kVals = kRaw.map((v) => v ?? 0);
  const kSmooth = smaSeries(kVals, smooth);
  // Compute %D = SMA(smooth) of kSmooth (only where defined).
  const validK: number[] = [];
  const validKIdx: number[] = [];
  for (let i = 0; i < kSmooth.length; i++) {
    if (kSmooth[i] != null && kRaw[i] != null) {
      validK.push(kSmooth[i] as number);
      validKIdx.push(i);
    }
  }
  if (validK.length < smooth) return out;
  const dSmooth = smaSeries(validK, smooth);
  for (let j = 0; j < validKIdx.length; j++) {
    const i = validKIdx[j];
    const dv = dSmooth[j];
    if (dv == null) continue;
    out[i] = { k: kSmooth[i] as number, d: dv };
  }
  return out;
}

/** Chaikin Money Flow — sum of MF volume over period / sum of volume.
 *  Range: -1 to +1. Positive = buying pressure, negative = selling. */
export function cmfSeries(bars: RichBar[], period = 20): Series {
  const out: Series = new Array(bars.length).fill(null);
  if (bars.length < period) return out;

  const mfv: number[] = new Array(bars.length).fill(0);
  for (let i = 0; i < bars.length; i++) {
    const range = bars[i].high - bars[i].low;
    const mfMultiplier = range > 0 ? ((bars[i].close - bars[i].low) - (bars[i].high - bars[i].close)) / range : 0;
    mfv[i] = mfMultiplier * bars[i].volume;
  }

  let mfvSum = 0;
  let volSum = 0;
  for (let i = 0; i < period; i++) {
    mfvSum += mfv[i];
    volSum += bars[i].volume;
  }
  out[period - 1] = volSum > 0 ? mfvSum / volSum : 0;
  for (let i = period; i < bars.length; i++) {
    mfvSum += mfv[i] - mfv[i - period];
    volSum += bars[i].volume - bars[i - period].volume;
    out[i] = volSum > 0 ? mfvSum / volSum : 0;
  }
  return out;
}

// ─── Convenience: full snapshot at index i ──────────────────────────────

/** Convenience accessor used by the directional engine: pull every indicator
 *  at index i from a precomputed bag of series. Returns nulls cleanly when
 *  the indicator hasn't warmed up by that index. */
export interface IndicatorSnapshot {
  close: number;
  sma50: number | null;
  sma200: number | null;
  ema12: number | null;
  ema26: number | null;
  rsi14: number | null;
  macdHist: number | null;
  macdLine: number | null;
  macdSignal: number | null;
  bbUpper: number | null;
  bbLower: number | null;
  bbMid: number | null;
  bbPctB: number | null;
  atr14: number | null;
  adx14: number | null;
  plusDi: number | null;
  minusDi: number | null;
  obv: number | null;
  obvSma20: number | null;
  stochK: number | null;
  stochD: number | null;
  cmf20: number | null;
  return5d: number | null;
  return20d: number | null;
  /** Position in 252-day window: 0 = at low, 1 = at high. */
  pctOf52wRange: number | null;
}

export interface PrecomputedIndicators {
  bars: RichBar[];
  closes: number[];
  sma50: Series;
  sma200: Series;
  ema12: Series;
  ema26: Series;
  rsi14: Series;
  macd: Array<MacdValue | null>;
  bb: Array<BollingerValue | null>;
  atr14: Series;
  adx14: Array<AdxValue | null>;
  obv: Series;
  obvSma20: Series;
  stoch: Array<StochValue | null>;
  cmf20: Series;
}

export function precomputeIndicators(bars: RichBar[]): PrecomputedIndicators {
  const closes = bars.map((b) => b.close);
  const obv = obvSeries(bars);
  const obvNumeric = obv.map((v) => v ?? 0);
  return {
    bars,
    closes,
    sma50: smaSeries(closes, 50),
    sma200: smaSeries(closes, 200),
    ema12: emaSeries(closes, 12),
    ema26: emaSeries(closes, 26),
    rsi14: rsiSeries(closes, 14),
    macd: macdSeries(closes, 12, 26, 9),
    bb: bollingerSeries(closes, 20, 2),
    atr14: atrSeries(bars, 14),
    adx14: adxSeries(bars, 14),
    obv,
    obvSma20: smaSeries(obvNumeric, 20),
    stoch: stochasticSeries(bars, 14, 3),
    cmf20: cmfSeries(bars, 20),
  };
}

export function snapshotAt(p: PrecomputedIndicators, i: number): IndicatorSnapshot {
  const bars = p.bars;
  const close = bars[i].close;

  const macd = p.macd[i];
  const bb = p.bb[i];
  const adx = p.adx14[i];
  const stoch = p.stoch[i];

  const bbPctB =
    bb && bb.upper > bb.lower ? ((close - bb.lower) / (bb.upper - bb.lower)) * 100 : null;

  // Returns over short windows.
  const return5d = i >= 5 ? ((close - bars[i - 5].close) / bars[i - 5].close) * 100 : null;
  const return20d = i >= 20 ? ((close - bars[i - 20].close) / bars[i - 20].close) * 100 : null;

  // 52-week range position.
  const lookback = Math.min(252, i);
  let hh = -Infinity;
  let ll = Infinity;
  for (let j = i - lookback; j <= i; j++) {
    if (bars[j].high > hh) hh = bars[j].high;
    if (bars[j].low < ll) ll = bars[j].low;
  }
  const pctOf52wRange = hh > ll ? (close - ll) / (hh - ll) : null;

  return {
    close,
    sma50: p.sma50[i],
    sma200: p.sma200[i],
    ema12: p.ema12[i],
    ema26: p.ema26[i],
    rsi14: p.rsi14[i],
    macdHist: macd?.histogram ?? null,
    macdLine: macd?.macd ?? null,
    macdSignal: macd?.signal ?? null,
    bbUpper: bb?.upper ?? null,
    bbLower: bb?.lower ?? null,
    bbMid: bb?.mid ?? null,
    bbPctB,
    atr14: p.atr14[i],
    adx14: adx?.adx ?? null,
    plusDi: adx?.plusDi ?? null,
    minusDi: adx?.minusDi ?? null,
    obv: p.obv[i],
    obvSma20: p.obvSma20[i],
    stochK: stoch?.k ?? null,
    stochD: stoch?.d ?? null,
    cmf20: p.cmf20[i],
    return5d,
    return20d,
    pctOf52wRange,
  };
}
