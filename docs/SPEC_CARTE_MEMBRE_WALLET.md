# Carte membre & wallet — « Les RDV IA »
### Spécification pour Claude Code — intégration The Pass Studio

Tu vas implémenter la carte membre virtuelle des « Rendez-vous IA » : la carte affichée sur le site (espace membre et fiches admin) et le pass ajoutable à Apple Wallet et Google Wallet, généré et mis à jour via l'API de The Pass Studio.

Documentation de référence, à lire avant d'écrire du code : https://www.thepassstudio.com/docs/integrations (et les pages liées : errors, rate-limits, billing).

Règles de travail :
- Notre base de données est la source de vérité (volts, niveau, réservations, code membre). The Pass Studio sert uniquement à fabriquer, distribuer et mettre à jour les passes. N'utilise pas le moteur de points ou de paliers de The Pass Studio (`/loyalty/points`, `holder.tier_changed`) : nous poussons simplement des valeurs de champs.
- Si un point de cette spécification ne correspond pas à ce que l'API ou l'éditeur de The Pass Studio permettent réellement, ne l'invente pas : signale-le, propose l'alternative la plus proche et attends ma validation.
- Toute la communication avec The Pass Studio se fait côté serveur. La clé API ne doit jamais apparaître côté client.

---

## 1. Ce que fait la carte (fonctionnalités)

1. **Création automatique.** À la création d'un compte membre, une carte est créée avec un code unique et un QR code personnel. Le pass wallet est émis en même temps (ou au premier clic sur « Ajouter au wallet », voir §6.2).
2. **Code membre.** Format `RVIA-[CODE VILLE D'ORIGINE]-[4 chiffres]`, par exemple `RVIA-NCY-1259`. Le code est généré de façon unique, n'est jamais réattribué et reste stable même si le membre change de ville d'origine.
3. **QR code.** Il encode l'URL de la carte, par exemple `https://rendezvousia.fr/carte/RVIA-NCY-1259`. Il ne contient aucune donnée personnelle.
   - Si un partenaire de la ville ou un super-admin connecté le scanne, l'URL ouvre la fiche du membre (identification à l'accueil).
   - Pour toute autre personne, elle affiche une page neutre : logo, « Carte membre Les RDV IA », lien vers le site. Aucune donnée personnelle n'y figure.
   - Le scan ne pointe **jamais** une présence. Le pointage reste manuel.
4. **Ajout au wallet.** Dans l'espace membre, deux boutons : « Ajouter à Apple Wallet » et « Ajouter à Google Wallet ».
5. **Mise à jour automatique.** Le pass se met à jour tout seul quand les volts, le niveau ou la prochaine conférence réservée changent. Certaines mises à jour affichent une notification (§7).
6. **Rappel de proximité.** Quand le membre a une conférence réservée, le pass apparaît sur l'écran verrouillé de l'iPhone à proximité du lieu de la soirée (lien Itinéraire sur Android) (§7.3).
7. **Côté admin** (partenaire de la ville et super-admin), dans la fiche membre :
   - la carte du membre, avec le même design 3D que dans l'espace membre ;
   - son code ;
   - le wallet utilisé : « Apple Wallet », « Google Wallet » ou « Non ajoutée » ;
   - les boutons « Copier le code » et « Renvoyer la carte par e-mail ».
8. **Super-admin** : il peut révoquer et régénérer une carte. L'ancien code devient invalide, un nouveau code et un nouveau pass sont émis. L'action est journalisée (qui, quand, pourquoi).
9. **E-mails.** La carte (code et liens wallet) figure dans l'e-mail de bienvenue, dans l'e-mail de confirmation de réservation, dans l'e-mail J-3 et dans l'e-mail « Renvoi de la carte ».

---

## 2. Design de référence (identique à la maquette)

### 2.1 Charte

| Élément | Valeur |
|---|---|
| Bleu principal (fond) | `#3540D8` |
| Dégradé de la carte | `linear-gradient(135deg, #3540D8 0%, #2A33B8 45%, #1E2393 100%)` |
| Jaune « volt » (éclair, pastille) | `#F9B233` |
| Texte | `#FFFFFF` |
| Libellés (petites capitales) | `#C9CCF4`, 8 à 10 px, majuscules, interlettrage 1 px |
| Texte secondaire | `#E1E3FB` |
| Code membre (carte web) | `#FFE7A8`, police monospace, gras, interlettrage 1,6 px |
| Encre QR | `#111114` sur fond `#FFFFFF` |
| Titres | Inter Tight 800 |
| Texte courant | Inter 400 à 700 |
| Logo | carré arrondi jaune `#F9B233` avec un éclair noir `#111114` (path SVG `M13 2L4 14h7l-1 8 9-12h-7z`), suivi du texte « Les RDV IA » |

Le libellé sur le pass wallet est **« Les RDV IA »**, jamais « Les rendez-vous IA ».

### 2.2 Carte sur le site (espace membre et fiche membre admin)

Format carte bancaire : `aspect-ratio: 1.586`, largeur max 340 px, `border-radius: 18px`, fond en dégradé (§2.1), ombre `0 30px 50px -24px rgba(30,35,147,.75)` et liseré intérieur `inset 0 0 0 1px rgba(255,255,255,.14)`.

Couches, du fond vers le dessus :
1. Trame de points : `radial-gradient(rgba(255,255,255,.16) 1.4px, transparent 1.5px)`, taille 14 × 14 px.
2. Grand éclair jaune en filigrane, en haut à droite : 170 px, opacité 0,12, décalé de −26 px à droite et −18 px en haut.
3. Reflet qui balaie la carte : bande blanche à 22 % d'opacité, inclinée de −18°, animation de 5 s en boucle.
4. Brillance qui suit la souris : `radial-gradient` centré sur les variables CSS `--mx` et `--my`.
5. Contenu, en `translateZ(30px)` :
   - en haut : le logo (carré jaune de 24 px et « Les rendez-vous IA ») à gauche, et une pastille ville à droite (« NANCY », 9 px, majuscules, fond blanc à 16 %, bordure blanche à 30 %) ;
   - en bas à gauche, de haut en bas :
     - une pastille jaune « ⚡ 760 volts · Niv. 3 Explorateur » ;
     - le nom (Inter Tight 800, 19 px, tronqué avec des points de suspension) ;
     - « Membre depuis mars 2026 » (10 px, `#C9CCF4`) ;
     - le code `RVIA-NCY-1259` (monospace, `#FFE7A8`) ;
   - en bas à droite : le QR code sur un carré blanc (27 % de la largeur, rayon 9 px, padding 5 px).

Animations, à désactiver avec `prefers-reduced-motion: reduce` :
- **Flottement** : 6 s en boucle, `translateY(0 → −8px)`, `rotateX(5° → −3°)`, `rotateY(−7° → 7°)`, avec une perspective de 1100 px. Il se met en pause au survol.
- **Inclinaison 3D au survol** : `rotateX((0,5 − y) × 16°)`, `rotateY((x − 0,5) × 22°)`, `scale(1.03)`, avec une transition de 0,18 s. Retour à plat quand la souris sort.
- Sur mobile : flottement seul, sans inclinaison.

Sous la carte : les boutons wallet (§6.2), puis la phrase « Votre carte se met à jour toute seule dans le wallet : volts, niveau et prochaine conférence. Code personnel : RVIA-NCY-1259 ».

À côté (ou en dessous sur mobile) : l'**aperçu du pass dans le wallet**, dans un cadre de téléphone de 270 × 540 px, conforme au rendu de §3.

### 2.3 Pass wallet : ce que montre la maquette

De haut en bas :
1. Logo « Les RDV IA » à gauche ; à droite, « NIVEAU » et « 3 · Explorateur ».
2. « MES VOLTS », puis « ⚡ 760 » en grand et en jaune, une barre de progression jaune et « Encore 40 volts pour Praticien ».
3. « MEMBRE » : Manon Blanc ; « VILLE » : Nancy.
4. « PROCHAINE CONFÉRENCE » : titre, puis « jeu. 12 nov. · 18 h 30 · Nancy ».
5. Zone blanche avec le QR code et le code `RVIA-NCY-1259`.

---

## 3. Du design de la maquette au pass réel

Apple Wallet et Google Wallet imposent une mise en page fixe : on choisit des couleurs, des images et des champs (libellé + valeur), pas du CSS libre. Voici la correspondance à appliquer pour rester au plus près de la maquette. Le rendu visé est l'image `rdvia-rendu-cible-apple-wallet.png` fournie avec ce document.

### 3.1 Type de pass

`passType: "loyalty"`, qui correspond à une carte de fidélité (store card) côté Apple et donne :
- un grand champ principal par-dessus le bandeau image ;
- un code QR ;
- une mise à jour par porteur.

Si l'éditeur de The Pass Studio ne permet pas de placer les champs comme au §3.3 avec ce type, essaie `custom` et dis-moi ce que tu as choisi.

`distributionMode: "unique"` : un pass par membre.

### 3.2 Design (`design`)

| Clé | Valeur |
|---|---|
| `backgroundColor` | `#3540D8` |
| `foregroundColor` | `#FFFFFF` (valeurs) |
| `labelColor` | `#C9CCF4` (libellés) |
| `organizationName` | `Les RDV IA` |
| `description` | `Carte membre Les RDV IA` |
| `logoUrl` | `rdvia-logo-480x150.png` : carré jaune à éclair et « Les RDV IA » en blanc, fond transparent |
| `iconUrl` | `rdvia-icon-87x87.png` : éclair sur carré jaune, fond bleu (icône des notifications) |
| `stripImageUrl` | `rdvia-strip-1125x432.png` : dégradé bleu, trame de points, grand éclair jaune en filigrane, identique à la carte web |
| `barcodeType` | QR code (prends la valeur exacte indiquée par la doc ou l'éditeur) |
| `showBarcodeText` | `true`, pour afficher le code sous le QR |
| `backWebsiteUrl` | `https://rendezvousia.fr/mon-espace` |
| `holderPhotoStrip` | `null`, car la maquette n'a pas de photo |
| `originalLanguage` | `fr` |

Les images doivent être hébergées en **https public**, en PNG (pas de SVG ni de `data:`). Héberge-les sur notre domaine, par exemple `https://rendezvousia.fr/wallet/…`.

### 3.3 Champs du pass (clés à créer dans l'éditeur The Pass Studio)

| Emplacement (Apple) | Clé | Libellé | Exemple de valeur | Source |
|---|---|---|---|---|
| En-tête (à droite du logo) | `level` | NIVEAU | `3 · Explorateur` | niveau calculé sur les volts cumulés |
| Principal (sur le bandeau, en grand) | `volts` | MES VOLTS | `760` | volts cumulés |
| Libellé ou ligne du principal | `progress` | — | `Encore 40 volts pour Praticien` (au niveau max : `Niveau maximum atteint`) | calculé |
| Secondaire gauche | `memberName` | MEMBRE | `Manon Blanc` | profil |
| Secondaire droite | `city` | VILLE | `Nancy` | ville d'origine |
| Auxiliaire gauche | `nextTitle` | PROCHAINE CONFÉRENCE | `Créer ses visuels avec l'IA` (sinon `Aucune réservation`) | prochaine réservation confirmée |
| Auxiliaire droite | `nextWhen` | LE | `12 nov. · 18 h 30` (sinon `Réservez sur rendezvousia.fr`) | idem |
| Verso | `memberSince` | MEMBRE DEPUIS | `mars 2026` | date de création du compte |
| Verso | `memberCode` | CODE MEMBRE | `RVIA-NCY-1259` | code |
| Verso | `nextFull` | PROCHAINE CONFÉRENCE | `jeu. 12 nov. 2026 · 18 h 30 · [Lieu], Nancy` | réservation |
| Verso | `howTo` | GAGNER DES VOLTS | `Présence +100 · Questionnaire +20 · Replay +15 · Réservation anticipée +10. Vous ne perdez jamais un volt.` | statique |

- `barcodeValue` contient l'URL de la carte, par exemple `https://rendezvousia.fr/carte/RVIA-NCY-1259`. Le texte affiché sous le QR doit être le **code** (`RVIA-NCY-1259`), pas l'URL. Si The Pass Studio affiche forcément la valeur encodée, garde l'URL dans le QR et dis-le-moi.
- `level`, `volts`, `progress`, `memberName`, `city`, `nextTitle`, `nextWhen`, `nextFull`, `memberSince` et `memberCode` sont des champs **par porteur**, mis à jour avec `PATCH /instances/fields`.
- `howTo` est un champ du **modèle**, géré au niveau du pass (`templateOwnedFieldKeys`).
- Format des dates : français, sans zéro initial (« 12 nov. · 18 h 30 »), fuseau `Europe/Paris`.

### 3.4 Écarts inévitables avec la maquette (à accepter)

- **Volts en jaune** : Apple Wallet applique une seule couleur à toutes les valeurs. Les volts seront donc en blanc, en grand, sur le bandeau bleu. Le jaune reste présent par l'éclair du bandeau et par le logo.
- **Barre de progression** : impossible de la dessiner dynamiquement dans un pass. Elle est remplacée par le texte « Encore 40 volts pour Praticien ».
- **Animations 3D, reflet, flottement** : uniquement sur la carte du site. Le pass wallet est statique.
- **Google Wallet** : The Pass Studio convertit le pass au format Google. Couleurs, logo, image principale (le bandeau), champs et QR sont repris, mais la disposition est celle de Google. Vérifie le rendu Google et fais-moi une capture.

---

## 4. Données (base de données)

Table `member_cards` :
- `id`, `member_id` (unique pour une carte active) ;
- `code` (unique, jamais réutilisé), `qr_url` ;
- `status` : `active` | `revoked` ;
- `created_at`, `revoked_at`, `revoked_by`, `revoke_reason`.

Table `wallet_passes` (une ligne par carte) :
- `card_id`, `ps_pass_id` (modèle The Pass Studio), `ps_instance_id`, `barcode_content` ;
- `add_to_wallet_url`, `apple_wallet_url`, `google_wallet_url` ;
- `platform` : `apple` | `google` | `null` (mis à jour par webhook) ;
- `installed` (booléen), `last_fields_hash`, `last_pushed_at`, `last_push_status`, `last_error`.

Table `wallet_sync_jobs` (file d'attente) : `card_id`, `reason`, `message` (facultatif), `run_after`, `attempts`, `status`, `external_ref`.

Variables d'environnement :
- `PASS_STUDIO_API_KEY` (clé `ps_live_…` à portée restreinte au pass membre si possible) ;
- `PASS_STUDIO_PASS_ID` ;
- `PASS_STUDIO_WEBHOOK_SECRET` ;
- `PASS_STUDIO_BASE_URL` = `https://www.passstudio.online/api/v1`.

Prévois un pass de test séparé (`draft`) pour l'environnement de développement.

---

## 5. Création du modèle de pass

1. Crée le modèle une seule fois, de préférence dans l'éditeur The Pass Studio pour placer les champs du §3.3. Sinon, utilise `POST /passes` (`name: "Carte membre Les RDV IA"`, `passType: "loyalty"`, `distributionMode: "unique"`, `design` du §3.2).
2. Vérifie avec `GET /passes/{passId}` que `fieldKeys` contient bien toutes les clés du §3.3 et que `publishBlockers` est vide.
3. Publie le modèle (`status: "active"`).
4. Script d'administration idempotent : `scripts/wallet/setup-pass.ts`. Il affiche le `passId` à mettre dans `PASS_STUDIO_PASS_ID`.

---

## 6. Émission et ajout au wallet

### 6.1 Émission (serveur)

`POST /passes/{PASS_STUDIO_PASS_ID}/issue` avec :

```json
{
  "customerId": "member_<id>",
  "source": "rdvia",
  "email": "manon.blanc@exemple.fr",
  "name": "Manon Blanc",
  "sendEmail": false,
  "includeArtifacts": true,
  "locale": "fr",
  "barcodeValue": "https://rendezvousia.fr/carte/RVIA-NCY-1259",
  "fields": {
    "level": "3 · Explorateur",
    "volts": "760",
    "progress": "Encore 40 volts pour Praticien",
    "memberName": "Manon Blanc",
    "city": "Nancy",
    "nextTitle": "Créer ses visuels avec l'IA",
    "nextWhen": "12 nov. · 18 h 30",
    "nextFull": "jeu. 12 nov. 2026 · 18 h 30 · [Lieu], Nancy",
    "memberSince": "mars 2026",
    "memberCode": "RVIA-NCY-1259"
  }
}
```

- `sendEmail: false` : c'est notre plateforme qui envoie les e-mails (bienvenue, renvoi de carte) avec les liens wallet.
- L'appel est idempotent par identifiant. Si `alreadyExisted: true`, on récupère simplement l'instance existante.
- Stocke `instanceId`, `barcodeContent`, `addToWalletUrl`, `artifacts.appleWalletUrl` et `artifacts.googleWalletUrl` dans `wallet_passes`.
- Si l'émission échoue (crédits, réseau, 5xx), la création du compte ne doit pas échouer : mets un job en file et réessaie.

### 6.2 Boutons dans l'espace membre

- Sur iPhone, n'affiche que le bouton Apple Wallet. Sur Android, n'affiche que Google Wallet. Sur ordinateur, affiche les deux, plus la mention « Ouvrez cette page sur votre téléphone pour ajouter la carte », avec un QR code vers `/mon-espace#carte`.
- Utilise les badges **officiels** « Ajouter à Apple Wallet » et « Ajouter à Google Wallet » en français (les règles d'Apple et de Google l'imposent). Ils remplacent les boutons stylisés de la maquette, avec le même emplacement et la même taille (hauteur 48 px).
- Clic : redirection serveur `/api/wallet/add?platform=apple|google` vers l'URL stockée. Si aucune instance n'existe encore, elle est émise juste à ce moment-là.
- Une fois le pass installé (webhook `pass.issued` avec `platform`), le bouton devient « Ajoutée à Apple Wallet ✓ » ou « Ajoutée à Google Wallet ✓ ».

---

## 7. Mises à jour et notifications

### 7.1 Quand pousser une mise à jour

Chaque événement ci-dessous ajoute un job `wallet_sync` pour le membre :

| Événement | Champs modifiés | Notification (`message`) |
|---|---|---|
| Pointage validé : présent | `volts`, `progress` (+ `level`) | « +100 volts ! Vous en avez maintenant 860. » (ou « +200 volts grâce à votre filleul ! ») |
| Niveau atteint | `level`, `progress` | « Niveau 4 · Praticien atteint, bravo ! » (remplace le message précédent) |
| Réservation confirmée (ou promotion depuis la liste d'attente) | `nextTitle`, `nextWhen`, `nextFull` + lieu (§7.3) | « Place confirmée : [titre], jeu. 12 nov. à 18 h 30. » |
| Annulation, ou conférence passée | champs de prochaine conférence (réservation suivante ou « Aucune réservation ») | aucune |
| Questionnaire (+20), replay (+15), badge (+30), bonus nouvelle ville (+50) | `volts`, `progress` | aucune (mise à jour silencieuse) |
| Changement de nom ou de ville d'origine | `memberName`, `city` | aucune |
| Formation échangée | aucun (le pass affiche les volts **cumulés**, qui ne baissent pas) | aucune |

Règles :
- **Regroupement** : un job attend 2 minutes (`run_after`) et fusionne tous les changements du même membre. Il recalcule tous les champs depuis la base, compare le hash à `last_fields_hash` et n'appelle l'API que si quelque chose a changé. Chaque push coûte 1 crédit.
- **Une seule notification par job**, celle de plus haute priorité : niveau, puis présence, puis réservation.
- **Pas de rappels de conférence via le wallet.** Les rappels passent déjà par e-mail et SMS (H-48 et H-1). Google n'affiche qu'environ 3 notifications par pass et par jour.
- **Appel** : `PATCH /instances/fields` avec `instanceId`, `fields`, `message` (facultatif), `locations` (facultatif) et `externalRef` = `rdvia_sync_<jobId>`, pour l'idempotence.
- **Pointage d'une soirée** : il déclenche de nombreux pushs d'un coup. Fais-les passer par la file avec une cadence raisonnable, en respectant les rate limits de la doc.

### 7.2 Gestion des réponses

- `pushSkipReason: "no_change"` : le job est terminé.
- `202` (crédits insuffisants) : marque le job « en attente de crédits », alerte le super-admin et relance quand les crédits sont rechargés, avec un nouveau `externalRef`.
- `402` sur un appel avec message : réessaie plus tard avec le même `externalRef`.
- `5xx` avec `retryable: true` : nouvelle tentative avec backoff exponentiel, 5 tentatives au maximum, puis alerte.
- Logue chaque appel : `X-Request-Id`, code de réponse et `code` d'erreur.

### 7.3 Lieu de la prochaine conférence

Quand le membre a une réservation confirmée, envoie `locations` sur son instance avec le lieu de la soirée :

```json
{ "latitude": 48.6921, "longitude": 6.1844, "name": "[Lieu partenaire]", "relevantText": "Les RDV IA : présentez votre carte à l'accueil" }
```

Retire cette information (liste vide ou `null`, selon la doc) après la conférence ou en cas d'annulation. Les coordonnées viennent de la fiche ville (adresse du lieu partenaire).

---

## 8. Webhooks The Pass Studio

Endpoint : `POST /api/webhooks/passstudio`. Enregistre-le dans les paramètres de The Pass Studio, pour les événements `pass.issued`, `pass.updated` et `pass.removed` filtrés sur notre pass.

Vérification obligatoire, sur le **corps brut** de la requête :
- en-têtes `X-PassStudio-Signature` (`sha256=<hex>`), `X-PassStudio-Timestamp`, `X-PassStudio-Event` et `X-PassStudio-Delivery` ;
- calcule `HMAC-SHA256(secret, timestamp + "." + rawBody)` et compare en temps constant ;
- rejette la requête si l'horodatage a plus de 5 minutes ;
- dédoublonne avec `X-PassStudio-Delivery` ou l'`id` de l'événement ;
- réponds `2xx` rapidement : le traitement se fait en asynchrone. The Pass Studio réessaie 5 fois, puis désactive l'endpoint.

Effets :
- `pass.issued` : `platform` (apple / google) et `installed = true` sont enregistrés, ce qui alimente « Wallet utilisé » dans la fiche admin et l'état « Ajoutée ✓ » des boutons.
- `pass.removed` : `installed = false`, et la fiche admin affiche « Non ajoutée ».
- `pass.updated` : journalise l'événement.

---

## 9. Révocation et régénération (super-admin)

1. Le super-admin clique sur « Révoquer et régénérer » dans la fiche membre et saisit un motif obligatoire.
2. Côté serveur :
   - `POST /instances/revoke` sur l'ancienne instance ;
   - l'ancienne carte passe en `revoked` ;
   - une nouvelle carte est créée avec un nouveau code, puis un nouveau pass est émis (§6.1) ;
   - l'action est journalisée ;
   - un e-mail « Votre nouvelle carte membre » est envoyé au membre avec les liens wallet.
3. L'URL de l'ancien QR affiche « Cette carte n'est plus valide », sans donnée personnelle, et l'ancien code n'est jamais réattribué.

---

## 10. Page du QR (`/carte/[code]`)

- **Partenaire de la ville du membre ou super-admin connecté** : redirection vers la fiche membre dans l'admin. Un partenaire d'une autre ville voit seulement le nom, la ville d'origine et le niveau, avec un lien vers ses propres sessions. Il ne voit ni les coordonnées ni l'historique.
- **Toute autre personne** : page neutre (logo, « Carte membre Les RDV IA », « Découvrir les rendez-vous IA »).
- **Code inconnu ou révoqué** : la même page neutre, avec « Carte non valide ».
- Limite de requêtes sur cette route, pour empêcher l'énumération des codes.
- Aucun pointage, jamais.

---

## 11. Tests et critères d'acceptation

- [ ] Création d'un compte : une carte avec un code unique au bon format, un pass émis, des URLs stockées. Un nouvel appel ne crée pas de doublon.
- [ ] iPhone réel : le pass s'ajoute et le rendu correspond à `rdvia-rendu-cible-apple-wallet.png` (logo, niveau, volts sur le bandeau, membre, ville, prochaine conférence, QR avec le code dessous, verso).
- [ ] Android réel : le pass s'ajoute dans Google Wallet. Couleurs, logo, bandeau et QR sont corrects. Fournis une capture.
- [ ] Pointage validé : les volts et la progression se mettent à jour en moins de 5 minutes, avec la notification « +100 volts ».
- [ ] Passage de niveau : le niveau change et une seule notification s'affiche.
- [ ] Questionnaire et replay : mise à jour silencieuse.
- [ ] Réservation : la prochaine conférence et le lieu sont à jour. Après la conférence, la réservation suivante (ou « Aucune réservation ») s'affiche.
- [ ] Aucun push quand rien n'a changé (vérifie le hash).
- [ ] Webhooks : une signature invalide est rejetée (401). « Wallet utilisé » est correct dans la fiche admin après ajout puis suppression du pass.
- [ ] Révocation : l'ancien pass est invalidé, le nouveau code fonctionne, l'ancien QR affiche « Carte non valide ».
- [ ] Page QR : bon comportement selon le rôle, aucune donnée personnelle pour un visiteur.
- [ ] Carte web : design et animations conformes au §2.2. Avec `prefers-reduced-motion`, plus aucune animation.
- [ ] La clé API n'apparaît dans aucun bundle client et dans aucun log.

Livrables : le code, le script `setup-pass`, les images du pass hébergées, un court README « Wallet » (variables d'environnement, création du modèle, test sur téléphone) et la liste des écarts éventuels avec cette spécification.

---

## Fichiers fournis avec ce document

| Fichier | Usage |
|---|---|
| `rdvia-strip-1125x432.png` | `stripImageUrl` : bandeau dégradé, trame de points, éclair |
| `rdvia-logo-480x150.png` | `logoUrl` : logo « Les RDV IA » sur fond transparent |
| `rdvia-icon-87x87.png` | `iconUrl` : icône des notifications |
| `rdvia-icon-1024.png` | même icône en haute définition (si l'éditeur la demande) |
| `rdvia-rendu-cible-apple-wallet.png` | rendu visé, référence visuelle uniquement (ne pas l'envoyer à l'API) |
