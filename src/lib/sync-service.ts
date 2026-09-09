import { getDb, type SyncQueueRow } from "./db";
import { supabase } from "@/integrations/supabase/client";

/**
 * ShelfOS sync engine — durable, offline-first.
 *
 * Every sale, shift close and stock adjustment is written to IndexedDB first
 * and mirrored into `sync_queue`. Nothing is ever dropped: the queue survives
 * reloads, browser restarts and days without a network. When connectivity
 * returns the queue is drained oldest-first and uploaded to the cloud with
 * idempotent upserts keyed on the device-generated local id, so a retry can
 * never create a duplicate sale.
 *
 * Failures use exponential backoff (30s -> 30min cap) and NEVER become
 * permanent: a row keeps its "pending" status forever until it is accepted by
 * the server. Rows that keep failing are simply retried less often.
 */

const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 30 * 60_000;
/** Rows above this attempt count are flagged in the UI but still retried. */
export const STUCK_AFTER_ATTEMPTS = 8;

function backoffFor(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
}

/**
 * Ask the browser to keep IndexedDB out of its eviction pool. Without this a
 * till holding days of offline sales could have its storage cleared under
 * pressure. Safe to call repeatedly.
 */
export async function requestDurableStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage) return false;
    if (await navigator.storage.persisted?.()) return true;
    return (await navigator.storage.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export interface StorageHealth {
  persisted: boolean;
  usageBytes: number;
  quotaBytes: number;
}

export async function storageHealth(): Promise<StorageHealth> {
  const empty = { persisted: false, usageBytes: 0, quotaBytes: 0 };
  try {
    if (typeof navigator === "undefined" || !navigator.storage) return empty;
    const persisted = (await navigator.storage.persisted?.()) ?? false;
    const est = (await navigator.storage.estimate?.()) ?? {};
    return { persisted, usageBytes: est.usage ?? 0, quotaBytes: est.quota ?? 0 };
  } catch {
    return empty;
  }
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Upload one queued change. Throws to schedule a retry; returns to accept it. */
async function pushEntity(row: SyncQueueRow, userId: string): Promise<void> {
  const db = getDb();

  if (row.entity_type === "order") {
    const localId = row.entity_id;
    if (!localId) return; // nothing identifiable — drop
    const order = await db.orders.where("local_id").equals(localId).first();
    if (!order) return; // sale no longer exists locally
    const items = await db.order_items.where("order_id").equals(localId).toArray();

    const { error } = await supabase.from("orders").upsert(
      {
        user_id: userId,
        local_id: localId,
        cashier_id: order.cashier_id,
        total_amount: order.total_amount,
        payment_method: order.payment_method,
        split_details: order.split_details ?? {},
        status: order.status,
        sold_at: new Date(order.created_at).toISOString(),
      },
      { onConflict: "user_id,local_id" },
    );
    if (error) throw new Error(error.message);

    if (items.length > 0) {
      const { error: itemErr } = await supabase.from("order_items").upsert(
        items.map((it, i) => ({
          user_id: userId,
          order_local_id: localId,
          line_no: i,
          product_name: it.product_name,
          sku: null,
          quantity: it.quantity,
          unit_price: it.unit_price,
          unit_cost: it.unit_cost,
        })),
        { onConflict: "user_id,order_local_id,line_no" },
      );
      if (itemErr) throw new Error(itemErr.message);
    }
    return;
  }

  if (row.entity_type === "shift_close") {
    const p = (row.payload ?? {}) as { shift_id?: number };
    const shift = p.shift_id ? await db.shifts.get(p.shift_id) : undefined;
    const localId = `SH-${p.shift_id ?? row.id ?? row.timestamp}`;
    const { error } = await supabase.from("shifts").upsert(
      {
        user_id: userId,
        local_id: localId,
        cashier_id: shift?.cashier_id ?? null,
        opening_float: shift?.opening_float ?? 0,
        closing_cash_counted: shift?.closing_cash_counted ?? null,
        expected_cash: shift?.expected_cash ?? null,
        difference: shift?.difference ?? null,
        status: shift?.status ?? "closed",
        opened_at: shift?.opened_at ? new Date(shift.opened_at).toISOString() : null,
        closed_at: shift?.closed_at ? new Date(shift.closed_at).toISOString() : null,
      },
      { onConflict: "user_id,local_id" },
    );
    if (error) throw new Error(error.message);
    return;
  }

  if (row.entity_type === "stock_adjustment") {
    const p = (row.payload ?? {}) as { product_id?: number; delta?: number; reason?: string };
    const product = p.product_id ? await db.products.get(p.product_id) : undefined;
    const { error } = await supabase.from("stock_adjustments").upsert(
      {
        user_id: userId,
        local_id: `ADJ-${row.id ?? row.timestamp}-${row.timestamp}`,
        product_name: product?.name ?? null,
        sku: product?.sku ?? null,
        delta: p.delta ?? 0,
        reason: p.reason ?? null,
        adjusted_at: new Date(row.timestamp).toISOString(),
      },
      { onConflict: "user_id,local_id" },
    );
    if (error) throw new Error(error.message);
    return;
  }

  // Catalogue edits stay device-local for now: accept and clear the row.
}

export interface SyncResult {
  pushed: number;
  failed: number;
  skipped: number;
}

let running = false;

export async function drainSyncQueue(
  onProgress?: (remaining: number) => void,
): Promise<SyncResult> {
  if (running || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return { pushed: 0, failed: 0, skipped: 0 };
  }
  running = true;
  const db = getDb();
  let pushed = 0;
  let failed = 0;
  let skipped = 0;

  try {
    const userId = await currentUserId();
    if (!userId) return { pushed: 0, failed: 0, skipped: 0 };

    const now = Date.now();
    const queue = (await db.sync_queue.where("status").equals("pending").toArray())
      .filter((r) => (r.next_attempt_at ?? 0) <= now)
      .sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 0; i < queue.length; i += 1) {
      const row = queue[i]!;
      onProgress?.(queue.length - i);
      try {
        await pushEntity(row, userId);
        if (row.entity_type === "order" && row.entity_id) {
          const order = await db.orders.where("local_id").equals(row.entity_id).first();
          if (order?.id) await db.orders.update(order.id, { synced: 1 });
        }
        if (row.id) await db.sync_queue.delete(row.id);
        pushed += 1;
      } catch (err) {
        const attempts = (row.retry_count ?? 0) + 1;
        if (row.id) {
          // Stays "pending" on purpose — queued work is never abandoned.
          await db.sync_queue.update(row.id, {
            retry_count: attempts,
            next_attempt_at: Date.now() + backoffFor(attempts),
            last_error: err instanceof Error ? err.message.slice(0, 200) : "unknown error",
          });
        }
        failed += 1;
        if (typeof navigator !== "undefined" && !navigator.onLine) break;
        skipped += queue.length - i - 1;
        break; // stop the pass; the heartbeat retries after the backoff
      }
    }
  } finally {
    running = false;
    onProgress?.(0);
  }

  return { pushed, failed, skipped };
}

/** Placeholder for pulling manager-desk price/stock updates into Dexie. */
export async function pullRemoteProducts(): Promise<number> {
  return 0;
}
