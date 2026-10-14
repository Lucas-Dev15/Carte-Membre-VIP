"use client";

import { useEffect, useState } from "react";
import styles from "./WalletButtons.module.css";

type Device = "ios" | "android" | "desktop";

function detectDevice(ua: string): Device {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export interface WalletButtonsProps {
  installedPlatform: "apple" | "google" | null;
  pageQrSvg: string; // QR vers /mon-espace#carte, pour l'ordinateur
}

/**
 * Apple et Google imposent leurs badges OFFICIELS pour les boutons « Ajouter au wallet ».
 * - Google : badge français officiel (Google Wallet brand guidelines), dans public/wallet/badges/.
 * - Apple : le badge se télécharge depuis un compte Apple Developer
 *   (developer.apple.com/wallet/add-to-apple-wallet-guidelines). Déposez-le en
 *   public/wallet/badges/add-to-apple-wallet-fr.svg et passez APPLE_BADGE_AVAILABLE à true ;
 *   d'ici là, un bouton provisoire s'affiche.
 */
const APPLE_BADGE = "/wallet/badges/add-to-apple-wallet-fr.svg";
const GOOGLE_BADGE = "/wallet/badges/add-to-google-wallet-fr.svg";
const APPLE_BADGE_AVAILABLE = false;

function Badge({ href, src, fallback, available }: { href: string; src: string; fallback: string; available: boolean }) {
  return (
    <a href={href} className={styles.badge} aria-label={fallback}>
      {available ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={fallback} height={48} />
      ) : (
        <span className={styles.placeholder}>{fallback}</span>
      )}
    </a>
  );
}

export function WalletButtons({ installedPlatform, pageQrSvg }: WalletButtonsProps) {
  const [device, setDevice] = useState<Device>("desktop");
  useEffect(() => setDevice(detectDevice(navigator.userAgent)), []);

  if (installedPlatform) {
    return (
      <div className={styles.done}>
        Ajoutée à {installedPlatform === "apple" ? "Apple Wallet" : "Google Wallet"} ✓
      </div>
    );
  }

  const apple = <Badge href="/api/wallet/add?platform=apple" src={APPLE_BADGE} fallback="Ajouter à Apple Wallet" available={APPLE_BADGE_AVAILABLE} />;
  const google = <Badge href="/api/wallet/add?platform=google" src={GOOGLE_BADGE} fallback="Ajouter à Google Wallet" available />;

  if (device === "ios") return <div className={styles.row}>{apple}</div>;
  if (device === "android") return <div className={styles.row}>{google}</div>;
  return (
    <div>
      <div className={styles.row}>
        {apple}
        {google}
      </div>
      <div className={styles.desktopHint}>
        <div className={styles.pageQr} dangerouslySetInnerHTML={{ __html: pageQrSvg }} />
        <p>Ouvrez cette page sur votre téléphone pour ajouter la carte.</p>
      </div>
    </div>
  );
}
