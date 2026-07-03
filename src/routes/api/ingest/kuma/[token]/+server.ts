import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { rateLimit } from "$lib/server/rate-limit";
import { findSource, ingestKuma, MAX_BODY_BYTES } from "$lib/server/ingest";

export const POST: RequestHandler = async ({
  params,
  request,
  getClientAddress,
}) => {
  if (!rateLimit(`ingest:${getClientAddress()}`, 120, 240)) {
    return json({ ok: false }, { status: 429 });
  }

  const source = findSource(params.token, "kuma");
  if (!source) {
    // Deliberately indistinguishable from a wrong path: token probing
    // learns nothing.
    return json({ ok: false }, { status: 404 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return json({ ok: false, error: "payload too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return json({ ok: false, error: "payload too large" }, { status: 413 });
    }
    body = JSON.parse(text);
  } catch {
    return json(
      { ok: false, error: "body is not valid JSON" },
      { status: 400 },
    );
  }

  try {
    const result = ingestKuma(source, body, Math.floor(Date.now() / 1000));
    if (result.kind === "rejected") {
      return json({ ok: false, error: result.reason }, { status: 400 });
    }
    // Accepted and ignored are both 200: Kuma treats non-2xx as a failed
    // notification and retries, which we never want for semantically
    // ignorable payloads.
    return json({ ok: true, result: result.kind });
  } catch (err) {
    console.error("kuma ingest failed", err);
    return json({ ok: false, error: "internal error" }, { status: 500 });
  }
};
