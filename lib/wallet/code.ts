import { randomInt } from "node:crypto";

/** Format : RVIA-[CODE VILLE]-[4 chiffres], ex. RVIA-NCY-1259 */
export const MEMBER_CODE_RE = /^RVIA-[A-Z]{3}-\d{4}$/;

export function isValidMemberCode(code: string): boolean {
  return MEMBER_CODE_RE.test(code);
}

/**
 * Génère un code inédit. `codeExists` doit interroger TOUTES les cartes,
 * révoquées comprises : un code n'est jamais réattribué.
 * La contrainte UNIQUE sur member_cards.code reste le garde-fou final.
 */
export async function generateMemberCode(
  cityCode: string,
  codeExists: (code: string) => Promise<boolean>,
  maxAttempts = 50,
): Promise<string> {
  const city = cityCode.toUpperCase();
  if (!/^[A-Z]{3}$/.test(city)) throw new Error(`Code ville invalide : ${cityCode}`);
  for (let i = 0; i < maxAttempts; i++) {
    const code = `RVIA-${city}-${String(randomInt(0, 10_000)).padStart(4, "0")}`;
    if (!(await codeExists(code))) return code;
  }
  throw new Error(`Impossible de générer un code libre pour ${city} (espace saturé ?)`);
}

export function cardUrl(siteUrl: string, code: string): string {
  return `${siteUrl.replace(/\/$/, "")}/carte/${code}`;
}
