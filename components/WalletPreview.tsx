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
          <img src="/wallet/rdvia-logo-480x150.png" alt="Les RDV IA" className={styles.logo} />
          <div className={styles.right}>
            <span className={styles.label}>Niveau</span>
            <span className={styles.value}>{fields.level}</span>
          </div>
        </div>

        <div className={styles.strip}>
          <span className={styles.label}>Mes volts · {fields.progress.replace(" volts", "")}</span>
          <span className={styles.primary}>{fields.volts}</span>
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
