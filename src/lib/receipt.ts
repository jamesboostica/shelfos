import { jsPDF } from "jspdf";
import { amountOnly, dateTime, paymentLabel } from "./format";

export interface ReceiptLine {
  product_name: string;
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
}

export const STORE_NAME = "ShelfOS Retail";
export const RECEIPT_FOOTER =
  "Thank you for shopping with us! Household goods exchange within 48 hours with receipt.";

/** 80mm thermal roll, height grows with the line count. */
export function receiptPdf(r: ReceiptData) {
  const width = 80;
  const height = 90 + r.items.length * 9;
  const doc = new jsPDF({ unit: "mm", format: [width, height] });
  const left = 5;
  const right = width - 5;
  let y = 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(STORE_NAME, width / 2, y, { align: "center" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Household Goods . Nairobi, Kenya", width / 2, y, { align: "center" });
  y += 6;
  doc.setLineDashPattern([1, 1], 0);
  doc.line(left, y, right, y);
  y += 5;

  doc.setFontSize(8);
  doc.text(`Order: ${r.local_id}`, left, y);
  y += 4;
  doc.text(`Date: ${dateTime(r.created_at)}`, left, y);
  y += 4;
  doc.text(`Cashier: ${r.cashier_id}`, left, y);
  y += 4;
  doc.line(left, y, right, y);
  y += 5;

  doc.setFont("courier", "normal");
  for (const item of r.items) {
    doc.text(item.product_name.slice(0, 30), left, y);
    y += 4;
    doc.text(`${item.quantity} x ${amountOnly(item.unit_price)}`, left + 2, y);
    doc.text(amountOnly(item.quantity * item.unit_price), right, y, { align: "right" });
    y += 5;
  }

  doc.setFont("helvetica", "normal");
  doc.line(left, y, right, y);
  y += 5;
  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 11 : 9);
    doc.text(label, left, y);
    doc.text(value, right, y, { align: "right" });
    y += bold ? 7 : 5;
  };
  row("Subtotal (excl. VAT)", `KES ${amountOnly(r.subtotal)}`);
  row("VAT 16% (inclusive)", `KES ${amountOnly(r.tax)}`);
  row("TOTAL", `KES ${amountOnly(r.total)}`, true);
  row("Paid via", paymentLabel(r.payment_method));
  if (r.payment_method === "cash" && r.tendered != null) {
    row("Cash tendered", `KES ${amountOnly(r.tendered)}`);
    row("Change due", `KES ${amountOnly(r.change ?? 0)}`);
  }
  if (r.reference) row("Ref", r.reference);

  y += 2;
  doc.line(left, y, right, y);
  y += 5;
  doc.setFontSize(7);
  doc.text(doc.splitTextToSize(RECEIPT_FOOTER, right - left), width / 2, y, { align: "center" });

  doc.save(`shelfos-receipt-${r.local_id}.pdf`);
}

export function whatsappLink(r: ReceiptData): string {
  const lines = [
    `*${STORE_NAME}* receipt`,
    `Order ${r.local_id}`,
    dateTime(r.created_at),
    "",
    ...r.items.map((i) => `${i.quantity} x ${i.product_name} - KES ${amountOnly(i.quantity * i.unit_price)}`),
    "",
    `Subtotal: KES ${amountOnly(r.subtotal)}`,
    `VAT 16%: KES ${amountOnly(r.tax)}`,
    `TOTAL: KES ${amountOnly(r.total)}`,
    `Paid via ${paymentLabel(r.payment_method)}`,
    "",
    RECEIPT_FOOTER,
  ];
  return `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
}
