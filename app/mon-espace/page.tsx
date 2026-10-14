import { MemberCard } from "@/components/MemberCard";
import { WalletButtons } from "@/components/WalletButtons";
import { WalletPreview } from "@/components/WalletPreview";
import { getViewer } from "@/lib/app/auth";
import { loadCardView } from "@/lib/app/card-view";
import { qrSvg } from "@/lib/app/qr";
import { siteUrl } from "@/lib/wallet/config";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function MonEspacePage() {
  const viewer = await getViewer();
  if (!viewer?.memberId) return <p className={styles.empty}>Connectez-vous pour voir votre carte.</p>;
  const view = await loadCardView(viewer.memberId);
  if (!view) return <p className={styles.empty}>Votre carte est en cours de création.</p>;

  const pageQr = await qrSvg(`${siteUrl()}/mon-espace#carte`, 1);
  const installed = view.pass?.installed ? view.pass.platform : null;

  return (
    <main className={styles.main}>
      <section id="carte" className={styles.section}>
        <h1 className={styles.title}>Ma carte membre</h1>
        <div className={styles.layout}>
          <div className={styles.cardCol}>
            <MemberCard
              name={`${view.member.firstName} ${view.member.lastName}`}
              city={view.member.city}
              code={view.card.code}
              volts={view.member.voltsTotal}
              levelShort={view.levelShort}
              memberSince={view.memberSince}
              qrSvg={view.qr}
            />
            <div className={styles.buttons}>
              <WalletButtons installedPlatform={installed} pageQrSvg={pageQr} />
            </div>
            <p className={styles.note}>
              Votre carte se met à jour toute seule dans le wallet : skills, niveau et prochaine conférence. Code
              personnel : <strong className={styles.code}>{view.card.code}</strong>
            </p>
          </div>
          <div className={styles.previewCol}>
            <WalletPreview fields={view.fields} qrSvg={view.qr} />
          </div>
        </div>
      </section>
    </main>
  );
}
