/** Données métier lues dans NOTRE base (source de vérité). */
export interface Venue {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface Booking {
  conferenceTitle: string;
  startsAt: Date;
  city: string;
  venue: Venue;
}

export interface MemberSnapshot {
  memberId: string;
  firstName: string;
  lastName: string;
  email: string;
  city: string; // ville d'origine, ex. « Nancy »
  cityCode: string; // ex. « NCY »
  voltsTotal: number; // volts cumulés
  createdAt: Date;
  nextBooking: Booking | null; // prochaine réservation confirmée, à venir
}

export type CardStatus = "active" | "revoked";

export interface MemberCard {
  id: string;
  memberId: string;
  code: string;
  qrUrl: string;
  status: CardStatus;
  createdAt: Date;
  revokedAt: Date | null;
  revokedBy: string | null;
  revokeReason: string | null;
}

export type WalletPlatform = "apple" | "google";

export interface WalletPass {
  cardId: string;
  psPassId: string;
  psInstanceId: string | null;
  barcodeContent: string | null;
  addToWalletUrl: string | null;
  appleWalletUrl: string | null;
  googleWalletUrl: string | null;
  platform: WalletPlatform | null;
  installed: boolean;
  lastFieldsHash: string | null;
  lastPushedAt: Date | null;
  lastPushStatus: string | null;
  lastError: string | null;
}

export type SyncReason =
  | "level_up"
  | "attendance"
  | "booking"
  | "booking_cleared"
  | "volts_silent"
  | "profile"
  | "issue"
  | "manual";

export type SyncJobStatus = "queued" | "running" | "done" | "waiting_credits" | "failed";

export interface WalletSyncJob {
  id: string;
  cardId: string;
  reason: SyncReason;
  message: string | null;
  runAfter: Date;
  attempts: number;
  status: SyncJobStatus;
  externalRef: string;
}
