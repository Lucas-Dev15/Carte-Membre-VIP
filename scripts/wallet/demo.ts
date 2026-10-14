/**
 * Démo de bout en bout sur le pass publié, avec la carte de Manon Blanc (maquette).
 *
 *   npm run wallet:demo -- issue                     émet la carte (1 crédit) et affiche les liens Apple / Google Wallet
 *   npm run wallet:demo -- cards                     liste les cartes émises et dit lesquelles sont dans un wallet (gratuit)
 *   npm run wallet:demo -- push                      +100 volts avec notification sur la carte de démo (1 crédit)
 *   npm run wallet:demo -- push --installed          … sur la carte réellement installée dans un wallet
 *   npm run wallet:demo -- push --instance <id> --from 860   … sur une carte précise, en partant de 860 volts
 *   npm run wallet:demo -- revoke [--instance <id>]  révoque la carte de démo, ou une carte précise (gratuit, définitif)
 *
 * Attention : le lien de partage du pass et le bouton « Ajouter » de l'éditeur créent chacun une NOUVELLE carte
 * anonyme (1 crédit), sans lien avec Manon. Pour installer la carte de démo, ouvrir son lien « Page d'ajout ».
 *
 * Variables : PASS_STUDIO_API_KEY, PASS_STUDIO_PASS_ID, PASS_STUDIO_FIELD_KEYS (si clés générées).
 * La carte de démo et ses volts sont mémorisés dans .wallet-demo.json (non versionné).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { cardUrl } from "../../lib/wallet/code";
import { buildLocations, buildPassFields, parseFieldKeyMap, toPassStudioFields } from "../../lib/wallet/fields";
import { levelFor } from "../../lib/wallet/levels";
import { PassStudioClient, PassStudioError, type InstanceInfo } from "../../lib/wallet/passstudio";
import { SAMPLE_CODE as CODE, sampleMember as manon } from "./sample";

const STATE = ".wallet-demo.json";

function option(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
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
  type State = { instanceId?: string; volts?: number; others?: Record<string, number> };
  const state: State = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};

  async function listCards(): Promise<InstanceInfo[]> {
    const all: InstanceInfo[] = [];
    let cursor: string | undefined;
    do {
      const { body } = await client.listInstances(passId!, cursor);
      all.push(...body.instances);
      cursor = body.nextCursor ?? undefined;
    } while (cursor);
    return all;
  }
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
  } else if (action === "cards") {
    for (const c of await listCards()) {
      const where = c.stage === "installed" ? `dans ${c.wallets.join(" + ")}` : c.stage;
      const who = c.instanceId === state.instanceId ? "carte de démo (Manon)" : (c.customerId ?? "anonyme");
      console.log(`${c.instanceId}  ${c.status.padEnd(8)} ${where.padEnd(18)} ${who.padEnd(24)} ${c.addToWalletUrl}`);
    }
  } else if (action === "push") {
    let instanceId = option("--instance") ?? state.instanceId;
    if (process.argv.includes("--installed")) {
      const installed = (await listCards()).filter((c) => c.status === "active" && c.stage === "installed");
      if (installed.length !== 1) {
        throw new Error(`${installed.length} carte(s) installée(s) : précisez --instance <id> (voir « cards »)`);
      }
      instanceId = installed[0].instanceId;
    }
    if (!instanceId) throw new Error("Lancez d'abord : npm run wallet:demo -- issue");
    const isDemo = instanceId === state.instanceId;
    const remembered = isDemo ? state.volts : state.others?.[instanceId];
    const before = Number(option("--from") ?? remembered ?? 760);
    const after = before + 100;
    const up = levelFor(after).rank > levelFor(before).rank ? levelFor(after) : null;
    const message = up ? `Niveau ${up.rank} · ${up.name} atteint, bravo !` : `+100 volts ! Vous en avez maintenant ${after}.`;
    const fields = buildPassFields(manon(after), CODE);
    const res = await client.updateFields({
      instanceId,
      // Tous les champs (même push, même crédit) : la carte suit aussi les changements de format.
      fields: toPassStudioFields(fields, keyMap),
      message,
      externalRef: `rdvia_demo_push_${instanceId.slice(0, 8)}_${after}`,
    });
    const next: State = isDemo
      ? { ...state, volts: after }
      : { ...state, others: { ...state.others, [instanceId]: after } };
    writeFileSync(STATE, JSON.stringify(next, null, 2));
    console.log(`\n${instanceId} : ${before} → ${after} volts · « ${message} » · ${res.body.pushed ? "poussé" : `non poussé (${res.body.pushSkipReason})`}`);
  } else if (action === "revoke") {
    const instanceId = option("--instance") ?? state.instanceId;
    if (!instanceId) throw new Error("Aucune carte de démo émise");
    await client.revoke(instanceId, "fin de la démo");
    console.log(`Carte ${instanceId} révoquée.`);
  } else {
    throw new Error(`Action inconnue : ${action} (issue | cards | push | revoke)`);
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
