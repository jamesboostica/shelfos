import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Manager-only utility: wipes staging/test sales so the store can start selling
 * from a clean slate. Removes cloud orders, order lines, shifts and stock
 * adjustments for the signed-in account. Products and stock counts are kept.
 */
export const purgeSalesData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isManager, error: roleError } = await supabase.rpc("is_manager", {
      _user_id: userId,
    });
    if (roleError) throw new Error(roleError.message);
    if (!isManager) throw new Error("Only a manager can reset sales data.");

    const tables = ["order_items", "orders", "shifts", "stock_adjustments"] as const;
    const removed: Record<string, number> = {};

    for (const table of tables) {
      const { error, count } = await supabase
        .from(table)
        .delete({ count: "exact" })
        .eq("user_id", userId);
      if (error) throw new Error(`${table}: ${error.message}`);
      removed[table] = count ?? 0;
    }

    return { ok: true, removed };
  });
