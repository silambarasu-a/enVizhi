import YahooFinance from "yahoo-finance2";
import type {
  MarketDataProvider,
  MarketMovers,
  MoverEntry,
  NormalizedFundamentals,
  NormalizedInsights,
  NormalizedQuote,
  OHLCBar,
  OHLCRange,
  ScreenId,
  SearchMatch,
} from "./types";

/**
 * NIFTY 50 components (Indian large caps). Used as the universe for India's
 * "Top gainers / losers" cards because Yahoo's predefined `day_gainers` /
 * `day_losers` screens are US-locked (the `region` param doesn't filter them
 * server-side). Names are baked in so we don't need a second metadata fetch.
 *
 * Refresh annually — index reconstitution typically swaps a handful of names.
 */
const NIFTY_50: ReadonlyArray<{ symbol: string; name: string }> = [
  { symbol: "RELIANCE.NS", name: "Reliance Industries" },
  { symbol: "TCS.NS", name: "Tata Consultancy Services" },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank" },
  { symbol: "INFY.NS", name: "Infosys" },
  { symbol: "ICICIBANK.NS", name: "ICICI Bank" },
  { symbol: "HINDUNILVR.NS", name: "Hindustan Unilever" },
  { symbol: "ITC.NS", name: "ITC" },
  { symbol: "BHARTIARTL.NS", name: "Bharti Airtel" },
  { symbol: "KOTAKBANK.NS", name: "Kotak Mahindra Bank" },
  { symbol: "LT.NS", name: "Larsen & Toubro" },
  { symbol: "AXISBANK.NS", name: "Axis Bank" },
  { symbol: "ASIANPAINT.NS", name: "Asian Paints" },
  { symbol: "MARUTI.NS", name: "Maruti Suzuki" },
  { symbol: "BAJFINANCE.NS", name: "Bajaj Finance" },
  { symbol: "TITAN.NS", name: "Titan Company" },
  { symbol: "SUNPHARMA.NS", name: "Sun Pharmaceutical" },
  { symbol: "HCLTECH.NS", name: "HCL Technologies" },
  { symbol: "WIPRO.NS", name: "Wipro" },
  { symbol: "NESTLEIND.NS", name: "Nestle India" },
  { symbol: "ULTRACEMCO.NS", name: "UltraTech Cement" },
  { symbol: "BAJAJFINSV.NS", name: "Bajaj Finserv" },
  { symbol: "NTPC.NS", name: "NTPC" },
  { symbol: "M&M.NS", name: "Mahindra & Mahindra" },
  { symbol: "POWERGRID.NS", name: "Power Grid Corporation" },
  { symbol: "TATASTEEL.NS", name: "Tata Steel" },
  { symbol: "JSWSTEEL.NS", name: "JSW Steel" },
  { symbol: "COALINDIA.NS", name: "Coal India" },
  { symbol: "ONGC.NS", name: "Oil & Natural Gas" },
  { symbol: "ADANIENT.NS", name: "Adani Enterprises" },
  { symbol: "ADANIPORTS.NS", name: "Adani Ports" },
  { symbol: "GRASIM.NS", name: "Grasim Industries" },
  { symbol: "BAJAJ-AUTO.NS", name: "Bajaj Auto" },
  { symbol: "HEROMOTOCO.NS", name: "Hero MotoCorp" },
  { symbol: "EICHERMOT.NS", name: "Eicher Motors" },
  { symbol: "TATAMOTORS.NS", name: "Tata Motors" },
  { symbol: "INDUSINDBK.NS", name: "IndusInd Bank" },
  { symbol: "SBIN.NS", name: "State Bank of India" },
  { symbol: "DRREDDY.NS", name: "Dr. Reddy's Laboratories" },
  { symbol: "CIPLA.NS", name: "Cipla" },
  { symbol: "BPCL.NS", name: "Bharat Petroleum" },
  { symbol: "BRITANNIA.NS", name: "Britannia Industries" },
  { symbol: "DIVISLAB.NS", name: "Divi's Laboratories" },
  { symbol: "TATACONSUM.NS", name: "Tata Consumer Products" },
  { symbol: "HINDALCO.NS", name: "Hindalco Industries" },
  { symbol: "APOLLOHOSP.NS", name: "Apollo Hospitals" },
  { symbol: "LTIM.NS", name: "LTIMindtree" },
  { symbol: "SHRIRAMFIN.NS", name: "Shriram Finance" },
  { symbol: "TRENT.NS", name: "Trent" },
  { symbol: "TATAPOWER.NS", name: "Tata Power" },
  { symbol: "BEL.NS", name: "Bharat Electronics" },
];

// yahoo-finance2 v3 requires explicit instantiation (was a singleton in v2).
//
// `validation.logErrors: false` silences yahoo-finance2's noisy schema-drift
// warnings — Yahoo periodically adds fields (e.g. `impliedSharesOutstanding`
// on screener responses) that the lib's strict JSON schema rejects, which
// otherwise THROWS and bubbles up to our try/catches as empty results. The
// data itself parses fine; we don't need the lib policing Yahoo's payloads.
const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  validation: { logErrors: false, logOptionsErrors: false },
});

/** Yahoo intraday intervals work only on short windows: 1m up to 7d, 5m/15m
 *  up to 60d, 30m/60m up to ~730d. Outside those windows Yahoo returns 422. */
const RANGE_TO_PERIOD: Record<
  OHLCRange,
  { period1: Date; interval: "5m" | "30m" | "1d" | "1wk" }
> = {
  // Intraday — overshoot the window slightly so we always pick up the most
  // recent session (Yahoo can lag by a few minutes after close).
  "1d": { period1: daysAgo(2), interval: "5m" },
  "1w": { period1: daysAgo(8), interval: "30m" },
  // Daily / weekly bars.
  "1mo": { period1: daysAgo(30), interval: "1d" },
  "3mo": { period1: daysAgo(91), interval: "1d" },
  "6mo": { period1: daysAgo(183), interval: "1d" },
  "1y": { period1: daysAgo(365), interval: "1d" },
  "5y": { period1: daysAgo(365 * 5), interval: "1wk" },
};

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function flag(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "number" && !Number.isFinite(value));
}

export const yahooProvider: MarketDataProvider = {
  name: "yahoo",

  async getQuote(symbol) {
    const q = (await yahooFinance.quote(symbol)) as RawQuote | RawQuote[];
    const single = Array.isArray(q) ? q[0]! : q;
    return normalizeQuote(single);
  },

  async getQuotes(symbols) {
    if (symbols.length === 0) return [];
    const quotes = (await yahooFinance.quote(symbols)) as RawQuote | RawQuote[];
    const list = Array.isArray(quotes) ? quotes : [quotes];
    return list.map(normalizeQuote);
  },

  async getFundamentals(symbol) {
    // yahoo-finance2's typings narrow to `never` for arbitrary module tuples;
    // cast to a permissive shape since we treat every field as optional anyway.
    //
    // We pull MORE modules than the obvious five so we can compute fallbacks
    // when Yahoo doesn't surface the headline metric directly:
    //   - earnings: yearly EPS series → compute 5y growth CAGR ourselves
    //   - incomeStatementHistory: yearly revenue → compute 5y revenue growth
    //   - balanceSheetHistory: shares outstanding → compute marketCap
    //
    // Fallbacks are non-destructive: if Yahoo's direct field is present we
    // use that; only when it's null do we derive.
    const summary = (await yahooFinance.quoteSummary(symbol, {
      modules: [
        "summaryDetail",
        "defaultKeyStatistics",
        "financialData",
        "assetProfile",
        "price",
        "earnings",
        "incomeStatementHistory",
        "balanceSheetHistory",
      ],
    })) as Record<string, Record<string, unknown> | undefined>;

    const d = summary.summaryDetail ?? {};
    const k = summary.defaultKeyStatistics ?? {};
    const f = summary.financialData ?? {};
    const a = summary.assetProfile ?? {};
    const p = summary.price ?? {};
    const earnings = summary.earnings as
      | { financialsChart?: { yearly?: Array<{ date?: string | number; earnings?: number; revenue?: number }> } }
      | undefined;
    const incomeHistory = summary.incomeStatementHistory as
      | { incomeStatementHistory?: Array<{ totalRevenue?: number; netIncome?: number; endDate?: Date | string }> }
      | undefined;

    const price = numOrNull(p.regularMarketPrice);

    // ── Direct Yahoo values ─────────────────────────────────────────
    const pe = numOrNull(d.trailingPE) ?? numOrNull(k.trailingEps && price ? price / Number(k.trailingEps) : null);
    const peg = numOrNull(k.pegRatio);
    let eps = numOrNull(k.trailingEps);
    const dividendYield = numOrNull(d.dividendYield ? Number(d.dividendYield) * 100 : null);
    const debtToEquity = numOrNull(f.debtToEquity);
    const roe = numOrNull(f.returnOnEquity ? Number(f.returnOnEquity) * 100 : null);
    const profitMargin = numOrNull(f.profitMargins ? Number(f.profitMargins) * 100 : null);
    const beta = numOrNull(d.beta ?? k.beta);
    const priceToBook = numOrNull(k.priceToBook);
    const sector = strOrNull(a.sector);
    const industry = strOrNull(a.industry);
    const currency = strOrNull(p.currency);

    // ── Derived fallbacks ────────────────────────────────────────────
    // EPS growth (5y CAGR from yearly earnings series).
    let epsGrowth5y = numOrNull(f.earningsGrowth ? Number(f.earningsGrowth) * 100 : null);
    if (epsGrowth5y == null) {
      epsGrowth5y = computeYearlyCagr(
        (earnings?.financialsChart?.yearly ?? []).map((y) => numOrNull(y.earnings)),
      );
    }

    // Revenue growth (5y CAGR from yearly revenue series).
    let revenueGrowth5y = numOrNull(f.revenueGrowth ? Number(f.revenueGrowth) * 100 : null);
    if (revenueGrowth5y == null) {
      const yearlyRev = (earnings?.financialsChart?.yearly ?? []).map((y) => numOrNull(y.revenue));
      revenueGrowth5y = computeYearlyCagr(yearlyRev);
    }
    if (revenueGrowth5y == null) {
      // Last resort: derive from annual income statements (oldest → newest).
      const rev = (incomeHistory?.incomeStatementHistory ?? [])
        .map((r) => numOrNull(r.totalRevenue))
        .filter((v): v is number => v != null && v > 0)
        .reverse(); // Yahoo returns newest first; flip so oldest→newest.
      revenueGrowth5y = computeYearlyCagr(rev);
    }

    // Trailing EPS fallback: latest yearly earnings ÷ shares outstanding.
    if (eps == null) {
      const yearly = earnings?.financialsChart?.yearly ?? [];
      const latestEarnings = numOrNull(yearly[yearly.length - 1]?.earnings);
      const shares = numOrNull(k.sharesOutstanding) ?? numOrNull(d.sharesOutstanding);
      if (latestEarnings != null && shares != null && shares > 0) {
        eps = latestEarnings / shares;
      }
    }

    // Market cap: prefer Yahoo's direct value; else compute from shares × price.
    let marketCap = bigIntOrNull(p.marketCap);
    if (marketCap == null) {
      const shares = numOrNull(k.sharesOutstanding) ?? numOrNull(d.sharesOutstanding) ?? numOrNull(k.impliedSharesOutstanding);
      if (shares != null && price != null && shares > 0 && price > 0) {
        marketCap = bigIntOrNull(shares * price);
      }
    }

    const dataQualityFlags: Record<string, boolean> = {};
    if (flag(pe)) dataQualityFlags.pe = true;
    if (flag(peg)) dataQualityFlags.peg = true;
    if (flag(eps)) dataQualityFlags.eps = true;
    if (flag(epsGrowth5y)) dataQualityFlags.epsGrowth5y = true;
    if (flag(revenueGrowth5y)) dataQualityFlags.revenueGrowth5y = true;
    if (flag(dividendYield)) dataQualityFlags.dividendYield = true;
    if (flag(debtToEquity)) dataQualityFlags.debtToEquity = true;
    if (flag(roe)) dataQualityFlags.roe = true;
    if (flag(profitMargin)) dataQualityFlags.profitMargin = true;
    if (flag(beta)) dataQualityFlags.beta = true;
    if (flag(priceToBook)) dataQualityFlags.priceToBook = true;
    if (flag(marketCap)) dataQualityFlags.marketCap = true;
    if (flag(sector)) dataQualityFlags.sector = true;
    if (flag(industry)) dataQualityFlags.industry = true;

    return {
      symbol,
      pe,
      peg,
      marketCap,
      eps,
      epsGrowth5y,
      revenueGrowth5y,
      dividendYield,
      debtToEquity,
      roe,
      profitMargin,
      beta,
      priceToBook,
      sector,
      industry,
      currency,
      syncedAt: new Date(),
      dataQualityFlags,
    } satisfies NormalizedFundamentals;
  },

  async getOHLC(symbol, range) {
    const cfg = RANGE_TO_PERIOD[range];
    const result = (await yahooFinance.chart(symbol, {
      period1: cfg.period1,
      interval: cfg.interval,
    })) as {
      quotes?: Array<{
        date: string | number | Date;
        open: number | null;
        high: number | null;
        low: number | null;
        close: number | null;
        volume: number | null;
      }>;
    };
    const quotes = result.quotes ?? [];
    return quotes
      .filter((q) => q.close != null && q.open != null && q.high != null && q.low != null)
      .map<OHLCBar>((q) => ({
        date: new Date(q.date),
        open: q.open!,
        high: q.high!,
        low: q.low!,
        close: q.close!,
        volume: q.volume != null ? BigInt(Math.trunc(q.volume)) : BigInt(0),
      }));
  },

  async getFXRate(base, quote) {
    const symbol = `${base}${quote}=X`;
    const q = (await yahooFinance.quote(symbol)) as
      | { regularMarketPrice?: number | null }
      | Array<{ regularMarketPrice?: number | null }>;
    const arr = Array.isArray(q) ? q[0] : q;
    if (!arr || arr.regularMarketPrice == null) {
      throw new Error(`FX rate ${base}/${quote} unavailable`);
    }
    return Number(arr.regularMarketPrice);
  },

  async search(query) {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const result = (await yahooFinance.search(trimmed, {
      quotesCount: 20,
      newsCount: 0,
    })) as {
      quotes?: Array<{
        symbol?: string;
        shortname?: string;
        longname?: string;
        exchange?: string;
        exchangeDisplay?: string;
        currency?: string;
        quoteType?: string;
        isYahooFinance?: boolean;
      }>;
    };

    const quotes = result.quotes ?? [];
    return quotes
      .filter(
        (q) =>
          q.symbol &&
          (q.quoteType === "EQUITY" || q.quoteType === "ETF" || q.quoteType === "INDEX"),
      )
      .map<SearchMatch>((q) => {
        if (q.quoteType === "INDEX") {
          return {
            symbol: q.symbol!,
            name: q.longname ?? q.shortname ?? q.symbol!,
            exchange: "INDEX",
            currency: q.currency ?? null,
            isSupported: true,
            isIndex: true,
          };
        }
        const ex = normalizeYahooExchange(q.exchange);
        return {
          symbol: q.symbol!,
          name: q.longname ?? q.shortname ?? q.symbol!,
          exchange: ex.label,
          currency: q.currency ?? null,
          isSupported: ex.supported,
          isIndex: false,
        };
      });
  },

  async runScreen(id: ScreenId, opts) {
    const count = Math.min(Math.max(opts?.count ?? 25, 5), 50);
    const region = opts?.region ?? "US";

    if (region === "IN") {
      return runIndianScreen(id, count);
    }

    // yahoo-finance2's `PredefinedScreenerModules` union is incomplete (missing
    // `trending_now` and a few others Yahoo actually accepts). Cast scrIds
    // through any to bypass the lib's typing while still validating at our
    // ScreenId boundary.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await yahooFinance.screener({
      scrIds: id as any,
      count,
      region,
    })) as {
      quotes?: Array<{
        symbol?: string;
        shortName?: string;
        longName?: string;
        exchange?: string;
        currency?: string;
        quoteType?: string;
      }>;
    };
    const quotes = result.quotes ?? [];
    return quotes
      .filter((q) => q.symbol && (q.quoteType === "EQUITY" || q.quoteType === "ETF"))
      .map<SearchMatch>((q) => {
        const ex = normalizeYahooExchange(q.exchange);
        return {
          symbol: q.symbol!,
          name: q.longName ?? q.shortName ?? q.symbol!,
          exchange: ex.label,
          currency: q.currency ?? null,
          isSupported: ex.supported,
          isIndex: false,
        };
      });
  },

  async getMarketMovers(region, count = 5): Promise<MarketMovers> {
    if (region === "IN") {
      // Quote NIFTY 50 in one batch and rank by intraday % change.
      const symbols = NIFTY_50.map((n) => n.symbol);
      const quotes = (await yahooFinance.quote(symbols)) as RawQuote | RawQuote[];
      const list = Array.isArray(quotes) ? quotes : [quotes];
      const nameMap = new Map(NIFTY_50.map((n) => [n.symbol, n.name]));

      const enriched: MoverEntry[] = list
        .map((q) => {
          const price = Number(q.regularMarketPrice ?? 0);
          const changePct = Number(q.regularMarketChangePercent ?? 0);
          return {
            symbol: q.symbol,
            name: nameMap.get(q.symbol) ?? q.symbol,
            exchange: "NSE",
            currency: q.currency ?? "INR",
            price,
            changePct,
          };
        })
        .filter((e) => Number.isFinite(e.changePct) && e.price > 0);

      const sorted = [...enriched].sort((a, b) => b.changePct - a.changePct);
      return {
        gainers: sorted.slice(0, count),
        losers: [...sorted].reverse().slice(0, count),
      };
    }

    // US: Yahoo's predefined screens give us the matches; quote them in one
    // batch to fill in price + change %.
    const [gainerMatches, loserMatches] = await Promise.all([
      this.runScreen("day_gainers", { count, region: "US" }),
      this.runScreen("day_losers", { count, region: "US" }),
    ]);

    const allSymbols = Array.from(
      new Set([...gainerMatches, ...loserMatches].map((m) => m.symbol)),
    );
    const quotes = allSymbols.length
      ? ((await yahooFinance.quote(allSymbols)) as RawQuote | RawQuote[])
      : [];
    const list = Array.isArray(quotes) ? quotes : [quotes];
    const quoteBySym = new Map(list.map((q) => [q.symbol, q]));

    function hydrate(matches: SearchMatch[]): MoverEntry[] {
      return matches
        .map((m) => {
          const q = quoteBySym.get(m.symbol);
          const price = Number(q?.regularMarketPrice ?? 0);
          const changePct = Number(q?.regularMarketChangePercent ?? 0);
          return {
            symbol: m.symbol,
            name: m.name,
            exchange: m.exchange,
            currency: q?.currency ?? m.currency ?? "USD",
            price,
            changePct,
          };
        })
        .filter((e) => Number.isFinite(e.changePct) && e.price > 0);
    }

    return {
      gainers: hydrate(gainerMatches),
      losers: hydrate(loserMatches),
    };
  },

  async getInsights(symbol): Promise<NormalizedInsights | null> {
    type RawInsights = {
      recommendation?: { rating?: string; targetPrice?: number };
      instrumentInfo?: {
        keyTechnicals?: { support?: number; resistance?: number; stopLoss?: number };
        technicalEvents?: {
          shortTermOutlook?: { direction?: string; score?: number };
          intermediateTermOutlook?: { direction?: string; score?: number };
          longTermOutlook?: { direction?: string; score?: number };
        };
      };
      sigDevs?: Array<{ headline?: string; date?: Date }>;
    };
    const raw = (await yahooFinance.insights(symbol).catch(() => null)) as RawInsights | null;
    if (!raw) return null;

    const ratingRaw = raw.recommendation?.rating;
    const rating: "BUY" | "HOLD" | "SELL" | null =
      ratingRaw === "BUY" || ratingRaw === "HOLD" || ratingRaw === "SELL" ? ratingRaw : null;
    const tech = raw.instrumentInfo?.technicalEvents;

    return {
      recommendation: rating
        ? { rating, targetPrice: numOrNull(raw.recommendation?.targetPrice) }
        : null,
      outlooks: {
        short: normalizeOutlook(tech?.shortTermOutlook),
        intermediate: normalizeOutlook(tech?.intermediateTermOutlook),
        long: normalizeOutlook(tech?.longTermOutlook),
      },
      keyTechnicals: {
        support: numOrNull(raw.instrumentInfo?.keyTechnicals?.support),
        resistance: numOrNull(raw.instrumentInfo?.keyTechnicals?.resistance),
        stopLoss: numOrNull(raw.instrumentInfo?.keyTechnicals?.stopLoss),
      },
      headlines: (raw.sigDevs ?? [])
        .map((s) => s.headline)
        .filter((h): h is string => typeof h === "string" && h.length > 0)
        .slice(0, 20),
    };
  },

  async getEarningsDate(symbol): Promise<Date | null> {
    type CalendarEvents = {
      calendarEvents?: { earnings?: { earningsDate?: Date[] } };
    };
    const raw = (await yahooFinance
      .quoteSummary(symbol, { modules: ["calendarEvents"] })
      .catch(() => null)) as CalendarEvents | null;
    const dates = raw?.calendarEvents?.earnings?.earningsDate;
    if (!dates || dates.length === 0) return null;
    // Yahoo returns up to two dates (range); pick the first (earliest).
    const d = dates[0];
    return d instanceof Date ? d : new Date(d);
  },
};

function normalizeOutlook(
  out: { direction?: string; score?: number } | undefined,
): { direction: "Bullish" | "Bearish" | "Neutral"; score: number | null } | null {
  if (!out?.direction) return null;
  const dir =
    out.direction === "Bullish" || out.direction === "Bearish" || out.direction === "Neutral"
      ? out.direction
      : null;
  if (!dir) return null;
  return { direction: dir, score: numOrNull(out.score) };
}

/**
 * Indian counterpart to Yahoo's predefined screens. Yahoo's `region` param
 * doesn't filter the predefined screens server-side (they stay US-locked), so
 * for India we rank NIFTY 50 components by the signal that best matches each
 * screen's intent. The two fundamentals-based screens (`undervalued_large_caps`,
 * `growth_technology_stocks`) would need per-ticker quoteSummary fetches to
 * rank correctly — they're left empty here and the UI marks them US-only.
 */
async function runIndianScreen(id: ScreenId, count: number): Promise<SearchMatch[]> {
  // No clean NIFTY-50 ranking for these without N extra fundamentals fetches.
  if (id === "undervalued_large_caps" || id === "growth_technology_stocks") {
    return [];
  }

  const symbols = NIFTY_50.map((n) => n.symbol);
  const quotes = (await yahooFinance.quote(symbols)) as RawQuote | RawQuote[];
  const list = Array.isArray(quotes) ? quotes : [quotes];
  const nameMap = new Map(NIFTY_50.map((n) => [n.symbol, n.name]));

  type Ranked = {
    symbol: string;
    name: string;
    currency: string | null;
    volume: number;
    changePct: number;
    absChangePct: number;
  };

  const ranked: Ranked[] = list
    .map((q) => ({
      symbol: q.symbol,
      name: nameMap.get(q.symbol) ?? q.symbol,
      currency: q.currency ?? "INR",
      volume: Number(q.regularMarketVolume ?? 0),
      changePct: Number(q.regularMarketChangePercent ?? 0),
      absChangePct: Math.abs(Number(q.regularMarketChangePercent ?? 0)),
    }))
    .filter((r) => Number.isFinite(r.changePct));

  let sorted: Ranked[];
  switch (id) {
    case "most_actives":
      sorted = ranked.slice().sort((a, b) => b.volume - a.volume);
      break;
    case "day_gainers":
      sorted = ranked.slice().sort((a, b) => b.changePct - a.changePct);
      break;
    case "day_losers":
      sorted = ranked.slice().sort((a, b) => a.changePct - b.changePct);
      break;
    case "trending_now":
      // No "trending" feed for India; closest proxy is highest absolute move
      // (the names being talked about today).
      sorted = ranked.slice().sort((a, b) => b.absChangePct - a.absChangePct);
      break;
    default:
      sorted = ranked;
  }

  return sorted.slice(0, count).map<SearchMatch>((r) => ({
    symbol: r.symbol,
    name: r.name,
    exchange: "NSE",
    currency: r.currency,
    isSupported: true,
    isIndex: false,
  }));
}

/** Map Yahoo's cryptic exchange codes to a friendly label + whether it
 *  matches one of our supported `Exchange` enum values. */
function normalizeYahooExchange(code: string | undefined): { label: string; supported: boolean } {
  switch (code) {
    case "NMS":
    case "NCM":
    case "NGM":
      return { label: "NASDAQ", supported: true };
    case "NYQ":
      return { label: "NYSE", supported: true };
    case "ASE":
      return { label: "AMEX", supported: false };
    case "PCX":
      return { label: "NYSE Arca", supported: false };
    case "NSI":
      return { label: "NSE", supported: true };
    case "BSE":
    case "BOM":
      return { label: "BSE", supported: true };
    case "LSE":
      return { label: "LSE", supported: false };
    case "TOR":
      return { label: "TSX", supported: false };
    case "HKG":
      return { label: "HKEX", supported: false };
    case "FRA":
      return { label: "Frankfurt", supported: false };
    default:
      return { label: code ?? "—", supported: false };
  }
}

interface RawQuote {
  symbol: string;
  regularMarketPrice?: number | null;
  regularMarketChange?: number | null;
  regularMarketChangePercent?: number | null;
  regularMarketVolume?: number | null;
  marketState?: string | null;
  currency?: string | null;
}

function normalizeQuote(q: RawQuote): NormalizedQuote {
  return {
    symbol: q.symbol,
    price: Number(q.regularMarketPrice ?? 0),
    change: numOrNull(q.regularMarketChange),
    changePct: numOrNull(q.regularMarketChangePercent),
    volume: bigIntOrNull(q.regularMarketVolume),
    marketState: strOrNull(q.marketState),
    currency: strOrNull(q.currency) ?? "USD",
    fetchedAt: new Date(),
  };
}

/**
 * 5-year compound annual growth rate from a yearly time series.
 *
 *   Takes oldest → newest order. Returns null when there are fewer than two
 *   usable points or when the start/end are non-positive (CAGR undefined for
 *   sign flips). Result is in percent (e.g. 14 = 14%/yr).
 *
 *   We use whatever span we have — if Yahoo only returned 4 yearly points
 *   we compute 4-yr CAGR rather than refusing. Better signal than null.
 */
function computeYearlyCagr(series: Array<number | null>): number | null {
  const usable = series.filter((v): v is number => v != null && Number.isFinite(v));
  if (usable.length < 2) return null;
  const start = usable[0];
  const end = usable[usable.length - 1];
  if (start <= 0 || end <= 0) return null; // CAGR undefined for sign flips
  const years = usable.length - 1;
  const cagr = Math.pow(end / start, 1 / years) - 1;
  return cagr * 100;
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function bigIntOrNull(v: unknown): bigint | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  try {
    return BigInt(Math.trunc(n));
  } catch {
    return null;
  }
}
