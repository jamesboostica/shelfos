export const VAT_RATE = 0.16;

export function kes(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function amountOnly(amount: number): string {
  return amount.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** VAT is inclusive in shelf prices: extract the tax portion from a gross total. */
export function taxBreakdown(total: number) {
  const net = total / (1 + VAT_RATE);
  return { net, tax: total - net };
}

export function clockTime(d: Date = new Date()): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function dateTime(ts: number): string {
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function paymentLabel(m: string): string {
  return m === "cash" ? "Cash" : m === "mobile_money" ? "Mobile Money" : "Card";
}

export function startOfDay(d: Date = new Date()): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}
