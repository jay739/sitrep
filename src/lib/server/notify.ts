import { env } from "$env/dynamic/private";

// Telegram is optional: both env vars must be set or this is a no-op.
// Failures are logged and never surface to the admin action that triggered
// them; a broken notifier must not block incident publishing.
export async function notifyTelegram(text: string): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) {
      console.error(`telegram notify failed with status ${res.status}`);
    }
  } catch (err) {
    console.error("telegram notify failed", err);
  }
}

export function incidentMessage(
  kind: "opened" | "updated",
  title: string,
  status: string,
  severity: string,
  body: string,
): string {
  const head =
    kind === "opened"
      ? `New incident (${severity}): ${title}`
      : `Incident update: ${title}`;
  return `${head}\nStatus: ${status}\n\n${body.slice(0, 1000)}`;
}
