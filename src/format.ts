export const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const oneDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
export const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function moneyMillions(value: number) {
  return `$${(value / 1_000_000).toFixed(2)}m`;
}

export function lcoe(value: number) {
  return `$${oneDecimal.format(value)}/MWh`;
}

export function pct(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}
