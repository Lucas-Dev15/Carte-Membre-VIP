/**
 * Point de branchement avec l'authentification existante du site.
 * ⚠️ Démo : renvoie toujours le membre de la maquette, sans rôle admin.
 */
export type Role = "member" | "partner" | "superadmin";

export interface Viewer {
  userId: string;
  role: Role;
  memberId: string | null;
  partnerCity: string | null; // ville gérée par un partenaire
}

import { DEMO_MEMBER_ID } from "./context";

export async function getViewer(): Promise<Viewer | null> {
  // TODO : brancher la session réelle (cookie, NextAuth…).
  return { userId: "demo-user", role: "member", memberId: DEMO_MEMBER_ID, partnerCity: null };
}
