/**
 * News sentiment scorer using the Loughran-McDonald financial sentiment
 * lexicon (subset).
 *
 *   The Loughran-McDonald dictionaries (Notre Dame, 2011) are the
 *   standard for financial sentiment because they correct general-purpose
 *   lexicons that mislabel finance terms — e.g. "liability" is negative in
 *   a general lexicon but neutral / contractual in finance, "tax" is not
 *   negative in finance, etc.
 *
 *   We use a curated subset (~250 words) of the Negative and Positive lists,
 *   the words most likely to appear in news headlines. Full L-M is ~3,500
 *   words — overkill for headline scoring and bloats the bundle.
 *
 *   Output is a normalized polarity in [-1, +1]:
 *     polarity = (positive - negative) / (positive + negative + 1)
 *     (the +1 in the denominator avoids division-by-zero and damps tiny samples)
 *
 *   Headlines are tokenised on whitespace + punctuation, lowercased, and
 *   matched against the lexicon. Multi-word phrases like "going concern"
 *   aren't supported — would require an n-gram pass; not worth the complexity
 *   for headline-only scoring.
 */

const POSITIVE = new Set<string>([
  // Growth / improvement
  "achieve", "achieved", "achievement", "advance", "advances", "advancing",
  "beat", "beats", "beating", "beneficial", "benefit", "benefits", "best",
  "better", "boost", "boosted", "boosting", "breakthrough", "bullish",
  "constructive", "deliver", "delivered", "delivers", "delivering",
  "encouraging", "enhanced", "exceed", "exceeds", "exceeded", "exceeding",
  "expand", "expanded", "expanding", "expansion", "favorable", "favourable",
  "gain", "gained", "gains", "gaining", "good", "great", "greatest",
  "grow", "grew", "growing", "growth", "high", "higher", "highest",
  "improve", "improved", "improvement", "improvements", "improving",
  "increase", "increased", "increases", "increasing", "innovat", "innovate",
  "innovation", "innovative", "leading", "lift", "lifted", "lifting",
  "milestone", "momentum", "outperform", "outperformed", "outperforming",
  "outperformer", "outperforms", "positive", "positively", "premium",
  "profit", "profitable", "profitability", "profits", "progress",
  "progressing", "raise", "raised", "raises", "raising", "rally",
  "rallied", "rallies", "rebound", "rebounded", "rebounding", "record",
  "robust", "rose", "soar", "soared", "soaring", "solid", "stellar",
  "strength", "strengthen", "strengthened", "strengthening", "strong",
  "stronger", "strongest", "succeed", "succeeded", "success", "successful",
  "successfully", "surge", "surged", "surges", "surging", "surpass",
  "surpassed", "surpasses", "surpassing", "thrive", "thrived", "thriving",
  "top", "tops", "topped", "topping", "transform", "transformed",
  "transforming", "triumph", "uplift", "upbeat", "upgrade", "upgraded",
  "upgrading", "upgrades", "upside", "upturn", "upward", "upwards", "win",
  "winning", "wins", "won",
]);

const NEGATIVE = new Set<string>([
  // Loss / decline
  "abandon", "abandoned", "abandoning", "adverse", "adversely", "alarm",
  "bad", "bankrupt", "bankruptcy", "bear", "bearish", "below", "breach",
  "breached", "breaches", "burden", "challenge", "challenged", "challenges",
  "challenging", "collapse", "collapsed", "collapses", "collapsing",
  "concern", "concerned", "concerns", "concerning", "contract", "contracted",
  "contracting", "crash", "crashed", "crashing", "crisis", "criticism",
  "criticize", "criticized", "criticizing", "cut", "cuts", "cutting",
  "damage", "damaged", "damages", "damaging", "danger", "decline",
  "declined", "declines", "declining", "decrease", "decreased", "decreases",
  "decreasing", "default", "defaulted", "defaults", "deficit", "delay",
  "delayed", "delaying", "delays", "deteriorate", "deteriorated",
  "deteriorating", "difficult", "difficulty", "diminish", "diminished",
  "diminishing", "disappoint", "disappointed", "disappointing", "disaster",
  "disastrous", "discontinue", "discontinued", "dispute", "downgrade",
  "downgraded", "downgrades", "downgrading", "downside", "downturn",
  "drag", "dragged", "dragging", "drop", "dropped", "dropping", "drops",
  "fail", "failed", "failing", "fails", "failure", "fall", "fallen",
  "falling", "falls", "fell", "fraud", "fraudulent", "halt", "halted",
  "harm", "harmed", "harmful", "harming", "hit", "hurt", "hurting",
  "impair", "impaired", "impairment", "impede", "impeding", "investigate",
  "investigated", "investigation", "investigations", "lawsuit", "lawsuits",
  "lay", "layoff", "layoffs", "lays", "loss", "losses", "lost", "low",
  "lower", "lowered", "lowering", "lowest", "miss", "missed", "misses",
  "missing", "negative", "negatively", "obstacle", "panic", "penalty",
  "plunge", "plunged", "plunges", "plunging", "poor", "pressure",
  "pressured", "pressures", "pressuring", "probe", "probes", "problem",
  "problems", "recall", "recalled", "recalling", "recession", "reduce",
  "reduced", "reduces", "reducing", "reduction", "reductions", "reject",
  "rejected", "rejecting", "rejection", "resign", "resigned", "resigning",
  "resignation", "restate", "restated", "restating", "restrict",
  "restricted", "restricting", "restriction", "restrictions", "restructure",
  "restructured", "restructuring", "scandal", "selloff", "settle", "settled",
  "settles", "settling", "settlement", "settlements", "shortfall",
  "shortfalls", "shrink", "shrinking", "shrunk", "slip", "slipped",
  "slipping", "slips", "slow", "slowdown", "slowed", "slower", "slowing",
  "slumped", "slumping", "slumps", "stagnant", "strain", "strained",
  "stress", "stressed", "struggle", "struggled", "struggles", "struggling",
  "sue", "sued", "suit", "suits", "suspended", "suspicious", "terminate",
  "terminated", "terminating", "termination", "tumble", "tumbled",
  "tumbles", "tumbling", "underperform", "underperformed", "underperformer",
  "underperforming", "unprofitable", "violate", "violated", "violation",
  "violations", "vulnerable", "warn", "warned", "warning", "warns", "weak",
  "weakened", "weakening", "weaker", "weakest", "weakness", "worse",
  "worsen", "worsened", "worsening", "worst", "wrongdoing",
]);

export interface SentimentScore {
  /** -1 (strongly negative) to +1 (strongly positive). 0 = neutral / no match. */
  polarity: number;
  /** Number of headlines analysed. */
  headlineCount: number;
  /** Total positive word matches across all headlines. */
  positiveHits: number;
  /** Total negative word matches. */
  negativeHits: number;
  /** Top scoring headlines (most polarised) for the UI. */
  topHeadlines: Array<{ headline: string; polarity: number }>;
}

export function scoreSentiment(headlines: string[]): SentimentScore {
  if (headlines.length === 0) {
    return { polarity: 0, headlineCount: 0, positiveHits: 0, negativeHits: 0, topHeadlines: [] };
  }

  let totalPos = 0;
  let totalNeg = 0;
  const scored: Array<{ headline: string; polarity: number }> = [];

  for (const headline of headlines) {
    const tokens = tokenize(headline);
    let pos = 0;
    let neg = 0;
    for (const t of tokens) {
      if (POSITIVE.has(t)) pos++;
      else if (NEGATIVE.has(t)) neg++;
    }
    totalPos += pos;
    totalNeg += neg;
    const polarity = pos + neg > 0 ? (pos - neg) / (pos + neg) : 0;
    scored.push({ headline, polarity });
  }

  const polarity = (totalPos - totalNeg) / (totalPos + totalNeg + 1);

  // Top by absolute polarity, prefer non-zero scorers.
  scored.sort((a, b) => Math.abs(b.polarity) - Math.abs(a.polarity));
  const topHeadlines = scored.filter((s) => Math.abs(s.polarity) > 0).slice(0, 5);

  return {
    polarity,
    headlineCount: headlines.length,
    positiveHits: totalPos,
    negativeHits: totalNeg,
    topHeadlines,
  };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z']+/)
    .filter((t) => t.length > 2);
}
