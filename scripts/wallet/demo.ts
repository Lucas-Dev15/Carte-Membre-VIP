/**
 * Démo de bout en bout sur le pass publié, avec la carte de Manon Blanc (maquette).
 *
 *   npm run wallet:demo -- issue    émet la carte (1 crédit) et affiche les liens Apple / Google Wallet
 *   npm run wallet:demo -- push     +100 volts avec notification (1 crédit)
 *   npm run wallet:demo -- revoke   révoque la carte de démo (gratuit)
 *
 * Variables : PASS_STUDIO_API_KEY, PASS_STUDIO_PASS_ID, PASS_STUDIO_FIELD_KEYS (si clés générées).
 * L'instance émise est mémorisée dans .wallet-demo.json (non versionné).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { cardUrl } from "../../lib/wallet/code";
import { buildLocations, buildPassFields, parseFieldKeyMap, toPassStudioFields } from "../../lib/wallet/fields";
import { levelFor } from "../../lib/wallet/levels";
import { PassStudioClient, PassStudioError } from "../../lib/wallet/passstudio";
import type { MemberSnapshot } from "../../lib/wallet/types";

const STATE = ".wallet-demo.json";
const CODE = "RVIA-NCY-1259";

function manon(volts: number): MemberSnapshot {
  return {
    memberId: "demo-manon",
    firstName: "Manon",
    lastName: "Blanc",
    email: "manon.blanc@exemple.fr",
    city: "Nancy",
    cityCode: "NCY",
    voltsTotal: volts,
    createdAt: new Date("2026-03-09T10:00:00+01:00"),
    nextBooking: {
      conferenceTitle: "Créer ses visuels avec l’IA",
      startsAt: new Date("2026-11-12T18:30:00+01:00"),
      city: "Nancy",
      venue: { name: "[Lieu partenaire]", address: "Nancy", latitude: 48.6921, longitude: 6.1844 },
    },
  };
}

async function main() {
  const apiKey = process.env.PASS_STUDIO_API_KEY;
  const passId = process.env.PASS_STUDIO_PASS_ID;
  if (!apiKey || !passId) throw new Error("PASS_STUDIO_API_KEY et PASS_STUDIO_PASS_ID sont requises");
  const siteUrl = (process.env.PUBLIC_SITE_URL ?? "https://rendezvousia.fr").replace(/\/$/, "");
  const keyMap = parseFieldKeyMap(process.env.PASS_STUDIO_FIELD_KEYS);
  const client = new PassStudioClient({
    apiKey,
    baseUrl: (process.env.PASS_STUDIO_BASE_URL ?? "https://www.passstudio.online/api/v1").replace(/\/$/, ""),
    logger: (e) => console.log(`  ${e.method} ${e.path} → ${e.status}${e.errorCode ? ` ${e.errorCode}` : ""} (request ${e.requestId ?? "?"})`),
  });
  const state: { instanceId?: string; volts?: number } = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
  const action = process.argv[2] ?? "issue";

  if (action === "issue") {
    const member = manon(760);
    const { body } = await client.issue(
      passId,
      {
        customerId: "member_demo-manon",
        source: "rdvia",
        name: "Manon Blanc",
        sendEmail: false,
        includeArtifacts: true,
        locale: "fr",
        barcodeValue: cardUrl(siteUrl, CODE),
        fields: toPassStudioFields(buildPassFields(member, CODE), keyMap),
        locations: buildLocations(member),
      },
      "rdvia_demo_issue",
    );
    writeFileSync(STATE, JSON.stringify({ instanceId: body.instanceId, volts: 760 }, null, 2));
    console.log(`\nInstance : ${body.instanceId}${body.alreadyExisted ? " (déjà émise)" : ""}`);
    console.log(`Page d'ajout (les deux wallets) : ${body.addToWalletUrl}`);
    console.log(`Apple Wallet  : ${body.artifacts?.appleWalletUrl}`);
    console.log(`Google Wallet : ${body.artifacts?.googleWalletUrl}`);
  } else if (action === "push") {
    if (!state.instanceId) throw new Error("Lancez d'abord : npm run wallet:demo -- issue");
    const before = state.volts ?? 760;
    const after = before + 100;
    const up = levelFor(after).rank > levelFor(before).rank ? levelFor(after) : null;
    const message = up ? `Niveau ${up.rank} · ${up.name} atteint, bravo !` : `+100 volts ! Vous en avez maintenant ${after}.`;
    const fields = buildPassFields(manon(after), CODE);
    const res = await client.updateFields({
      instanceId: state.instanceId,
      // Tous les champs (même push, même crédit) : la carte suit aussi les changements de format.
      fields: toPassStudioFields(fields, keyMap),
      message,
      externalRef: `rdvia_demo_push_${after}`,
    });
    writeFileSync(STATE, JSON.stringify({ ...state, volts: after }, null, 2));
    console.log(`\n${before} → ${after} volts · « ${message} » · ${res.body.pushed ? "poussé" : `non poussé (${res.body.pushSkipReason})`}`);
  } else if (action === "revoke") {
    if (!state.instanceId) throw new Error("Aucune carte de démo émise");
    await client.revoke(state.instanceId, "fin de la démo");
    console.log("Carte de démo révoquée.");
  } else {
    throw new Error(`Action inconnue : ${action} (issue | push | revoke)`);
  }
}

main().catch((err) => {
  if (err instanceof PassStudioError) {
    console.error(`Erreur API ${err.status} ${err.code ?? ""} : ${err.message} (request ${err.requestId ?? "?"})`);
  } else {
    console.error(err instanceof Error ? err.message : err);
  }
  process.exit(1);
});
