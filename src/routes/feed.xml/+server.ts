import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { config } from "$lib/server/config";
import { escapeHtml } from "$lib/server/markdown";

type FeedRow = {
  id: number;
  title: string;
  severity: string;
  status: string;
  created_at: number;
  last_update_at: number | null;
  last_body: string | null;
};

export const GET: RequestHandler = ({ url }) => {
  let rows: FeedRow[] = [];
  try {
    rows = db
      .prepare(
        `SELECT i.id, i.title, i.severity, i.status, i.created_at,
				        (SELECT MAX(u.created_at) FROM incident_updates u WHERE u.incident_id = i.id) AS last_update_at,
				        (SELECT u.body FROM incident_updates u WHERE u.incident_id = i.id
				         ORDER BY u.created_at DESC, u.id DESC LIMIT 1) AS last_body
				 FROM incidents i ORDER BY i.created_at DESC LIMIT 30`,
      )
      .all() as unknown as FeedRow[];
  } catch (err) {
    console.error("feed query failed", err);
    return new Response("feed unavailable", { status: 503 });
  }

  const site = escapeHtml(config.siteName);
  const origin = url.origin;

  const items = rows
    .map((row) => {
      const updated = row.last_update_at ?? row.created_at;
      const title = escapeHtml(`[${row.status}] ${row.title}`);
      const description = escapeHtml(row.last_body ?? "");
      return [
        "<item>",
        `<title>${title}</title>`,
        `<link>${origin}/</link>`,
        `<guid isPermaLink="false">sitrep-incident-${row.id}-${row.status}</guid>`,
        `<pubDate>${new Date(updated * 1000).toUTCString()}</pubDate>`,
        `<description>${description}</description>`,
        "</item>",
      ].join("");
    })
    .join("\n");

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>${site} incidents</title>
<link>${origin}/</link>
<description>Incident history for ${site}</description>
${items}
</channel>
</rss>`;

  return new Response(feed, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};
