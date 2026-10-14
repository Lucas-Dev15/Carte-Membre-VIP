import type { MemberCard, WalletPass } from "../wallet/types";

/**
 * Bloc « Votre carte membre » à insérer dans les e-mails : bienvenue,
 * confirmation de réservation, J-3, renvoi de la carte, nouvelle carte.
 * Les liens pointent vers les URLs publiques du pass stockées dans wallet_passes.
 */
export function cardEmailBlock(card: MemberCard, pass: WalletPass | null, siteUrl: string): { html: string; text: string } {
  const apple = pass?.appleWalletUrl ?? pass?.addToWalletUrl;
  const google = pass?.googleWalletUrl ?? pass?.addToWalletUrl;
  const fallback = `${siteUrl}/mon-espace#carte`;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const html = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#3540D8;border-radius:16px;color:#fff;font-family:Inter,Arial,sans-serif">
  <tr><td style="padding:20px 22px">
    <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#C9CCF4">Votre carte membre Les RDV IA</div>
    <div style="font-family:monospace;font-size:20px;font-weight:700;letter-spacing:1.6px;color:#FFE7A8;margin:6px 0 14px">${esc(card.code)}</div>
    <a href="${esc(apple ?? fallback)}" style="display:inline-block;background:#111114;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none;margin:0 8px 8px 0">Ajouter à Apple Wallet</a>
    <a href="${esc(google ?? fallback)}" style="display:inline-block;background:#111114;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none;margin:0 0 8px 0">Ajouter à Google Wallet</a>
  </td></tr>
</table>`.trim();
  const text = `Votre carte membre Les RDV IA : ${card.code}\nApple Wallet : ${apple ?? fallback}\nGoogle Wallet : ${google ?? fallback}`;
  return { html, text };
}
