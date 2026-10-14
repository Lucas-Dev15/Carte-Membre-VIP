"use client";

import { useState } from "react";

export function AdminCardActions({ cardId, code, canRegenerate }: { cardId: string; code: string; canRegenerate: boolean }) {
  const [status, setStatus] = useState<string | null>(null);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setStatus("Code copié");
  }
  async function resend() {
    const res = await fetch(`/api/admin/cards/${cardId}/resend`, { method: "POST" });
    setStatus(res.ok ? "Carte renvoyée par e-mail" : "Échec de l'envoi");
  }
  async function regenerate() {
    const reason = window.prompt("Motif de la révocation (obligatoire) :");
    if (!reason?.trim()) return;
    const res = await fetch(`/api/admin/cards/${cardId}/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const body = await res.json();
    if (res.ok) window.location.reload();
    else setStatus(body.error ?? "Échec");
  }

  const btn: React.CSSProperties = {
    padding: "9px 14px",
    borderRadius: 10,
    border: "1px solid #d7d9ea",
    background: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <button style={btn} onClick={copy}>Copier le code</button>
      <button style={btn} onClick={resend}>Renvoyer la carte par e-mail</button>
      {canRegenerate && (
        <button style={{ ...btn, borderColor: "#f1b5ae", color: "#b42318" }} onClick={regenerate}>
          Révoquer et régénérer
        </button>
      )}
      {status && <span role="status" style={{ fontSize: 13, color: "#5b5e7a" }}>{status}</span>}
    </div>
  );
}
