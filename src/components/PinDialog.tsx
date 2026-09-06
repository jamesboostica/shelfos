import { useState } from "react";
import { Delete, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MANAGER_PIN } from "@/lib/shelfos-store";
import { cn } from "@/lib/utils";

export function PinDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const press = (digit: string) => {
    setError(false);
    const next = (pin + digit).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      if (next === MANAGER_PIN) {
        setPin("");
        onOpenChange(false);
        onSuccess();
      } else {
        setError(true);
        setTimeout(() => setPin(""), 350);
      }
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setPin("");
        setError(false);
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand" /> Manager access
          </DialogTitle>
          <DialogDescription>Enter the 4-digit supervisor PIN to unlock cost prices, margins and reports.</DialogDescription>
        </DialogHeader>

        <div className="flex justify-center gap-3 py-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "h-12 w-10 rounded-lg border-2 bg-secondary",
                error ? "border-danger" : pin.length > i ? "border-brand" : "border-border",
                "flex items-center justify-center",
              )}
            >
              <span className="num text-2xl leading-none">{pin.length > i ? "•" : ""}</span>
            </div>
          ))}
        </div>
        {error && <p className="text-center text-sm font-medium text-danger">Incorrect PIN. Try again.</p>}

        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <Button key={d} variant="outline" className="touch-target num h-14 text-xl" onClick={() => press(d)}>
              {d}
            </Button>
          ))}
          <Button variant="ghost" className="touch-target h-14" onClick={() => setPin("")}>
            Clear
          </Button>
          <Button variant="outline" className="touch-target num h-14 text-xl" onClick={() => press("0")}>
            0
          </Button>
          <Button variant="ghost" className="touch-target h-14" onClick={() => setPin(pin.slice(0, -1))}>
            <Delete className="h-5 w-5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
