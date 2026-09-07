import { Download, Printer, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShelfMark } from "@/components/brand/Logo";
import { amountOnly, dateTime, kes, paymentLabel } from "@/lib/format";
import { RECEIPT_FOOTER, STORE_NAME, receiptPdf, whatsappLink, type ReceiptData } from "@/lib/receipt";

export function ReceiptModal({
  receipt,
  onClose,
}: {
  receipt: ReceiptData | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!receipt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sale complete</DialogTitle>
        </DialogHeader>

        {receipt && (
          <>
            <div
              id="thermal-receipt"
              className="mx-auto w-full max-w-[320px] rounded-lg border border-border bg-card p-4 text-card-foreground"
            >
              <div className="flex flex-col items-center gap-1 text-center">
                <ShelfMark mono className="h-10 w-10" />
                <p className="text-base font-bold tracking-tight">{STORE_NAME}</p>
                <p className="text-[11px] text-muted-foreground">Household Goods · Nairobi, Kenya</p>
              </div>

              <div className="my-3 border-t border-dashed border-border" />

              <div className="num space-y-0.5 text-[11px]">
                <div className="flex justify-between">
                  <span>Order</span>
                  <span>{receipt.local_id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date</span>
                  <span>{dateTime(receipt.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier</span>
                  <span>{receipt.cashier_id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Items / Units</span>
                  <span>
                    {receipt.items.length} / {receipt.items.reduce((s, i) => s + i.quantity, 0)}
                  </span>
                </div>
              </div>

              <div className="my-3 border-t border-dashed border-border" />

              <ul className="space-y-2 text-[12px]">
                {receipt.items.map((item) => (
                  <li key={item.product_name}>
                    <p className="font-medium leading-tight">{item.product_name}</p>
                    <div className="num flex justify-between text-[11px]">
                      <span>
                        {item.sku ? `${item.sku} · ` : ""}
                        {item.quantity} × {amountOnly(item.unit_price)}
                      </span>
                      <span>{amountOnly(item.quantity * item.unit_price)}</span>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="my-3 border-t border-dashed border-border" />

              <div className="num space-y-1 text-[12px]">
                <div className="flex justify-between">
                  <span>Subtotal (excl. VAT)</span>
                  <span>{amountOnly(receipt.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT 16% (inclusive)</span>
                  <span>{amountOnly(receipt.tax)}</span>
                </div>
                <div className="flex justify-between pt-1 text-base font-bold">
                  <span>TOTAL</span>
                  <span>{kes(receipt.total)}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span>Paid via</span>
                  <span>{paymentLabel(receipt.payment_method)}</span>
                </div>
                {receipt.payment_method === "cash" && receipt.tendered != null && (
                  <>
                    <div className="flex justify-between">
                      <span>Cash tendered</span>
                      <span>{amountOnly(receipt.tendered)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Change due</span>
                      <span>{amountOnly(receipt.change ?? 0)}</span>
                    </div>
                  </>
                )}
                {receipt.reference && (
                  <div className="flex justify-between">
                    <span>Ref</span>
                    <span>{receipt.reference}</span>
                  </div>
                )}
              </div>

              <div className="my-3 border-t border-dashed border-border" />
              <p className="text-center text-[10px] leading-snug text-muted-foreground">{RECEIPT_FOOTER}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <Button variant="outline" className="touch-target" onClick={() => receiptPdf(receipt)}>
                <Download className="mr-2 h-4 w-4" /> PDF
              </Button>
              <Button variant="outline" className="touch-target" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Print
              </Button>
              <Button variant="outline" className="touch-target" asChild>
                <a href={whatsappLink(receipt)} target="_blank" rel="noreferrer">
                  <Share2 className="mr-2 h-4 w-4" /> WhatsApp
                </a>
              </Button>
            </div>
            <Button className="touch-target w-full" onClick={onClose}>
              Next customer
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
