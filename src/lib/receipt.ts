import { jsPDF } from "jspdf";
import { amountOnly, dateTime, paymentLabel, VAT_RATE } from "./format";

export interface ReceiptLine {
  product_name: string;
  sku?: string | undefined;
  quantity: number;
  unit_price: number;
}

export interface ReceiptData {
  local_id: string;
  created_at: number;
  cashier_id: string;
  items: ReceiptLine[];
  subtotal: number;
  tax: number;
  total: number;
  payment_method: string;
  tendered?: number | undefined;
  change?: number | undefined;
  reference?: string | undefined;
  is_split?: boolean | undefined;
  cash?: number | undefined;
  mobile_money?: number | undefined;
  card?: number | undefined;
  status?: string | undefined;
}

export const STORE_NAME = "ShelfOS Retail";
export const STORE_ADDRESS = "Household Goods · Nairobi, Kenya";
export const STORE_CONTACT = "Tel +254 700 000 000 · hello@shelfos.app";
export const RECEIPT_FOOTER =
  "Thank you for shopping with us! Household goods exchange within 48 hours with receipt.";

/** 80mm thermal roll; every field on the sale is printed and height grows to fit. */
export function receiptPdf(r: ReceiptData) {
  const width = 80;
  const left = 5;
  const right = width - 5;
  const usable = right - left;

  // First pass on a throwaway doc so we can size the page to the full content.
  const probe = new jsPDF({ unit: "mm", format: [width, 200] });
  probe.setFontSize(8);
  const nameLines = r.items.map(
    (i) => probe.splitTextToSize(i.product_name, usable - 2).length as number,
  );
  const itemsHeight = nameLines.reduce((s, n) => s + n * 3.6 + 5, 0);
  const footerLines = probe.splitTextToSize(RECEIPT_FOOTER, usable).length as number;
  const extraRows =
    (r.payment_method === "cash" && r.tendered != null ? 2 : 0) +
    (r.is_split ? 3 : 0) +
    (r.reference ? 1 : 0);
  const height = 96 + itemsHeight + extraRows * 5 + footerLines * 3.4;

  const doc = new jsPDF({ unit: "mm", format: [width, height] });
  let y = 9;

  const dashed = () => {
    doc.setLineDashPattern([1, 1], 0);
    doc.line(left, y, right, y);
    y += 4.5;
  };

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(STORE_NAME, width / 2, y, { align: "center" });
  y += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(STORE_ADDRESS, width / 2, y, { align: "center" });
  y += 3.4;
  doc.text(STORE_CONTACT, width / 2, y, { align: "center" });
  y += 3.4;
  doc.text("VAT No. P000000000X", width / 2, y, { align: "center" });
  y += 4.5;
  dashed();

  // Sale meta
  const meta = (label: string, value: string) => {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(label, left, y);
    doc.setFont("courier", "normal");
    doc.text(value, right, y, { align: "right" });
    y += 3.6;
  };
  meta("Receipt No.", r.local_id);
  meta("Date / Time", dateTime(r.created_at));
  meta("Served by", r.cashier_id);
  meta("Status", (r.status ?? "completed").toUpperCase());
  meta("Items / Units", `${r.items.length} / ${r.items.reduce((s, i) => s + i.quantity, 0)}`);
  y += 0.5;
  dashed();

  // Column headings
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("ITEM", left, y);
  doc.text("QTY x PRICE", left + 26, y);
  doc.text("AMOUNT", right, y, { align: "right" });
  y += 3.6;
  doc.setFont("helvetica", "normal");

  // Line items — full name wrapped, SKU, qty, unit price, line total
  for (const item of r.items) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    for (const line of doc.splitTextToSize(item.product_name, usable - 2) as string[]) {
      doc.text(line, left, y);
      y += 3.6;
    }
    doc.setFont("courier", "normal");
    doc.setFontSize(7.5);
    const qty = `${item.quantity} x ${amountOnly(item.unit_price)}`;
    doc.text(item.sku ? `${item.sku}  ${qty}` : qty, left + 1, y);
    doc.text(amountOnly(item.quantity * item.unit_price), right, y, { align: "right" });
    y += 5;
  }

  doc.setFont("helvetica", "normal");
  y -= 1;
  dashed();

  const row = (label: string, value: string, bold = false) => {
    doc.setFont(bold ? "helvetica" : "helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 11 : 8);
    doc.text(label, left, y);
    doc.setFont("courier", bold ? "bold" : "normal");
    doc.text(value, right, y, { align: "right" });
    y += bold ? 6.5 : 4.4;
  };

  row("Subtotal (excl. VAT)", `KES ${amountOnly(r.subtotal)}`);
  row(`VAT ${Math.round(VAT_RATE * 100)}% (inclusive)`, `KES ${amountOnly(r.tax)}`);
  row("TOTAL", `KES ${amountOnly(r.total)}`, true);
  row("Payment method", r.is_split ? "Split payment" : paymentLabel(r.payment_method));
  if (r.is_split) {
    if (r.cash) row("  Cash", `KES ${amountOnly(r.cash)}`);
    if (r.mobile_money) row("  Mobile Money", `KES ${amountOnly(r.mobile_money)}`);
    if (r.card) row("  Card", `KES ${amountOnly(r.card)}`);
  }
  if (r.payment_method === "cash" && r.tendered != null) {
    row("Cash tendered", `KES ${amountOnly(r.tendered)}`);
    row("Change due", `KES ${amountOnly(r.change ?? 0)}`);
  }
  if (r.reference) row("Reference", r.reference);

  y += 1;
  dashed();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.text(doc.splitTextToSize(RECEIPT_FOOTER, usable), width / 2, y, { align: "center" });
  y += footerLines * 3.2 + 2;
  doc.setFontSize(6.2);
  doc.text("Printed by ShelfOS · shelfos.lovable.app", width / 2, y, { align: "center" });

  doc.save(`shelfos-receipt-${r.local_id}.pdf`);
}

export function whatsappLink(r: ReceiptData): string {
  const lines = [
    `*${STORE_NAME}* receipt`,
    `Receipt ${r.local_id}`,
    dateTime(r.created_at),
    `Served by ${r.cashier_id}`,
    "",
    ...r.items.map(
      (i) =>
        `${i.quantity} x ${i.product_name}${i.sku ? ` (${i.sku})` : ""} @ ${amountOnly(i.unit_price)} = KES ${amountOnly(i.quantity * i.unit_price)}`,
    ),
    "",
    `Subtotal: KES ${amountOnly(r.subtotal)}`,
    `VAT ${Math.round(VAT_RATE * 100)}%: KES ${amountOnly(r.tax)}`,
    `TOTAL: KES ${amountOnly(r.total)}`,
    r.is_split
      ? `Split payment${r.cash ? ` · Cash KES ${amountOnly(r.cash)}` : ""}${r.mobile_money ? ` · Mobile Money KES ${amountOnly(r.mobile_money)}` : ""}${r.card ? ` · Card KES ${amountOnly(r.card)}` : ""}`
      : `Paid via ${paymentLabel(r.payment_method)}`,
    ...(r.payment_method === "cash" && r.tendered != null
      ? [`Cash tendered: KES ${amountOnly(r.tendered)}`, `Change: KES ${amountOnly(r.change ?? 0)}`]
      : []),
    ...(r.reference ? [`Reference: ${r.reference}`] : []),
    "",
    RECEIPT_FOOTER,
  ];
  return `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
}
