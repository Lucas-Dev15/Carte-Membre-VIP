# Prompt de reprise — Carte membre « Les RDV IA » sur The Pass Studio

> À coller tel quel dans une nouvelle conversation avec Claude.

---

Tu reprends l'intégration wallet (Apple Wallet / Google Wallet) de la carte membre « Les RDV IA », faite avec **The Pass Studio** (API `https://www.passstudio.online/api/v1`, doc : https://www.thepassstudio.com/docs/integrations). Lis d'abord `README.md` et `docs/SPEC_CARTE_MEMBRE_WALLET.md` du dépôt `Lucas-Dev15/Carte-Membre-VIP` (branche `claude/confident-euler-5m0jhm`, partie de `claude/beautiful-cori-iwrxce`). Réponds-moi en français.

## Contexte du projet

- Next.js 15 + TypeScript, tests Vitest (`npm test`, 28 tests), typecheck `npm run typecheck`.
- Tout l'accès à l'API passe par `lib/wallet/passstudio.ts`. Les champs du pass sont calculés dans `lib/wallet/fields.ts` (niveaux : `levels.ts`, dates FR : `format.ts`), le design dans `lib/wallet/design.ts`.
- Scripts : `npm run wallet:setup` (crée / vérifie / publie le modèle, propose `PASS_STUDIO_FIELD_KEYS`) et `npm run wallet:demo -- issue | push | revoke` (carte de démo de Manon Blanc, état dans `.wallet-demo.json`, non versionné).
- La clé API est dans la variable d'environnement `PASS_STUDIO_API_KEY` (`ps_live_…`, compte de Lucas JUAN, plan free). Ne l'écris jamais dans un fichier ni dans un commit.

## État actuel (14/10/2026)

**Pass publié (seul actif)** : « Carte membre Les RDV IA », type **Custom**, distribution `unique`.

```
PASS_STUDIO_PASS_ID=jQ0aAThDn0sXxko4QNow
PASS_STUDIO_FIELD_KEYS='{"level":"field_1791982181955","volts":"field_1791982181956","progress":"field_1791982181961","memberName":"field_1791982181957","city":"field_1791982181958","nextTitle":"field_1791982181959","nextWhen":"field_1791982181960","nextFull":"field_1791982181964","memberSince":"field_1791982181962","memberCode":"field_1791982181963","howTo":"field_1791982181965"}'
PASS_STUDIO_ASSET_BASE_URL=https://raw.githubusercontent.com/Lucas-Dev15/Carte-Membre-VIP/1fd901d/public/wallet
```

**Mise en page Apple (validée par Lucas, « c'était mieux avant »)** :
- en-tête : NIVEAU (`3 · Explorateur`) ;
- principal : MES VOLTS (grand), éclair en vignette à droite (`rdvia-thumbnail-270.png`) ;
- secondaires : MEMBRE (gauche), VILLE (droite) ;
- auxiliaires : PROCHAINE CONFÉRENCE (gauche), LE (droite, `12 nov. · 18 h 30`, sinon `Réservez sur rendezvousia.fr`) ;
- verso : PROGRESSION, MEMBRE DEPUIS, CODE MEMBRE, PROCHAINE CONFÉRENCE (VERSO), GAGNER DES VOLTS.
- QR = URL `https://rendezvousia.fr/carte/<code>`, **rien sous le QR** (`showBarcodeText: false`).
- Les valeurs par défaut du modèle sont des **valeurs de test** (celles de Manon : 760 volts, Nancy…) pour que l'aperçu de l'éditeur soit rempli ; chaque carte émise reçoit toujours ses 10 valeurs propres. GAGNER DES VOLTS est une valeur du modèle (jamais envoyée par porteur).

**Design** : fond `#3540D8`, valeurs `#FFFFFF`, libellés `#C9CCF4`, `organizationName` = « Les RDV IA ».
- Logo (haut gauche) : `public/wallet/rdvia-logo-rvia-150.png` = logo « Rendez-vous IA » fourni par Lucas (original : `assets-src/rdvia-logo-rendez-vous-ia.webp`), **détouré de blanc**, sinon son « D » bleu disparaît sur le fond bleu.
- Icône (notifications) : `public/wallet/rdvia-icon-rvia-1024.png` = même logo sur fond blanc carré. Validée sur iPhone.
- Bandeau `rdvia-strip-1125x432.png` : laissé sur le pass, **Apple ne l'affiche pas sur un pass Custom**, Google Wallet l'utilise comme image principale.

**Cartes émises sur le pass** :
- `9ca73375-ba09-5c85-bb5d-eb287b5869fa` : **installée sur l'iPhone de Lucas** (code `1002C86KBY`, lien `https://www.thepassstudio.com/i/CnZAm4SwQVTCqAAHM4S9zw`), valeurs de Manon, **960 volts**, niveau 4 · Praticien. C'est elle qu'il faut viser pour une démo de notification.
- `0837b325-449e-5444-afa8-6c52b0498a91` : carte de Manon émise par `wallet:demo -- issue` (`RVIA-NCY-1259`, lien `https://www.thepassstudio.com/i/FMbIYIpTjNspwzTlzbdZAQ`), 860 volts, **installée sur aucun téléphone**.
- `3ed39399…` et `62d08b68…` : cartes anonymes de test, **révoquées**.

**Autres pass** (archivés, l'API ne sait pas supprimer : `DELETE /passes/{id}` → 405) : `u697o0dkbcbCF5ZI8PPd` (test Fidélité), `5htAo57kdXVGyIxD8Gjo` (test Événement), `EZoKOy3GMda3GRcFJTkD` (« Carte Membre VIP », brouillon antérieur). Suppression réelle possible seulement dans l'éditeur.

**Crédits** : 31 restants (50 au départ). Coûts : publication 10 (une fois), émission 1, push 1 par carte, mise à jour de design poussée = 1 par push ; révocation, archivage, brouillons et enregistrements avec `push: false` gratuits. Vérifie toujours le solde avec `GET /me` (`billing.credits`) avant et après une action payante, et demande l'accord de Lucas avant toute dépense notable (publication, envoi en masse).

## Ce qui a été fait, et comment

1. **Clé et crédits** vérifiés par `GET /me`.
2. **Images** : `rendezvousia.fr` ne résout pas (NXDOMAIN), The Pass Studio ne pouvait pas télécharger les images. Ajout de `PASS_STUDIO_ASSET_BASE_URL` (lu par `scripts/wallet/setup-pass.ts`, passé à `passDesign(siteUrl, assetBaseUrl)`) : les images sont servies par `raw.githubusercontent.com`, épinglées sur un commit (le dépôt est public). Pour changer une image : committer et pousser le PNG, puis `PATCH /passes/{id}` avec `design.<slot>Url` pointant sur le commit. The Pass Studio télécharge, vérifie, redimensionne et stocke (il garde la transparence).
3. **Choix du type de pass** (tests sur brouillons gratuits) :
   - Custom (= `generic` côté Apple) : champs libres, mais **pas de bandeau sur Apple**.
   - Fidélité (`storeCard`) : bandeau, mais 8 clés fixes (`memberName`, `memberId`, `points`, `tier`, `expiryDate`, `programText`, `rewardLine`, `rewardCode`) aux libellés imposés ; `design.labels` et `design.extraFields` → 400 « not supported on a loyalty pass ».
   - Événement : accepte `design.labels` et `design.extraFields` (`{key?, label, value, position: front|back}`), mais c'est un billet.
   - Lucas a choisi **Custom sans bandeau** (aperçus : `docs/option-custom.png`, `docs/option-loyalty.png`).
4. **Création des champs d'un pass Custom par l'API** (non documentée) : la doc dit que le jeu de champs se règle dans l'éditeur. En lisant le code public de la page de partage (`https://www.thepassstudio.com/share/…`, chunk qui construit le `pass.json`), on voit que pour `passType: "custom"`, `design.fields` est un tableau de lignes `{ key, label, value, position }` avec `position` ∈ `header | primary | secondary | auxiliary | back`, mappées sur `generic.headerFields / primaryFields / …`, et que `logoText` = `organizationName`. On écrit donc ces lignes par `PATCH /passes/{id}` (`{"design":{"fields":[…]}}`) ; les clés suivent le format de l'éditeur (`field_<horodatage ms>`). **Pour déplacer un champ, relire `design.fields` par `GET /passes/{id}`, changer `position`/`value` en gardant les mêmes `key`, et renvoyer le tableau complet** : `PASS_STUDIO_FIELD_KEYS` reste valable. Sans `key`, la ligne est stockée avec une clé `undefined` : inutilisable.
5. **Publication** : `npm run wallet:setup -- --publish` avec `PASS_STUDIO_PASS_ID` et `PASS_STUDIO_FIELD_KEYS` (10 crédits).
6. **Émission** : `npm run wallet:demo -- issue` (sans e-mail, `sendInviteEmail: false` sur le pass). Vérification en téléchargeant le `.pkpass` (`…/api/i/<shareToken>/download?platform=apple&raw=1`) et en lisant `pass.json` (champs, `webServiceURL`, images).
7. **Push** : `PATCH /instances/fields` avec `fields` (clés réelles), `message` (notification) et `externalRef` unique. `scripts/wallet/demo.ts` pousse désormais tous les champs en un seul push.
8. **Mises en page essayées puis abandonnées** : niveau sous les volts, VILLE au verso, date courte (commit `9e4c56a`, annulé par `85d8c8d`). Lucas préfère la disposition actuelle.

## Pièges rencontrés

- **Le lien de partage du pass et le bouton « Ajouter » de l'éditeur créent une nouvelle carte anonyme à chaque ouverture (1 crédit)**, sans lien avec le membre. Les pushs visant la carte de Manon n'atteignaient donc jamais l'iPhone. Avant tout push de démo, lister `GET /passes/{id}/instances` et viser celle dont `stage` = `installed` et `wallets` contient `apple`. Non confirmé : si le lien `/i/<shareToken>` d'une carte émise crée lui aussi une nouvelle carte, c'est un problème à signaler à The Pass Studio avant le lancement.
- Un changement de design sur un pass actif est poussé à tous les porteurs (payant) sauf avec `"push": false` ; dans ce cas le téléphone ne le reçoit qu'au prochain push.
- La notification Apple affiche le `message` suivi de « — Oct 14, 2026 » (date ajoutée par The Pass Studio, en anglais, champ verso « DERNIÈRE MISE À JOUR ») : impossible à retirer par l'API.
- Apple tronque `logoText` (« Les RDV IA ») quand un champ d'en-tête est présent ; la taille de police d'un pass n'est pas réglable.
- La page de partage floute les brouillons ; l'aperçu de l'éditeur montre les valeurs du modèle, pas celles d'une carte.

## Points ouverts

1. Confirmer quel lien Lucas a ouvert pour installer la carte (voir piège ci-dessus).
2. `rendezvousia.fr` hors ligne : QR et lien du verso ne mènent nulle part ; une fois le site en ligne, servir les images depuis `/wallet/…` et retirer `PASS_STUDIO_ASSET_BASE_URL`.
3. Rendu Google Wallet jamais vérifié sur Android.
4. Lieu de la conférence de démo : `[Lieu partenaire]` (placeholder).
5. Base de données, authentification et e-mails restent à brancher (voir README).

## Règles de travail

- Commits sur `claude/confident-euler-5m0jhm`, push après chaque étape, pas de PR sans demande.
- Lancer `npm run typecheck` et `npm test` avant chaque commit.
- Toujours tester sur un brouillon (gratuit) avant de toucher au pass publié, et annoncer le coût en crédits avant une action payante.
