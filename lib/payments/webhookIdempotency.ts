import { getDb, newId, withDbLock } from "@/lib/db/store";
import type { ProcessedWebhookEvent } from "@/lib/db/types";

function eventKey(source: ProcessedWebhookEvent["source"], eventId: string) {
  return `${source}:${eventId}`;
}

export function isWebhookEventProcessed(
  source: ProcessedWebhookEvent["source"],
  eventId: string
): boolean {
  return Boolean(getDb().processedWebhookEvents[eventKey(source, eventId)]);
}

export async function recordWebhookEvent(input: {
  source: ProcessedWebhookEvent["source"];
  eventId: string;
  orderId?: string;
}): Promise<boolean> {
  return withDbLock((db) => {
    const key = eventKey(input.source, input.eventId);
    if (db.processedWebhookEvents[key]) return false;
    db.processedWebhookEvents[key] = {
      id: newId("whe"),
      source: input.source,
      eventId: input.eventId,
      orderId: input.orderId,
      processedAt: Date.now(),
    };
    return true;
  });
}
