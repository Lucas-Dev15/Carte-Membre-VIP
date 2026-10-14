import QRCode from "qrcode";

/** QR en SVG, encre #111114 sur fond blanc (le carré blanc est fourni par le conteneur). */
export function qrSvg(text: string, margin = 0): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin,
    color: { dark: "#111114", light: "#FFFFFF" },
  });
}
