import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { getWalletContext } from "@/lib/app/context";
import { webhookSecret } from "@/lib/wallet/config";
import { applyWebhookEvent } from "@/lib/wallet/service";
import { parseWebhookEvent, verifyWebhookSignature } from "@/lib/wallet/webhook";

/** POST /api/webhooks/passstudio — pass.issued, pass.updated, pass.removed */
export async function POST(req: NextRequest) {
  const rawBody = await req.text(); // corps BRUT, avant tout parsing
  const check = verifyWebhookSignature({
    secret: webhookSecret(),
    rawBody,
    signatureHeader: req.headers.get("x-passstudio-signature"),
    timestampHeader: req.headers.get("x-passstudio-timestamp"),
  });
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 401 });

  let event;
  try {
    event = parseWebhookEvent(rawBody, req.headers.get("x-passstudio-event"));
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const ctx = await getWalletContext();
  const deliveryId = req.headers.get("x-passstudio-delivery") ?? event.id;
  if (deliveryId && !(await ctx.repo.markWebhookDelivery(deliveryId))) {
    return NextResponse.json({ ok: true, duplicate: true });
  }
  if (ctx.passId && event.passId && event.passId !== ctx.passId) {
    return NextResponse.json({ ok: true, ignored: "other_pass" });
  }

  // Réponse 2xx immédiate, traitement après l'envoi de la réponse.
  after(() => applyWebhookEvent(ctx, event).catch((e) => console.error("[webhook passstudio]", e)));
  return NextResponse.json({ ok: true });
}
