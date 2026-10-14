# Carte membre « Les RDV IA » — Wallet

Carte membre virtuelle (site) + pass Apple Wallet / Google Wallet généré et mis à jour via
**The Pass Studio**. Spécification complète : [`docs/SPEC_CARTE_MEMBRE_WALLET.md`](docs/SPEC_CARTE_MEMBRE_WALLET.md).

![Aperçu de l'espace membre](docs/apercu-mon-espace.png)

## Démarrer

```bash
npm install
cp .env.example .env.local   # renseigner les variables (voir ci-dessous)
npm run dev                  # http://localhost:3000/mon-espace
npm test                     # 28 tests (champs, formats, client API, file de synchro, webhooks, révocation)
```

Sans base de données, l'application tourne sur un dépôt en mémoire pré-rempli avec le membre de la
maquette (Manon Blanc, `RVIA-NCY-1259`). Sans clé The Pass Studio, la carte web s'affiche et
`/api/wallet/add` répond 503.

## Variables d'environnement (serveur uniquement)

| Variable | Rôle |
|---|---|
| `PASS_STUDIO_API_KEY` | clé `ps_live_…` (portée restreinte au pass membre si possible). Clé du pass de test en dev. |
| `PASS_STUDIO_PASS_ID` | identifiant du modèle, affiché par `npm run wallet:setup` |
| `PASS_STUDIO_WEBHOOK_SECRET` | secret de signature des webhooks |
| `PASS_STUDIO_BASE_URL` | `https://www.passstudio.online/api/v1` |
| `PASS_STUDIO_FIELD_KEYS` | correspondance JSON nos clés → clés réelles du pass (proposée par `wallet:setup`) |
| `PUBLIC_SITE_URL` | `https://rendezvousia.fr` (URL des QR et des images du pass) |
| `WALLET_PUSH_INTERVAL_MS` | espacement entre deux pushs : 250 ms = 240 appels/min, sous la limite de 600/min par clé |
| `CRON_SECRET` | protège `POST /api/cron/wallet-sync` |

Aucune n'a le préfixe `NEXT_PUBLIC_` ; `lib/wallet/config.ts` refuse d'être chargé côté navigateur.
Le build a été vérifié : ni la clé ni l'URL de l'API ne figurent dans `.next/static`.

## Création du modèle de pass

1. Héberger `public/wallet/*.png` en https public (servis par le site : `https://rendezvousia.fr/wallet/…`).
   The Pass Studio télécharge les images, les vérifie et les redimensionne (icône 87×87, logo ≤ 480×150, bandeau 1125×432).
2. Créer le modèle **dans l'éditeur The Pass Studio**, en type **Custom**, distribution `unique`, sans texte sous le QR,
   avec le design de `lib/wallet/design.ts`. Placer les champs du §3.3 avec exactement ces libellés :
   NIVEAU, MES VOLTS, PROGRESSION, MEMBRE, VILLE, PROCHAINE CONFÉRENCE, LE, MEMBRE DEPUIS, CODE MEMBRE,
   PROCHAINE CONFÉRENCE (VERSO), GAGNER DES VOLTS.
   (`npm run wallet:setup` sans `PASS_STUDIO_PASS_ID` crée le brouillon par l'API, mais les champs se placent dans l'éditeur.)
3. `PASS_STUDIO_PASS_ID=… npm run wallet:setup` : masque le texte sous le QR, désactive l'e-mail d'invitation de The Pass Studio, liste les clés
   du pass, les retrouve par leur libellé et affiche la valeur de `PASS_STUDIO_FIELD_KEYS` à mettre dans l'environnement.
4. `npm run wallet:setup -- --set-howto` écrit le texte « Gagner des volts » (champ commun à tous, 1 crédit).
5. `npm run wallet:setup -- --publish` publie le modèle (**10 crédits**, une seule fois).
6. Développement : un second pass de test, avec sa propre clé API restreinte à ce pass
   (Settings → API Keys → « Restricted to passes »).

## Architecture

| Fichier | Rôle |
|---|---|
| `lib/wallet/passstudio.ts` | **seul** client HTTP The Pass Studio (issue, `PATCH /instances/fields`, revoke…) |
| `lib/wallet/fields.ts` | calcul des champs du pass depuis notre base + hash anti-push inutile |
| `lib/wallet/levels.ts`, `format.ts`, `code.ts` | niveaux, dates FR (Europe/Paris), code `RVIA-XXX-0000` |
| `lib/wallet/service.ts` | création de carte, émission, file de synchro (regroupement 2 min, priorité des notifications, 202/402/5xx), webhooks, révocation |
| `lib/wallet/webhook.ts` | vérification HMAC sur corps brut, fenêtre 5 min, temps constant |
| `lib/wallet/repository.ts` | interface d'accès aux données — à implémenter sur `db/schema.sql` |
| `components/MemberCard.tsx` | carte web 3D (§2.2), animations coupées par `prefers-reduced-motion` |
| `components/WalletPreview.tsx` | aperçu du pass dans un cadre de téléphone 270 × 540 |
| `app/mon-espace` | espace membre : carte, boutons wallet, aperçu |
| `app/admin/membres/[memberId]` | fiche admin : carte, code, wallet utilisé, copier / renvoyer / révoquer |
| `app/carte/[code]` | page du QR (selon le rôle, neutre sinon, limitée en débit, jamais de pointage) |
| `app/api/wallet/add` | redirection vers Apple / Google (émission au premier clic si besoin) |
| `app/api/webhooks/passstudio` | `pass.issued` / `pass.updated` / `pass.removed` |
| `app/api/cron/wallet-sync` | relance les jobs en attente de crédits si le solde le permet (`GET /me`), puis traite la file — à appeler chaque minute |

### Brancher les événements métier

Après écriture en base, appeler :

- `onVoltsAwarded(ctx, memberId, { before, after, source })` — `attendance` / `referral` notifient, le reste est silencieux ; le passage de niveau notifie et prime ;
- `onBookingConfirmed(ctx, memberId, { conferenceTitle, startsAt })` ;
- `onSilentChange(ctx, memberId, "booking_cleared" | "profile")` — annulation, conférence passée, nom, ville ;
- `createCardForMember(ctx, memberId)` à l'inscription ; `cardEmailBlock()` dans les e-mails (bienvenue, réservation, J-3, renvoi).

## Test sur téléphone

1. Déployer en https (les URLs des images et de `/carte/…` doivent être publiques).
2. Se connecter sur iPhone → `/mon-espace` → « Ajouter à Apple Wallet ». Comparer avec `docs/rdvia-rendu-cible-apple-wallet.png`.
3. Même chose sur Android → Google Wallet, faire une capture.
4. Vérifier que la fiche admin passe à « Apple Wallet » / « Google Wallet » (webhook `pass.issued`), puis « Non ajoutée » après suppression.

## Écarts et points à valider

Vérifié dans la documentation The Pass Studio (integrations, errors, rate-limits, billing, events) le 14/10/2026.

**Confirmé par la doc :** `Authorization: Bearer`, chemins des appels, publication par `PATCH /passes/{id}`
(`status: "active"`, 10 crédits), réponses `{ pass: … }`, erreurs `{ error, code, requestId, retryable }`,
`artifacts.appleWalletUrl / googleWalletUrl`, 202 = push sauté faute de crédits (ref consommée → nouvelle ref),
402 = rien appliqué (même ref), signature des webhooks (horodatage en secondes), 5 tentatives puis désactivation.

**Corrigé suite à la lecture de la doc :**
- `locations` : 1 à 10 lieux, ou `null` pour les retirer (`[]` n'est pas accepté).
- 500 : réessayé seulement s'il porte `retryable: true` ; 429 : on attend `Retry-After` (limite : 600 requêtes/min par clé).
- `passId` des webhooks lu à la racine de l'événement.
- Les crédits rechargés sont détectés par `GET /me` (`billing.credits`) et les jobs en attente relancés.
- `sendInviteEmail: false` sur le pass : The Pass Studio n'envoie jamais d'e-mail, c'est notre plateforme qui le fait.
- Nos propres `X-Request-Id` (`rdvia_sync_…`, `rdvia_issue_…`) sont envoyés pour relier nos journaux aux leurs.

**Décisions prises :**

1. **Type de pass : Custom** (validé). Les types structurés (loyalty, coupon, event, generic) n'acceptent que des clés
   documentées (`memberName`, `points`, `tier`…) ; seul Custom permet nos 11 champs libres. Ses clés sont générées
   par l'éditeur (`field_1787677019449`), d'où `PASS_STUDIO_FIELD_KEYS`. Une clé inconnue fait échouer tout l'appel
   (400 `unknown_field_key`) : rien ne part à moitié rempli. À vérifier dans l'éditeur : le placement en-tête /
   principal sur le bandeau / secondaires / auxiliaires / verso.
2. **Rien sous le QR** (validé) : `showBarcodeText: false`. La doc n'a pas de texte alternatif ; ce serait l'URL.
   Le QR encode l'URL de la carte, le code `RVIA-…` figure au verso (CODE MEMBRE).

**Choix techniques à connaître :**

3. **Carte régénérée.** L'émission est dédoublonnée par e-mail **avant** le `customerId`. Avec le même e-mail,
   l'API pourrait renvoyer l'ancienne instance révoquée. Une carte régénérée est donc émise **sans e-mail**, avec
   `customerId = member_<id>_<nouveau code>` (la 1re carte garde `member_<id>` + e-mail, conformément à la spec).
4. **Pass de test en brouillon : impossible.** Un brouillon ne peut pas émettre (409 `pass_not_active`). Le pass de
   test doit être publié (10 crédits) ; on l'isole avec une clé API restreinte à ce pass.
5. **`barcodeType`** : la doc ne liste pas les valeurs ; on laisse l'éditeur choisir QR code.
6. **Libellé de `progress`.** La maquette met « Encore 40 pour Praticien » dans le libellé de MES VOLTS. Un libellé
   est fixe : `progress` est un champ séparé (PROGRESSION), sous le chiffre ou en secondaire.

Écarts côté produit :

- **Paliers de niveau** (proposés, `lib/wallet/levels.ts`) : 1 Curieux (0) · 2 Initié (200) · 3 Explorateur (450) ·
  4 Praticien (800) · 5 Expert (1300). Une soirée complète rapporte environ 135 volts.
- **Badges wallet officiels** : le badge Google Wallet français officiel est inclus. Le badge Apple se télécharge
  depuis un compte Apple Developer (developer.apple.com/wallet/add-to-apple-wallet-guidelines) : le déposer en
  `public/wallet/badges/add-to-apple-wallet-fr.svg` et passer `APPLE_BADGE_AVAILABLE` à `true`. Bouton provisoire d'ici là.
- **Authentification, base de données et envoi d'e-mails** : le dépôt était vide. Points de branchement :
  `lib/app/auth.ts` (session et rôles), `lib/wallet/repository.ts` + `db/schema.sql`, `TODO` e-mail dans les routes admin.
- **Polices** : Inter / Inter Tight chargées depuis Google Fonts.
- Heures pile affichées « 9 h » (et non « 9 h 00 »).
- Les écarts inévitables du §3.4 (volts en blanc, pas de barre de progression ni d'animation dans le pass, mise en page Google) s'appliquent.
- Coûts : 1 crédit par émission, 1 crédit par push par porteur (un pointage de 80 présents ≈ 80 crédits), révocations et webhooks gratuits.
