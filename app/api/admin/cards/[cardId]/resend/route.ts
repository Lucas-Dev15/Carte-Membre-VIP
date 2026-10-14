import { NextResponse } from "next/server";
import { getViewer } from "@/lib/app/auth";
import { getRepository } from "@/lib/app/context";
import { cardEmailBlock } from "@/lib/app/emails";
import { siteUrl } from "@/lib/wallet/config";

/** POST — « Renvoyer la carte par e-mail » (partenaire de la ville ou super-admin). */
export async function POST(_req: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const viewer = await getViewer();
  const { cardId } = await params;
  const repo = getRepository();
  const card = await repo.getCardById(cardId);
  if (!card || card.status !== "active") return NextResponse.json({ error: "Carte introuvable" }, { status: 404 });
  const member = await repo.getMemberSnapshot(card.memberId);
  const allowed =
    viewer?.role === "superadmin" || (viewer?.role === "partner" && member?.city === viewer.partnerCity);
  if (!allowed || !member) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const block = cardEmailBlock(card, await repo.getWalletPass(card.id), siteUrl());
  // TODO : brancher le service d'e-mail existant (template « Renvoi de la carte »).
  console.info("[email] renvoi de carte", { to: member.email.replace(/^(.).*@/, "$1***@"), code: card.code, bytes: block.html.length });
  return NextResponse.json({ ok: true });
}
