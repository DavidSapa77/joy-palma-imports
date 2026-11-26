import type { AuditAction, Prisma, PrismaClient } from "@prisma/client";

import type { TransactionClient } from "@/lib/counters";

/**
 * Audit log helper (PRD F9). Call it inside the same transaction as the
 * change it records, so the change and its audit row commit together.
 *
 * `before` / `after` are JSON snapshots. Anything that looks like a secret
 * (password, passwordHash, newPassword, token, secret…) is replaced with "[redacted]"
 * before it is stored, at any depth.
 */

export type AuditJson = Prisma.InputJsonValue;

export type AuditInput = {
  /** Who did it. Null for e.g. a failed login with an unknown email. */
  userId?: string | null;
  action: AuditAction;
  /** e.g. "User", "Product", "Sale". */
  entityType: string;
  entityId?: string | null;
  before?: AuditJson | null;
  after?: AuditJson | null;
  ipAddress?: string | null;
};

// Password fields by name (not "mustChangePassword"), plus anything ending in secret/token.
const SECRET_KEY =
  /^(password|passwordHash|newPassword|currentPassword|confirmPassword|oldPassword)$|(secret|token)$/i;
export const REDACTED = "[redacted]";

/** Deep-copies a JSON value, replacing secret-looking keys. */
export function redactSecrets(value: AuditJson): AuditJson {
  if (Array.isArray(value)) return value.map((v) => redactSecrets(v as AuditJson));
  if (value !== null && typeof value === "object") {
    const out: Record<string, AuditJson> = {};
    for (const [key, v] of Object.entries(value as Record<string, AuditJson>)) {
      if (v === undefined) continue;
      out[key] = SECRET_KEY.test(key) ? REDACTED : redactSecrets(v);
    }
    return out;
  }
  return value;
}

export function logAudit(db: TransactionClient | PrismaClient, input: AuditInput) {
  return db.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      // undefined → column stays NULL
      before: input.before == null ? undefined : redactSecrets(input.before),
      after: input.after == null ? undefined : redactSecrets(input.after),
      ipAddress: input.ipAddress ?? null,
    },
  });
}
