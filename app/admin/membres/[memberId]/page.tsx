import { notFound } from "next/navigation";
import { AdminCardActions } from "@/components/AdminCardActions";
import { MemberCard } from "@/components/MemberCard";
import { getViewer } from "@/lib/app/auth";
import { loadCardView } from "@/lib/app/card-view";

export const dynamic = "force-dynamic";

/** Bloc « Carte membre » de la fiche membre admin (partenaire de la ville ou super-admin). */
export default async function AdminMemberPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const viewer = await getViewer();
  const view = await loadCardView(memberId);
  if (!view) notFound();
  const allowed =
    viewer?.role === "superadmin" || (viewer?.role === "partner" && viewer.partnerCity === view.member.city);
  if (!allowed) return <p style={{ padding: 32 }}>Accès réservé aux partenaires de la ville et aux super-admins.</p>;

  const wallet = view.pass?.installed
    ? view.pass.platform === "apple" ? "Apple Wallet" : view.pass.platform === "google" ? "Google Wallet" : "Ajoutée"
    : "Non ajoutée";

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "32px 16px" }}>
      <h1>{`${view.member.firstName} ${view.member.lastName}`}</h1>
      <section style={{ display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center", background: "#fff", borderRadius: 20, padding: 24 }}>
        <div style={{ flex: "1 1 300px", maxWidth: 340 }}>
          <MemberCard
            name={`${view.member.firstName} ${view.member.lastName}`}
            city={view.member.city}
            code={view.card.code}
            volts={view.member.voltsTotal}
            levelShort={view.levelShort}
            memberSince={view.memberSince}
            qrSvg={view.qr}
          />
        </div>
        <dl style={{ flex: "1 1 240px", margin: 0, display: "grid", gap: 12 }}>
          <div><dt style={{ fontSize: 12, color: "#5b5e7a" }}>Code</dt><dd style={{ margin: 0, fontFamily: "monospace", fontWeight: 700, letterSpacing: 1.2 }}>{view.card.code}</dd></div>
          <div><dt style={{ fontSize: 12, color: "#5b5e7a" }}>Wallet utilisé</dt><dd style={{ margin: 0, fontWeight: 600 }}>{wallet}</dd></div>
          <AdminCardActions cardId={view.card.id} code={view.card.code} canRegenerate={viewer?.role === "superadmin"} />
        </dl>
      </section>
    </main>
  );
}
