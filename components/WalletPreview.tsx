import styles from "./WalletPreview.module.css";
import type { PassFields } from "@/lib/wallet/fields";

/**
 * Aperçu du pass Apple Wallet (§2.3 / §3), dans un cadre de téléphone 270 × 540.
 * Purement indicatif : le rendu réel est imposé par Apple / Google.
 */
export function WalletPreview({ fields, qrSvg }: { fields: PassFields; qrSvg: string }) {
  return (
    <div className={styles.phone} aria-label="Aperçu du pass dans le wallet">
      <div className={styles.notch} />
      <div className={styles.pass}>
        <div className={styles.header}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className={styles.brand}>
            <img src="/wallet/rdvia-logo-rvia-150.png" alt="" className={styles.logo} />
            Les RDV IA
          </span>
          <div className={styles.right}>
            <span className={styles.label}>Niveau</span>
            <span className={styles.value}>{fields.level}</span>
          </div>
        </div>

        {/* Pass Custom : pas de bandeau sur Apple, l'éclair est la vignette ; PROGRESSION est au verso. */}
        <div className={styles.main}>
          <div>
            <span className={styles.label}>Mes skills</span>
            <span className={styles.primary}>{fields.volts}</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/wallet/rdvia-thumbnail-270.png" alt="" className={styles.thumb} />
        </div>

        <div className={styles.row}>
          <div>
            <span className={styles.label}>Membre</span>
            <span className={styles.value}>{fields.memberName}</span>
          </div>
          <div className={styles.right}>
            <span className={styles.label}>Ville</span>
            <span className={styles.value}>{fields.city}</span>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.grow}>
            <span className={styles.label}>Prochaine conférence</span>
            <span className={styles.value}>{fields.nextTitle}</span>
          </div>
          <div className={styles.right}>
            <span className={styles.label}>Le</span>
            <span className={styles.value}>{fields.nextWhen}</span>
          </div>
        </div>

        <div className={styles.barcode}>
          <div className={styles.qr} dangerouslySetInnerHTML={{ __html: qrSvg }} />
        </div>
      </div>
    </div>
  );
}
