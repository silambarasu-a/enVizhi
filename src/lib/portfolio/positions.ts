/**
 * Portfolio cost-basis math, expressed as pure functions.
 *
 *   FIFO accounting — earliest BUY lot is consumed first when a SELL fires.
 *   Fees are amortized into per-share cost on BUY, and subtracted from
 *   proceeds on SELL.
 *
 * Multi-currency note: this v1 keeps everything in the *transaction's* native
 * currency. Conversion to portfolio base currency happens in `value.ts` at
 * display time, using current FX (a simplification — proper TWR needs FX at
 * each transaction's date, which we'll add when Phase 5.5 lands snapshots).
 */

export interface PortfolioTxn {
  id: string;
  stockId: string;
  type: "BUY" | "SELL";
  quantity: number;
  price: number;
  fees: number;
  executedAt: Date;
}

/** One open BUY lot still on the books — consumed FIFO by future SELLs. */
export interface OpenLot {
  qty: number;
  /** Per-share cost including pro-rated buy fees. */
  costPerShare: number;
  date: Date;
}

export interface Position {
  stockId: string;
  /** Sum of open-lot quantities (current shares held). */
  quantity: number;
  /** Weighted-average cost per share across all open lots. */
  avgCost: number;
  /** Sum of open-lot cost (qty × costPerShare). */
  costBasis: number;
  /** Cumulative realized P&L from all SELLs against this stock, in trade currency. */
  realizedPnL: number;
  /** Open lots — kept so the UI can show acquisition dates. */
  lots: OpenLot[];
}

export interface PositionsResult {
  /** Map from stockId to position. Stocks with quantity = 0 (fully sold) are omitted. */
  positions: Map<string, Position>;
  /** Cumulative realized P&L across all stocks. */
  totalRealizedPnL: number;
}

/**
 * Reduce a list of transactions (across one or more stocks) into per-stock
 * positions. Transactions for different stocks are processed independently;
 * within each stock, FIFO order by executedAt.
 *
 * SELL beyond available quantity is silently capped (no negative inventory).
 * This matches Robinhood-style "you can't sell what you don't have" UX. We
 * also reject negative results in `addTransaction()` server action so this
 * is mostly a defensive guarantee.
 */
export function computePositions(transactions: PortfolioTxn[]): PositionsResult {
  // Bucket by stockId, then sort each bucket by executedAt asc.
  const byStock = new Map<string, PortfolioTxn[]>();
  for (const t of transactions) {
    const arr = byStock.get(t.stockId) ?? [];
    arr.push(t);
    byStock.set(t.stockId, arr);
  }
  for (const arr of byStock.values()) {
    arr.sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime());
  }

  const positions = new Map<string, Position>();
  let totalRealized = 0;

  for (const [stockId, txns] of byStock) {
    const lots: OpenLot[] = [];
    let realized = 0;

    for (const t of txns) {
      if (t.type === "BUY") {
        if (t.quantity <= 0) continue;
        // Amortize fees into per-share cost.
        const costPerShare = t.price + t.fees / t.quantity;
        lots.push({ qty: t.quantity, costPerShare, date: t.executedAt });
      } else {
        // SELL: consume FIFO until quantity satisfied (or lots exhausted).
        let remaining = t.quantity;
        let consumedCost = 0;
        while (remaining > 0 && lots.length > 0) {
          const lot = lots[0]!;
          const take = Math.min(lot.qty, remaining);
          consumedCost += take * lot.costPerShare;
          lot.qty -= take;
          remaining -= take;
          if (lot.qty <= 1e-9) lots.shift();
        }
        const proceedsQty = t.quantity - remaining;
        const proceeds = proceedsQty * t.price - t.fees;
        realized += proceeds - consumedCost;
      }
    }

    const quantity = lots.reduce((s, l) => s + l.qty, 0);
    const costBasis = lots.reduce((s, l) => s + l.qty * l.costPerShare, 0);
    const avgCost = quantity > 0 ? costBasis / quantity : 0;

    totalRealized += realized;

    if (quantity > 1e-9 || realized !== 0) {
      positions.set(stockId, {
        stockId,
        quantity,
        avgCost,
        costBasis,
        realizedPnL: realized,
        lots,
      });
    }
  }

  return { positions, totalRealizedPnL: totalRealized };
}

/**
 * Unrealized P&L for a position given the current price (in trade currency).
 *   marketValue = quantity × currentPrice
 *   unrealized  = marketValue − costBasis
 */
export function unrealizedPnL(
  position: Pick<Position, "quantity" | "costBasis">,
  currentPrice: number,
): { marketValue: number; unrealized: number; unrealizedPct: number } {
  const marketValue = position.quantity * currentPrice;
  const unrealized = marketValue - position.costBasis;
  const unrealizedPct = position.costBasis > 0 ? (unrealized / position.costBasis) * 100 : 0;
  return { marketValue, unrealized, unrealizedPct };
}
