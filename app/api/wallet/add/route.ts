import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/app/auth";
import { getWalletContext } from "@/lib/app/context";
import { ensureIssued } from "@/lib/wallet/service";

/** GET /api/wallet/add?platform=apple|google → redirection vers l'URL d'ajout au wallet. */
export async function GET(req: NextRequest) {
  const platform = req.nextUrl.searchParams.get("platform");
  if (platform !== "apple" && platform !== "google") {
    return NextResponse.json({ error: "platform doit valoir apple ou google" }, { status: 400 });
  }
  const viewer = await getViewer();
  if (!viewer?.memberId) return NextResponse.redirect(new URL("/connexion", req.url));

  const ctx = await getWalletContext();
  const card = await ctx.repo.getActiveCardByMember(viewer.memberId);
  if (!card) return NextResponse.json({ error: "Aucune carte active" }, { status: 404 });
  if (!ctx.client) {
    return NextResponse.json({ error: "Wallet indisponible : The Pass Studio n'est pas configuré" }, { status: 503 });
  }

  try {
    // Émission au premier clic si l'instance n'existe pas encore.
    const pass = await ensureIssued(ctx, card);
    const target =
      (platform === "apple" ? pass.appleWalletUrl : pass.googleWalletUrl) ?? pass.addToWalletUrl;
    if (!target) return NextResponse.json({ error: "Lien wallet indisponible" }, { status: 502 });
    return NextResponse.redirect(target, 302);
  } catch (err) {
    console.error("[wallet/add]", (err as Error).message);
    return NextResponse.json({ error: "Le wallet est momentanément indisponible, réessayez." }, { status: 503 });
  }
}
