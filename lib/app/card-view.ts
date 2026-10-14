import { buildPassFields, type PassFields } from "../wallet/fields";
import { formatMonthYear } from "../wallet/format";
import { levelFor } from "../wallet/levels";
import type { MemberCard, MemberSnapshot, WalletPass } from "../wallet/types";
import { qrSvg } from "./qr";
import { getRepository } from "./context";

export interface CardView {
  member: MemberSnapshot;
  card: MemberCard;
  pass: WalletPass | null;
  fields: PassFields;
  levelShort: string;
  memberSince: string;
  qr: string;
}

/** Tout ce qu'il faut pour afficher la carte (espace membre et fiche admin). */
export async function loadCardView(memberId: string): Promise<CardView | null> {
  const repo = getRepository();
  const [member, card] = await Promise.all([repo.getMemberSnapshot(memberId), repo.getActiveCardByMember(memberId)]);
  if (!member || !card) return null;
  const level = levelFor(member.voltsTotal);
  return {
    member,
    card,
    pass: await repo.getWalletPass(card.id),
    fields: buildPassFields(member, card.code),
    levelShort: `Niv. ${level.rank} ${level.name}`,
    memberSince: formatMonthYear(member.createdAt),
    qr: await qrSvg(card.qrUrl),
  };
}
