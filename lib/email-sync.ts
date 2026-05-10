import { supabase } from "@/lib/supabase";
import { fetchEmailsForArchive, getValidMsToken, type GraphMessage } from "@/lib/microsoft";

export type EmailSyncResult =
  | { ok: true; inbox: number; sent: number }
  | { ok: false; error: string };

interface Recipient { name: string | null; email: string | null; type: "to" | "cc" }

function mapRecipients(m: GraphMessage): Recipient[] {
  const out: Recipient[] = [];
  for (const r of m.toRecipients || []) {
    out.push({ name: r.emailAddress?.name ?? null, email: r.emailAddress?.address ?? null, type: "to" });
  }
  for (const r of m.ccRecipients || []) {
    out.push({ name: r.emailAddress?.name ?? null, email: r.emailAddress?.address ?? null, type: "cc" });
  }
  return out;
}

function toRow(m: GraphMessage, direction: "received" | "sent") {
  const date_at = direction === "received" ? m.receivedDateTime : m.sentDateTime;
  return {
    id: m.id,
    direction,
    conversation_id: m.conversationId ?? null,
    subject: m.subject ?? null,
    body_text: m.body?.content ?? null,
    body_preview: m.bodyPreview ?? null,
    sender_name: m.from?.emailAddress?.name ?? (direction === "sent" ? "You" : null),
    sender_email: m.from?.emailAddress?.address ?? null,
    recipients: mapRecipients(m),
    is_read: m.isRead ?? null,
    importance: m.importance ?? null,
    has_attachments: m.hasAttachments ?? null,
    date_at,
    raw: m,
  };
}

export async function syncEmails(sinceIso: string): Promise<EmailSyncResult> {
  const token = await getValidMsToken();
  if (!token) return { ok: false, error: "not_authenticated" };

  const [inbox, sent] = await Promise.all([
    fetchEmailsForArchive(token, sinceIso, "inbox"),
    fetchEmailsForArchive(token, sinceIso, "sent"),
  ]);

  const rows = [
    ...inbox.map((m) => toRow(m, "received")),
    ...sent.map((m) => toRow(m, "sent")),
  ].filter((r) => r.id && r.date_at);

  if (rows.length) {
    // Chunk to avoid request size limits on large backfills
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error } = await supabase.from("emails").upsert(slice, { onConflict: "id" });
      if (error) {
        console.error("[email-sync] upsert error:", error);
        return { ok: false, error: error.message };
      }
    }
  }

  return { ok: true, inbox: inbox.length, sent: sent.length };
}
