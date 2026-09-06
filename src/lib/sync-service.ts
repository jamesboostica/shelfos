import { getDb, type SyncQueueRow } from "./db";

/**
 * ShelfOS sync engine.
 *
 * Orders are always written locally first. This module drains the local
 * sync queue whenever the device is online. There is no cloud backend wired
 * up yet, so the push step is simulated locally — swap `pushEntity` for a real
 * API call and the rest of the engine keeps working unchanged.
 */

const MAX_RETRIES = 5;

async function pushEntity(row: SyncQueueRow): Promise<void> {
  // Simulated network round-trip. Replace with a real request when a
  // backend is connected; a thrown error is treated as a failed attempt.
  await new Promise((resolve) => setTimeout(resolve, 350));
  if (!navigator.onLine) throw new Error("offline");
}

export interface SyncResult {
  pushed: number;
  failed: number;
}

let running = false;

export async function drainSyncQueue(
  onProgress?: (remaining: number) => void,
): Promise<SyncResult> {
  if (running || !navigator.onLine) return { pushed: 0, failed: 0 };
  running = true;
  const db = getDb();
  let pushed = 0;
  let failed = 0;

  try {
    const queue = (await db.sync_queue.where("status").equals("pending").toArray()).sort(
      (a, b) => a.timestamp - b.timestamp,
    );

    for (let i = 0; i < queue.length; i += 1) {
      const row = queue[i]!;
      onProgress?.(queue.length - i);
      try {
        await pushEntity(row);
        if (row.entity_type === "order" && row.entity_id) {
          const order = await db.orders.where("local_id").equals(row.entity_id).first();
          if (order?.id) await db.orders.update(order.id, { synced: 1 });
        }
        if (row.id) await db.sync_queue.delete(row.id);
        pushed += 1;
      } catch {
        const retries = (row.retry_count ?? 0) + 1;
        if (row.id) {
          await db.sync_queue.update(row.id, {
            retry_count: retries,
            ...(retries >= MAX_RETRIES ? { status: "failed" as const } : {}),
          });
        }
        failed += 1;
        break; // stop the pass; the heartbeat will retry
      }
    }
  } finally {
    running = false;
    onProgress?.(0);
  }

  return { pushed, failed };
}

/** Placeholder for pulling manager-desk price/stock updates into Dexie. */
export async function pullRemoteProducts(): Promise<number> {
  return 0;
}
