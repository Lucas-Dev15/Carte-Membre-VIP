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
 * ⚠️ Les règles d'Apple et de Google imposent les badges OFFICIELS
 * « Ajouter à Apple Wallet » / « Ajouter à Google Wallet » (FR).
 * Déposez-les dans public/wallet/badges/ (add-to-apple-wallet-fr.svg,
 * add-to-google-wallet-fr.svg) puis passez OFFICIAL_BADGES à true : ils
 * remplacent les boutons provisoires ci-dessous (hauteur 48 px).
 */
const OFFICIAL_BADGES = false;
const APPLE_BADGE = "/wallet/badges/add-to-apple-wallet-fr.svg";
const GOOGLE_BADGE = "/wallet/badges/add-to-google-wallet-fr.svg";

function Badge({ href, src, fallback }: { href: string; src: string; fallback: string }) {
  return (
    <a href={href} className={styles.badge} aria-label={fallback}>
      {OFFICIAL_BADGES ? (
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

  const apple = <Badge href="/api/wallet/add?platform=apple" src={APPLE_BADGE} fallback="Ajouter à Apple Wallet" />;
  const google = <Badge href="/api/wallet/add?platform=google" src={GOOGLE_BADGE} fallback="Ajouter à Google Wallet" />;

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
