// FX options: Garman-Kohlhagen (Black-Scholes with a foreign interest rate).
//
// The underlying is 1 unit of foreign currency, quoted in SGD per unit.
// Rates here are CONTINUOUSLY compounded: convert simple rates with
// toContinuous() from rates.ts first.

/**
 * Standard normal CDF, N(x), by Hart's 1968 rational approximation (as
 * published by West, 2005), accurate to double precision (~1e-15).
 */
export function normCdf(x: number): number {
  const a = Math.abs(x);
  let tail: number; // N(-|x|)
  if (a > 37) {
    tail = 0;
  } else {
    const e = Math.exp((-a * a) / 2);
    if (a < 7.07106781186547) {
      let num = 3.52624965998911e-2 * a + 0.700383064443688;
      num = num * a + 6.37396220353165;
      num = num * a + 33.912866078383;
      num = num * a + 112.079291497871;
      num = num * a + 221.213596169931;
      num = num * a + 220.206867912376;
      let den = 8.83883476483184e-2 * a + 1.75566716318264;
      den = den * a + 16.064177579207;
      den = den * a + 86.7807322029461;
      den = den * a + 296.564248779674;
      den = den * a + 637.333633378831;
      den = den * a + 793.826512519948;
      den = den * a + 440.413735824752;
      tail = (e * num) / den;
    } else {
      let b = a + 0.65;
      b = a + 4 / b;
      b = a + 3 / b;
      b = a + 2 / b;
      b = a + 1 / b;
      tail = e / b / 2.506628274631;
    }
  }
  return x > 0 ? 1 - tail : tail;
}

/** Standard normal density, φ(x). */
export function normPdf(x: number): number {
  return Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
}

export type GkInputs = {
  S: number; // spot, SGD per foreign unit
  K: number; // strike, SGD per foreign unit
  rd: number; // SGD rate, continuous
  rf: number; // foreign rate, continuous
  sigma: number; // annualised volatility
  T: number; // years
};

function d1d2({ S, K, rd, rf, sigma, T }: GkInputs): [number, number] {
  if (!(S > 0 && K > 0 && sigma > 0 && T > 0)) {
    throw new Error("Garman-Kohlhagen needs S, K, sigma and T above zero");
  }
  const v = sigma * Math.sqrt(T);
  const d1 = (Math.log(S / K) + (rd - rf + (sigma * sigma) / 2) * T) / v;
  return [d1, d1 - v];
}

/**
 * Call on the foreign currency (the right to buy 1 unit at K SGD):
 *   C = S e^(−r_f T) N(d1) − K e^(−r_d T) N(d2)
 *   d1 = [ln(S/K) + (r_d − r_f + σ²/2) T] / (σ√T),  d2 = d1 − σ√T
 */
export function gkCall(p: GkInputs): number {
  const [d1, d2] = d1d2(p);
  return (
    p.S * Math.exp(-p.rf * p.T) * normCdf(d1) -
    p.K * Math.exp(-p.rd * p.T) * normCdf(d2)
  );
}

/** Put on the foreign currency (the right to sell 1 unit at K SGD). */
export function gkPut(p: GkInputs): number {
  const [d1, d2] = d1d2(p);
  return (
    p.K * Math.exp(-p.rd * p.T) * normCdf(-d2) -
    p.S * Math.exp(-p.rf * p.T) * normCdf(-d1)
  );
}

export type Greeks = {
  /** ∂C/∂S: SGD of option value per SGD move in spot. */
  delta: number;
  /** ∂²C/∂S². */
  gamma: number;
  /** ∂C/∂σ per 1.00 (100 percentage points) of volatility. */
  vega: number;
  /** ∂C/∂t per year of calendar time (negative: value decays). */
  theta: number;
};

/** Closed-form Greeks of the Garman-Kohlhagen call. */
export function gkCallGreeks(p: GkInputs): Greeks {
  const [d1, d2] = d1d2(p);
  const { S, K, rd, rf, sigma, T } = p;
  const dfF = Math.exp(-rf * T);
  const dfD = Math.exp(-rd * T);
  const sqrtT = Math.sqrt(T);
  const pdf = normPdf(d1);
  return {
    delta: dfF * normCdf(d1),
    gamma: (dfF * pdf) / (S * sigma * sqrtT),
    vega: S * dfF * pdf * sqrtT,
    theta:
      (-S * dfF * pdf * sigma) / (2 * sqrtT) +
      rf * S * dfF * normCdf(d1) -
      rd * K * dfD * normCdf(d2),
  };
}

/**
 * SGD cost of converting `amount` units on the deadline with a call bought
 * on day one: the premium, plus the cheaper of the market rate and the strike
 * (with spread) on the deadline. The premium's time value is ignored (it
 * would add premium × r_d × T, small next to the premium itself).
 */
export function optionHedgedCost(
  amount: number,
  premiumPerUnit: number,
  strike: number,
  rateAtDeadline: number,
  spread: number,
): number {
  return (
    amount * (premiumPerUnit + Math.min(rateAtDeadline, strike) * (1 + spread))
  );
}
