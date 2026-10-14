import type { PassDesign } from "./passstudio";

/** Design du pass (§3.2). Images en PNG https public, hébergées sur notre domaine. */
export function passDesign(siteUrl: string): PassDesign {
  const asset = (f: string) => `${siteUrl}/wallet/${f}`;
  return {
    backgroundColor: "#3540D8",
    foregroundColor: "#FFFFFF",
    labelColor: "#C9CCF4",
    organizationName: "Les RDV IA",
    description: "Carte membre Les RDV IA",
    logoUrl: asset("rdvia-logo-480x150.png"),
    iconUrl: asset("rdvia-icon-87x87.png"),
    stripImageUrl: asset("rdvia-strip-1125x432.png"),
    barcodeType: "QR", // À VÉRIFIER : valeur exacte attendue (QR, qr, PKBarcodeFormatQR…)
    showBarcodeText: true,
    backWebsiteUrl: `${siteUrl}/mon-espace`,
    holderPhotoStrip: null,
    originalLanguage: "fr",
  };
}

export const PASS_NAME = "Carte membre Les RDV IA";
