# Prompt — Carte membre « Les RDV IA » dans Apple Wallet / Google Wallet (The Pass Studio)

Tu travailles sur la carte membre wallet du projet « Les RDV IA » de Lucas. Ce document t'explique **tout ce qui a été fait, pourquoi, et comment le refaire de zéro**, puis l'état actuel. Réponds en français. Lis aussi `README.md` et `docs/SPEC_CARTE_MEMBRE_WALLET.md` (la spécification d'origine de Lucas).

- Dépôt : `Lucas-Dev15/Carte-Membre-VIP` (public). Branche de travail : `claude/confident-euler-5m0jhm` (elle part de `claude/beautiful-cori-iwrxce`, qui contient la carte web et le client API).
- Service : **The Pass Studio**. API `https://www.passstudio.online/api/v1`, authentification `Authorization: Bearer <clé>`. Doc : https://www.thepassstudio.com/docs/integrations (la lire en cas de doute ; elle est longue, chercher par mot-clé).
- Clé API : variable d'environnement `PASS_STUDIO_API_KEY` (`ps_live_…`, compte de Lucas, plan free). **Ne jamais l'écrire dans un fichier, un commit ou un message.**

---

## 1. Le projet en bref

- Next.js 15 + TypeScript. `npm ci`, puis `npm run typecheck` et `npm test` (28 tests Vitest) avant chaque commit.
- `lib/wallet/passstudio.ts` : **seul** client HTTP de l'API (getMe, createPass, getPass, updatePass, issue, updateFields, listInstances, revoke…).
- `lib/wallet/fields.ts` : calcule les 10 champs d'un membre (`buildPassFields`), la disposition du pass (`PASS_LAYOUT`), la correspondance clés logiques → clés réelles (`PASS_STUDIO_FIELD_KEYS`, `toPassStudioFields`). Niveaux dans `levels.ts`, dates françaises dans `format.ts`.
- `lib/wallet/design.ts` : couleurs et images du pass (`passDesign(siteUrl, assetBaseUrl)`).
- `scripts/wallet/setup-pass.ts` (`npm run wallet:setup`) : crée / configure / publie le modèle de pass.
- `scripts/wallet/demo.ts` (`npm run wallet:demo`) : carte de démo de Manon Blanc (émission, push, liste des cartes, révocation). `scripts/wallet/sample.ts` : les données de Manon.
- `components/WalletPreview.tsx` : aperçu du pass dans l'espace membre du site.

Vocabulaire The Pass Studio : un **pass** (« Carte » dans l'éditeur) est le modèle ; une **instance** est la carte d'un membre. **Révoquer** une instance l'annule définitivement (affichée comme annulée dans le wallet, gratuit, pas d'annulation possible). **Archiver** un pass l'empêche d'émettre de nouvelles cartes (réversible). L'API ne sait pas **supprimer** un pass (`DELETE /passes/{id}` → 405) : seulement dans l'éditeur.

---

## 2. Coûts en crédits (vérifier le solde avec `GET /me` → `billing.credits`)

| Action | Coût |
|---|---|
| Brouillon, modification d'un brouillon, `PATCH /passes/{id}` avec `"push": false` | gratuit |
| Publication d'un pass (première fois) | **10** |
| Émission d'une carte (`POST /passes/{id}/issue`) | 1 |
| Ouverture du **lien de partage du pass** ou du bouton « Ajouter » de l'éditeur | **1 (crée une carte anonyme !)** |
| Push d'une carte (`PATCH /instances/fields`) | 1 |
| Changement de design poussé aux cartes (`"push": true`) | 1 par push |
| Révocation, archivage, webhooks, lecture | gratuit |

Règle : annoncer le coût et demander l'accord de Lucas avant la publication et avant toute dépense répétée. Tester d'abord sur un brouillon.

---

## 3. Refaire tout de zéro (commandes)

Pré-requis : `npm ci` ; `PASS_STUDIO_API_KEY` dans l'environnement. Les images du pass doivent être en **https public** (The Pass Studio les télécharge). Tant que `rendezvousia.fr` n'est pas en ligne (il ne résout pas), les servir depuis GitHub, épinglées sur un commit :

```bash
export PASS_STUDIO_ASSET_BASE_URL=https://raw.githubusercontent.com/Lucas-Dev15/Carte-Membre-VIP/<commit>/public/wallet
# commit actuel des images : 1fd901d
```

1. **Vérifier la clé et les crédits** : `curl -H "Authorization: Bearer $PASS_STUDIO_API_KEY" https://www.passstudio.online/api/v1/me`
2. **Créer le pass en brouillon** (gratuit) : `npm run wallet:setup`
   Crée un pass `custom`, distribution `unique`, `sendInviteEmail: false`, avec le design de `design.ts`, et affiche `PASS_STUDIO_PASS_ID`. Il est idempotent : sur le même compte il renvoie le pass déjà créé ; `PASS_STUDIO_CREATE_ID=<texte unique>` force un nouveau pass.
3. **Créer les 11 champs** (gratuit) : `PASS_STUDIO_PASS_ID=… npm run wallet:setup -- --fields`
   Écrit la disposition `PASS_LAYOUT` avec des valeurs de test (celles de Manon), en gardant les clés déjà existantes. Le script affiche ensuite **`PASS_STUDIO_FIELD_KEYS`** : l'exporter.
4. (Si les images ou couleurs changent) `npm run wallet:setup -- --design` (gratuit ; ajouter `--push` pour l'envoyer aux cartes déjà émises, payant).
5. **Faire vérifier l'aperçu à Lucas dans l'éditeur**, puis, **avec son accord**, publier : `npm run wallet:setup -- --publish` (10 crédits).
6. **Émettre la carte de démo** : `npm run wallet:demo -- issue` (1 crédit). Donner à Lucas le lien « Page d'ajout » (`https://www.thepassstudio.com/i/<shareToken>`) ou les liens Apple / Google affichés. **Lui dire de ne pas utiliser le lien de partage du pass ni le bouton de l'éditeur** (carte anonyme).
7. **Vérifier ce qui est installé** : `npm run wallet:demo -- cards` (gratuit) → la carte doit apparaître « dans apple » (ou google).
8. **Pousser une mise à jour avec notification** : `npm run wallet:demo -- push` (carte de démo) ou `push --installed` (la carte réellement installée) ou `push --instance <id> --from <volts>` (1 crédit). Le message vaut « Niveau N · Nom atteint, bravo ! » si le niveau change, sinon « +100 volts ! Vous en avez maintenant N. ».
9. **Nettoyer** : `npm run wallet:demo -- revoke [--instance <id>]` (gratuit, définitif).

Vérifier une carte telle que le téléphone la reçoit (gratuit, ne crée rien) :

```bash
curl -sSL -o carte.pkpass "https://www.thepassstudio.com/api/i/<shareToken>/download?platform=apple&raw=1"
python3 -c "import zipfile,json;p=json.loads(zipfile.ZipFile('carte.pkpass').read('pass.json'));print(json.dumps(p.get('generic'),ensure_ascii=False,indent=1))"
```

---

## 4. Ce qui a été fait, dans l'ordre, et pourquoi

1. **Clé vérifiée** (`GET /me` : 50 crédits au départ).
2. **Images** : `rendezvousia.fr` ne résout pas → les URL d'images étaient injoignables. Ajout de `PASS_STUDIO_ASSET_BASE_URL` (fichiers servis par raw.githubusercontent.com, épinglés sur un commit). The Pass Studio télécharge, vérifie, redimensionne (icône 87×87, logo ≤ 480×150, bandeau 1125×432, vignette 270×270) et stocke ; il garde la transparence.
3. **Type de pass**, testé sur des brouillons gratuits :
   - **Custom** (devient `generic` côté Apple) : champs et libellés libres. **Apple n'affiche pas le bandeau** sur ce type (l'éditeur le signale) ; Google Wallet l'affiche comme image principale.
   - **Fidélité** (`storeCard`) : bandeau affiché, mais seulement 8 clés fixes (`memberName`, `memberId`, `points`, `tier`, `expiryDate`, `programText`, `rewardLine`, `rewardCode`) aux libellés imposés ; `design.labels` et `design.extraFields` refusés (400).
   - **Événement** : accepte `design.labels` et `design.extraFields` (`{key?, label, value, position: "front"|"back"}`) mais c'est un billet (date, lieu, non transférable).
   - **Choix de Lucas : Custom sans bandeau** (aperçus `docs/option-custom.png`, `docs/option-loyalty.png`). L'éclair passe en **vignette** (`thumbnailUrl`) à droite des volts.
4. **Logo doublé** : l'ancien logo contenait « Les RDV IA » en blanc et Apple écrit en plus `logoText` (= `organizationName`) à côté. Lucas a ensuite fourni son logo « Rendez-vous IA » (`assets-src/rdvia-logo-rendez-vous-ia.webp`) : son « D » bleu disparaissait sur le fond bleu, donc il est **détouré de blanc** (`public/wallet/rdvia-logo-rvia-150.png`, 164×150). « Les RDV IA » reste écrit par Apple à côté (impossible à retirer par l'API).
5. **Champs d'un pass Custom créés par l'API** : la doc dit que les champs se placent dans l'éditeur, et `PATCH /instances/fields` n'en change que les valeurs. En lisant le code public de la page de partage (le chunk qui construit le `pass.json`), on voit que pour un pass `custom`, **`design.fields` est un tableau de lignes `{ key, label, value, position }`**, `position` ∈ `header | primary | secondary | auxiliary | back`, recopiées dans `generic.headerFields / primaryFields / secondaryFields / auxiliaryFields / backFields`. On écrit donc ce tableau par `PATCH /passes/{id}` (`{"design":{"fields":[…]},"push":false}`). Clés au format de l'éditeur : `field_<horodatage en ms>`. **Une ligne sans `key` est stockée avec la clé `undefined` : inutilisable.** Pour déplacer un champ : relire `design.fields`, changer `position`, garder les mêmes `key`, renvoyer le tableau complet ; `PASS_STUDIO_FIELD_KEYS` reste valable. C'est ce que fait `wallet:setup -- --fields`.
6. **Publication** (10 crédits) après accord de Lucas.
7. **Carte de Manon émise** (`RVIA-NCY-1259`) ; `pass.json` vérifié en téléchargeant le `.pkpass`.
8. **Mise en page** : Lucas a vu l'aperçu de l'éditeur et demandé mieux. Proposition testée puis **annulée à sa demande** (« c'était mieux avant ») : niveau sous les volts, VILLE au verso, date courte. Il a demandé des **valeurs de test** dans le modèle pour que l'aperçu de l'éditeur soit rempli.
9. **Carte sur l'iPhone qui ne se mettait pas à jour** : `GET /passes/{id}/instances` montrait que la carte de Manon n'était installée nulle part ; Lucas avait installé des **cartes anonymes** créées par le lien de partage / l'éditeur. Les pushs sont maintenant faits sur la carte réellement installée (`push --installed`). Deux cartes anonymes inutiles ont été révoquées.
10. **Notification** reçue sur l'iPhone. **Icône** remplacée par le logo de Lucas sur fond blanc (`public/wallet/rdvia-icon-rvia-1024.png`) ; visible à la notification suivante.
11. **Ménage** : les pass de test et un ancien brouillon « Carte Membre VIP » ont été **archivés** (pas de suppression par l'API).

---

## 5. Disposition validée (Apple)

| Emplacement | Libellé | Clé logique | Exemple |
|---|---|---|---|
| En-tête | NIVEAU | `level` | 3 · Explorateur |
| Principal (grand) + vignette éclair | MES VOLTS | `volts` | 760 |
| Secondaire gauche / droite | MEMBRE / VILLE | `memberName` / `city` | Manon Blanc / Nancy |
| Auxiliaire gauche / droite | PROCHAINE CONFÉRENCE / LE | `nextTitle` / `nextWhen` | Créer ses visuels avec l'IA / 12 nov. · 18 h 30 (sans réservation : « Aucune réservation » / « Réservez sur rendezvousia.fr ») |
| Verso | PROGRESSION | `progress` | Encore 40 volts pour Praticien |
| Verso | MEMBRE DEPUIS / CODE MEMBRE | `memberSince` / `memberCode` | mars 2026 / RVIA-NCY-1259 |
| Verso | PROCHAINE CONFÉRENCE (VERSO) | `nextFull` | jeu. 12 nov. 2026 · 18 h 30 · Lieu, Nancy |
| Verso | GAGNER DES VOLTS | `howTo` | texte commun du modèle, jamais envoyé par carte |

Design : fond `#3540D8`, valeurs `#FFFFFF`, libellés `#C9CCF4`, `organizationName` « Les RDV IA », QR = `https://rendezvousia.fr/carte/<code>`, **rien sous le QR** (`showBarcodeText: false`), lien verso `https://rendezvousia.fr/mon-espace`. Niveaux : 1 Curieux (0) · 2 Initié (200) · 3 Explorateur (450) · 4 Praticien (800) · 5 Expert (1300). La taille du texte d'un pass n'est pas réglable (Apple décide) ; seuls l'emplacement et la longueur des valeurs comptent.

---

## 6. État actuel (14/10/2026)

```
PASS_STUDIO_PASS_ID=jQ0aAThDn0sXxko4QNow
PASS_STUDIO_FIELD_KEYS='{"level":"field_1791982181955","volts":"field_1791982181956","progress":"field_1791982181961","memberName":"field_1791982181957","city":"field_1791982181958","nextTitle":"field_1791982181959","nextWhen":"field_1791982181960","nextFull":"field_1791982181964","memberSince":"field_1791982181962","memberCode":"field_1791982181963","howTo":"field_1791982181965"}'
PASS_STUDIO_ASSET_BASE_URL=https://raw.githubusercontent.com/Lucas-Dev15/Carte-Membre-VIP/1fd901d/public/wallet
```

- Pass « Carte membre Les RDV IA » : **seul pass actif**, publié. Pass archivés : `u697o0dkbcbCF5ZI8PPd` (test Fidélité), `5htAo57kdXVGyIxD8Gjo` (test Événement), `5QslM9Vd2MX3A03xsmsL` (test de reproduction), `EZoKOy3GMda3GRcFJTkD` (« Carte Membre VIP », ancien brouillon).
- Cartes émises :
  - `9ca73375-ba09-5c85-bb5d-eb287b5869fa` : **installée sur l'iPhone de Lucas** (carte anonyme `1002C86KBY` remplie avec les valeurs de Manon), **960 volts**, 4 · Praticien. Lien : `https://www.thepassstudio.com/i/CnZAm4SwQVTCqAAHM4S9zw`.
  - `0837b325-449e-5444-afa8-6c52b0498a91` : carte de Manon (`RVIA-NCY-1259`), 860 volts, installée nulle part. Lien : `https://www.thepassstudio.com/i/FMbIYIpTjNspwzTlzbdZAQ`.
  - `3ed39399…`, `62d08b68…` : révoquées.
- `.wallet-demo.json` (local, non versionné) : `{"instanceId":"0837b325-…","volts":860,"others":{"9ca73375-…":960}}`. S'il manque, passer `--instance <id> --from <volts>` au push.
- **Crédits : 31.**

---

## 7. Pièges à connaître

- **Lien de partage du pass / bouton « Ajouter » de l'éditeur = nouvelle carte anonyme à chaque ouverture (1 crédit)**, sans lien avec le membre ; les pushs visant une autre carte n'atteignent pas ce téléphone. Toujours vérifier avec `wallet:demo -- cards`.
- Un changement de design sur un pass publié n'atteint les téléphones qu'avec un push (`--push`, payant) ou au prochain push d'une carte.
- La notification affiche le message suivi de « — Oct 14, 2026 » : date ajoutée par The Pass Studio, en anglais (champ verso « DERNIÈRE MISE À JOUR »), non réglable par l'API.
- iOS peut garder l'ancienne icône en cache pour les notifications ; le pass servi contient bien la nouvelle (vérifiable dans le `.pkpass`).
- Apple tronque « Les RDV IA » en haut quand le champ d'en-tête (NIVEAU) est long.
- L'aperçu de l'éditeur montre les valeurs du **modèle**, pas celles d'une carte ; la page de partage floute les brouillons.
- `wallet:setup` sans `PASS_STUDIO_PASS_ID` renvoie le pass déjà créé (idempotence) ; `PASS_STUDIO_CREATE_ID` pour en créer un autre.
- Erreurs utiles : 400 `unknown_field_key` (clé inconnue : rien n'est appliqué), 409 `pass_not_active` (émission sur un brouillon), 402 `insufficient_credits`, 422 `asset_fetch_failed` (image injoignable).

---

## 8. Points ouverts

1. Vérifier si le lien `/i/<shareToken>` d'une carte émise installe bien **cette** carte (lors du test, l'iPhone a reçu une carte anonyme ; on ne sait pas quel lien a été ouvert). Si ce lien crée une nouvelle carte, le signaler à The Pass Studio avant le lancement.
2. Mettre `rendezvousia.fr` en ligne, puis servir les images depuis `/wallet/…` (retirer `PASS_STUDIO_ASSET_BASE_URL` et lancer `wallet:setup -- --design`). Aujourd'hui le QR et le lien du verso ne mènent nulle part.
3. Vérifier le rendu Google Wallet sur Android (jamais testé).
4. Remplacer le lieu de démo `[Lieu partenaire]`.
5. Brancher la base de données, l'authentification et l'envoi d'e-mails (voir README).

---

## 9. Règles de travail

- Commits en français sur `claude/confident-euler-5m0jhm`, push après chaque étape, pas de PR sans demande.
- `npm run typecheck` et `npm test` avant chaque commit.
- Une image modifiée doit être committée et poussée avant d'être utilisée (URL épinglée sur le nouveau commit dans `PASS_STUDIO_ASSET_BASE_URL`).
- Tester sur un brouillon (gratuit) avant le pass publié ; annoncer le coût en crédits et attendre l'accord de Lucas avant une publication ou un envoi payant.
