/**
 * Création / vérification idempotente du modèle de pass (§5).
 *
 *   npm run wallet:setup                       crée le modèle (brouillon) si PASS_STUDIO_PASS_ID est vide, sinon le vérifie
 *   npm run wallet:setup -- --set-howto        écrit le texte « Gagner des volts » (champ du modèle, 1 push = 1 crédit)
 *   npm run wallet:setup -- --publish          publie le modèle (10 crédits, une seule fois)
 *   npm run wallet:setup -- --fields           écrit / replace les 11 champs (PASS_LAYOUT) avec des valeurs de test,
 *                                              en gardant les clés existantes (gratuit, sans push)
 *   npm run wallet:setup -- --design           renvoie couleurs et images de lib/wallet/design.ts (gratuit, sans push)
 *   … --push                                   avec --fields / --design : pousse aussi aux cartes émises (1 crédit par push)
 *
 * Recommandé : dessiner le modèle dans l'éditeur The Pass Studio (placement des champs §3.3),
 * puis lancer ce script avec PASS_STUDIO_PASS_ID : il propose PASS_STUDIO_FIELD_KEYS
 * (clés générées par l'éditeur, retrouvées par leur libellé) et vérifie qu'il ne manque rien.
 */
import {
  FIELD_LABELS,
  HOLDER_FIELD_KEYS,
  HOW_TO_TEXT,
  PASS_LAYOUT,
  buildPassFields,
  parseFieldKeyMap,
} from "../../lib/wallet/fields";
import { SAMPLE_CODE, sampleMember } from "./sample";
import { PASS_NAME, passDesign } from "../../lib/wallet/design";
import { PassStudioClient, PassStudioError } from "../../lib/wallet/passstudio";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

async function main() {
  const apiKey = process.env.PASS_STUDIO_API_KEY;
  if (!apiKey) throw new Error("PASS_STUDIO_API_KEY manquante");
  const baseUrl = (process.env.PASS_STUDIO_BASE_URL ?? "https://www.passstudio.online/api/v1").replace(/\/$/, "");
  const siteUrl = (process.env.PUBLIC_SITE_URL ?? "https://rendezvousia.fr").replace(/\/$/, "");
  // Images du pass : par défaut sur le site ; PASS_STUDIO_ASSET_BASE_URL si le site n'est pas encore en ligne.
  const assetBaseUrl = process.env.PASS_STUDIO_ASSET_BASE_URL || undefined;
  const args = process.argv.slice(2);
  const passType = "custom"; // validé : seul type qui accepte nos champs libres

  const client = new PassStudioClient({
    apiKey,
    baseUrl,
    logger: (e) => console.log(`  ${e.method} ${e.path} → ${e.status}${e.errorCode ? ` ${e.errorCode}` : ""} (request ${e.requestId ?? "?"})`),
  });

  const me = await client.getMe();
  console.log(`Compte : ${me.body.id} · crédits : ${me.body.billing?.credits ?? "?"}`);

  let passId = process.env.PASS_STUDIO_PASS_ID;
  if (!passId) {
    console.log(`\nAucun PASS_STUDIO_PASS_ID : création du modèle (${passType}, brouillon)…`);
    const { body } = await client.createPass({
      name: PASS_NAME,
      passType,
      distributionMode: "unique",
      status: "draft",
      sendInviteEmail: false, // nos e-mails partent de notre plateforme
      // Relancer le script ne crée pas de doublon : même clé = même pass. PASS_STUDIO_CREATE_ID force un nouveau pass.
      clientRequestId: process.env.PASS_STUDIO_CREATE_ID || `rdvia-carte-membre-${passType}-v1`,
      design: passDesign(siteUrl, assetBaseUrl),
    });
    passId = body.pass.passId;
    console.log(`Modèle ${body.alreadyExisted ? "existant" : "créé"} : ${passId}`);
    console.log("→ Placez maintenant les champs du §3.3 dans l'éditeur, puis relancez avec PASS_STUDIO_PASS_ID.");
  }

  const push = args.includes("--push");

  if (args.includes("--design")) {
    const res = await client.updatePass(passId, { design: passDesign(siteUrl, assetBaseUrl), push });
    console.log(
      res.body.pushed
        ? `Design et images renvoyés, poussés à ${String(res.body.holderCount ?? "?")} carte(s).`
        : "Design et images renvoyés (sans push : les cartes émises le recevront au prochain push).",
    );
  }

  if (args.includes("--fields")) {
    // Pass Custom : design.fields = [{ key, label, value, position }]. On garde la clé d'une ligne existante
    // (même libellé, ou clé déjà dans PASS_STUDIO_FIELD_KEYS) pour que PASS_STUDIO_FIELD_KEYS reste valable.
    const before = await client.getPass(passId);
    const rows = Array.isArray(before.body.pass.design?.fields)
      ? (before.body.pass.design!.fields as { key?: string; label?: string }[])
      : [];
    const known = parseFieldKeyMap(process.env.PASS_STUDIO_FIELD_KEYS);
    const sample: Record<string, string> = { ...buildPassFields(sampleMember(760), SAMPLE_CODE), howTo: HOW_TO_TEXT };
    const stamp = Date.now();
    const fields = PASS_LAYOUT.map((f, i) => {
      const existing = rows.find((r) => r.key && (r.key === known[f.key] || norm(r.label ?? "") === norm(f.label)));
      return { key: existing?.key ?? `field_${stamp + i}`, label: f.label, value: sample[f.key], position: f.position };
    });
    const res = await client.updatePass(passId, { design: { fields }, push });
    console.log(`11 champs écrits${res.body.pushed ? " et poussés" : " (sans push)"} :`);
    for (const f of fields) console.log(`  ${f.position.padEnd(10)} ${f.key}  ${f.label}`);
  }

  const { body } = await client.getPass(passId);
  const pass = body.pass;
  console.log(`\n« ${pass.name} » · type ${pass.passType} · statut ${pass.status} · distribution ${pass.distributionMode}`);

  const design = (pass.design ?? {}) as { showBarcodeText?: boolean };
  if (design.showBarcodeText !== false) {
    await client.updatePass(passId, { design: { showBarcodeText: false } });
    console.log("Texte sous le QR masqué (design.showBarcodeText: false).");
  }

  if (pass.sendInviteEmail !== false) {
    await client.updatePass(passId, { sendInviteEmail: false });
    console.log("E-mail d'invitation The Pass Studio désactivé (sendInviteEmail: false).");
  }

  // Correspondance clés logiques → clés réelles, par libellé.
  const labels = pass.fieldLabels ?? {};
  const keys = pass.fieldKeys ?? [];
  const templateKeys = new Set(pass.templateOwnedFieldKeys ?? []);
  console.log("\nClés du pass :");
  for (const k of keys) console.log(`  ${k.padEnd(28)} ${labels[k] ?? ""}${templateKeys.has(k) ? "  (modèle)" : ""}`);

  const current = parseFieldKeyMap(process.env.PASS_STUDIO_FIELD_KEYS);
  const proposal: Record<string, string> = {};
  const missing: string[] = [];
  for (const logical of [...HOLDER_FIELD_KEYS, "howTo"] as const) {
    const wanted = current[logical] ?? logical;
    let real = keys.includes(wanted) ? wanted : undefined;
    real ??= keys.find((k) => FIELD_LABELS[logical].some((l) => norm(labels[k] ?? "") === norm(l)) && !Object.values(proposal).includes(k));
    if (real) proposal[logical] = real;
    else missing.push(`${logical} (${FIELD_LABELS[logical][0]})`);
  }
  const perHolderOnTemplate = HOLDER_FIELD_KEYS.filter((k) => proposal[k] && templateKeys.has(proposal[k]));

  console.log(missing.length ? `\nClés introuvables : ${missing.join(", ")}` : "\nToutes les clés du §3.3 sont présentes.");
  if (perHolderOnTemplate.length) console.log(`Clés gérées par le modèle alors qu'elles sont par porteur : ${perHolderOnTemplate.join(", ")}`);
  const identity = Object.entries(proposal).every(([k, v]) => k === v);
  if (!identity) console.log(`\nPASS_STUDIO_FIELD_KEYS='${JSON.stringify(proposal)}'`);

  if (args.includes("--set-howto") && proposal.howTo) {
    const res = await client.updateTemplateFields(passId, { [proposal.howTo]: HOW_TO_TEXT });
    console.log(`Texte « Gagner des skills » : ${res.body.pushSkipReason ?? (res.body.pushed ? "poussé" : "enregistré")}`);
  }

  if (args.includes("--publish")) {
    if (missing.length || perHolderOnTemplate.length) {
      console.error("\nPublication refusée : corrigez les points ci-dessus dans l'éditeur.");
      process.exitCode = 1;
    } else if (pass.status !== "active") {
      const res = await client.updatePass(passId, { status: "active" });
      if (res.body.pass.status === "active") console.log("Modèle publié (status: active, 10 crédits).");
      else console.error(`Non publié : ${JSON.stringify(res.body.publishBlockers ?? res.body.publishSkipReason)}`);
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
