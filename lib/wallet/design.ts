import type { PassDesign } from "./passstudio";

/**
 * Design du pass (§3.2). Images en PNG https public, hébergées sur notre domaine
 * (`${siteUrl}/wallet/…`), ou sur `assetBaseUrl` tant que le site n'est pas en ligne.
 */
export function passDesign(siteUrl: string, assetBaseUrl = `${siteUrl}/wallet`): PassDesign {
  const asset = (f: string) => `${assetBaseUrl.replace(/\/$/, "")}/${f}`;
  return {
    backgroundColor: "#3540D8",
    foregroundColor: "#FFFFFF",
    labelColor: "#C9CCF4",
    organizationName: "Les RDV IA",
    description: "Carte membre Les RDV IA",
    // Logo « Rendez-vous IA » détouré de blanc : son « D » bleu disparaîtrait sinon sur le fond #3540D8.
    logoUrl: asset("rdvia-logo-rvia-150.png"),
    // Icône des notifications : logo « Rendez-vous IA » sur fond blanc (Pass Studio la réduit en 87×87).
    iconUrl: asset("rdvia-icon-rvia-1024.png"),
    // Type Custom : Apple n'affiche pas le bandeau (il reste l'image principale sur Google Wallet).
    // Sur Apple, l'éclair passe en vignette, à droite de MES SKILLS.
    stripImageUrl: asset("rdvia-strip-1125x432.png"),
    thumbnailUrl: asset("rdvia-thumbnail-270.png"),
    // barcodeType : la doc n'en liste pas les valeurs. On le laisse à l'éditeur (QR code)
    // et on lit la valeur retenue avec GET /passes/{passId} → design.barcodeType.
    // Rien sous le QR : la doc n'a pas de texte alternatif, ce serait l'URL. Le code est au verso (CODE MEMBRE).
    showBarcodeText: false,
    backWebsiteUrl: `${siteUrl}/mon-espace`,
    holderPhotoStrip: null,
    originalLanguage: "fr",
  };
}

/** Libellé du pass dans l'éditeur. */
export const PASS_NAME = "Carte membre Les RDV IA";
