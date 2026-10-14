/**
 * Création / vérification idempotente du modèle de pass (§5).
 *
 *   npm run wallet:setup               → crée le modèle si PASS_STUDIO_PASS_ID est vide, sinon le vérifie
 *   npm run wallet:setup -- --publish  → publie le modèle (status: active) si aucun blocage
 *
 * Recommandé : créer le modèle dans l'éditeur The Pass Studio (placement des champs §3.3),
 * puis lancer ce script avec PASS_STUDIO_PASS_ID pour le vérifier et le publier.
 * En développement, utilisez un pass de test séparé laissé en « draft ».
 */
import { HOLDER_FIELD_KEYS, TEMPLATE_FIELD_KEYS } from "../../lib/wallet/fields";
import { PASS_NAME, passDesign } from "../../lib/wallet/design";
import { PassStudioClient, PassStudioError } from "../../lib/wallet/passstudio";

async function main() {
  const apiKey = process.env.PASS_STUDIO_API_KEY;
  if (!apiKey) throw new Error("PASS_STUDIO_API_KEY manquante");
  const baseUrl = (process.env.PASS_STUDIO_BASE_URL ?? "https://www.passstudio.online/api/v1").replace(/\/$/, "");
  const siteUrl = (process.env.PUBLIC_SITE_URL ?? "https://rendezvousia.fr").replace(/\/$/, "");
  const publish = process.argv.includes("--publish");

  const client = new PassStudioClient({
    apiKey,
    baseUrl,
    logger: (e) => console.log(`  ${e.method} ${e.path} → ${e.status} (request ${e.requestId ?? "?"})`),
  });

  let passId = process.env.PASS_STUDIO_PASS_ID;
  if (!passId) {
    console.log("Aucun PASS_STUDIO_PASS_ID : création du modèle…");
    const { body } = await client.createPass({
      name: PASS_NAME,
      passType: "loyalty",
      distributionMode: "unique",
      status: "draft",
      design: passDesign(siteUrl),
    });
    passId = body.id;
    console.log(`Modèle créé : ${passId}`);
  }

  const { body: pass } = await client.getPass(passId);
  const keys = new Set([...(pass.fieldKeys ?? []), ...(pass.templateOwnedFieldKeys ?? [])]);
  const missing = [...HOLDER_FIELD_KEYS, ...TEMPLATE_FIELD_KEYS].filter((k) => !keys.has(k));
  const blockers = pass.publishBlockers ?? [];

  console.log(`\nStatut : ${pass.status}`);
  console.log(missing.length ? `Clés manquantes : ${missing.join(", ")}` : "Toutes les clés §3.3 sont présentes.");
  console.log(blockers.length ? `publishBlockers : ${JSON.stringify(blockers)}` : "Aucun publishBlocker.");

  if (publish) {
    if (missing.length || blockers.length) {
      console.error("\nPublication refusée : corrigez les points ci-dessus dans l'éditeur The Pass Studio.");
      process.exitCode = 1;
    } else if (pass.status !== "active") {
      await client.updatePass(passId, { status: "active" });
      console.log("Modèle publié (status: active).");
    }
  }
  console.log(`\nPASS_STUDIO_PASS_ID=${passId}`);
}

main().catch((err) => {
  if (err instanceof PassStudioError) {
    console.error(`Erreur API ${err.status} ${err.code ?? ""} : ${err.message} (request ${err.requestId ?? "?"})`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
