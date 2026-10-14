import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/app/auth";
import { getWalletContext } from "@/lib/app/context";
import { revokeAndRegenerate } from "@/lib/wallet/service";

/** POST { reason } — super-admin uniquement. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const viewer = await getViewer();
  if (viewer?.role !== "superadmin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { cardId } = await params;
  const { reason } = (await req.json().catch(() => ({}))) as { reason?: string };
  if (!reason?.trim()) return NextResponse.json({ error: "Le motif est obligatoire" }, { status: 400 });

  try {
    const ctx = await getWalletContext();
    const card = await revokeAndRegenerate(ctx, { cardId, actorId: viewer.userId, reason });
    // TODO : envoyer l'e-mail « Votre nouvelle carte membre » (lib/app/emails.ts → cardEmailBlock).
    return NextResponse.json({ code: card.code, cardId: card.id });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
