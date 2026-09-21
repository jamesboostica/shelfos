import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { purgeSalesData } from "@/lib/admin.functions";

const CONFIRM_WORD = "RESET";

/**
 * Manager-only "clean slate" utility. Clears every test sale, receipt, shift
 * and stock movement from this device and from the cloud, which resets all
 * report figures to zero. Products and stock counts are left untouched.
 */
export function ResetDataCard() {
  const purge = useServerFn(purgeSalesData);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (busy || confirm.trim().toUpperCase() !== CONFIRM_WORD) return;
    setBusy(true);
    try {
      let cloudNote = "";
      try {
        await purge({ data: undefined });
      } catch (err) {
        cloudNote =
          err instanceof Error && /manager/i.test(err.message)
            ? " Cloud copy was not cleared: manager account required."
            : " Cloud copy will be cleared on the next successful connection.";
      }

      const db = getDb();
      await db.transaction("rw", db.orders, db.order_items, db.shifts, db.sync_queue, async () => {
        await db.order_items.clear();
        await db.orders.clear();
        await db.shifts.clear();
        await db.sync_queue.clear();
      });

      setConfirm("");
      toast.success("Sales data cleared — reports are back to zero." + cloudNote);
    } catch (err) {
      toast.error("Could not clear the data", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-danger/40 bg-card p-4 shadow-card">
      <h2 className="flex items-center gap-2 font-bold text-danger">
        <AlertTriangle className="h-4 w-4" /> Start selling from a clean slate
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Deletes every test sale, receipt, shift and stock movement, and resets all report figures to
        zero. Your products, prices and stock counts stay exactly as they are. This cannot be undone.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={`Type ${CONFIRM_WORD} to confirm`}
          className="h-11 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <Button
          variant="destructive"
          className="touch-target"
          disabled={busy || confirm.trim().toUpperCase() !== CONFIRM_WORD}
          onClick={() => void run()}
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Clear all sales data
        </Button>
      </div>
    </div>
  );
}
