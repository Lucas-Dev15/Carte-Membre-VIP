import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BoltIcon } from "@/components/Logo";
import { getViewer } from "@/lib/app/auth";
import { getRepository } from "@/lib/app/context";
import { rateLimit } from "@/lib/app/rate-limit";
import { isValidMemberCode } from "@/lib/wallet/code";
import { levelLabel } from "@/lib/wallet/levels";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Carte membre Les RDV IA", robots: { index: false, follow: false } };

/**
 * Page ouverte par le QR du pass. Ne pointe JAMAIS une présence.
 * Aucune donnée personnelle pour un visiteur non autorisé.
 */
export default async function CartePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`carte:${ip}`, 30, 60_000)) return <Neutral message="Trop de requêtes, réessayez dans une minute." />;

  const repo = getRepository();
  const card = isValidMemberCode(code) ? await repo.getCardByCode(code) : null;
  if (!card || card.status !== "active") return <Neutral message="Carte non valide" />;

  const viewer = await getViewer();
  if (viewer?.role === "superadmin") redirect(`/admin/membres/${card.memberId}`);
  if (viewer?.role === "partner") {
    const member = await repo.getMemberSnapshot(card.memberId);
    if (member && member.city === viewer.partnerCity) redirect(`/admin/membres/${card.memberId}`);
    if (member) {
      // Partenaire d'une autre ville : nom, ville d'origine et niveau, rien d'autre.
      return (
        <main className={styles.main}>
          <div className={styles.box}>
            <Brand />
            <h1 className={styles.h1}>{`${member.firstName} ${member.lastName}`}</h1>
            <p>Ville d’origine : {member.city}</p>
            <p>Niveau {levelLabel(member.voltsTotal)}</p>
            <a href="/admin/sessions">Voir mes sessions</a>
          </div>
        </main>
      );
    }
  }
  return <Neutral />;
}

function Brand() {
  return (
    <div className={styles.brand}>
      <BoltIcon size={40} radius={9} />
      <span>Les RDV IA</span>
    </div>
  );
}

function Neutral({ message }: { message?: string }) {
  return (
    <main className={styles.main}>
      <div className={styles.box}>
        <Brand />
        <h1 className={styles.h1}>Carte membre Les RDV IA</h1>
        {message && <p className={styles.invalid}>{message}</p>}
        <a className={styles.cta} href="https://rendezvousia.fr">
          Découvrir les rendez-vous IA
        </a>
      </div>
    </main>
  );
}
