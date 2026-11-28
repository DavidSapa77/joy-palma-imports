import { prisma } from "@/lib/db";
import { DEFAULT_TIME_ZONE } from "@/lib/dates";

const FALLBACK_BUSINESS_NAME = "Joy Palma Imports";

/** Business name for public screens (login). Falls back if settings aren't seeded yet. */
export async function getBusinessName(): Promise<string> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { id: 1 },
      select: { businessName: true },
    });
    return setting?.businessName || FALLBACK_BUSINESS_NAME;
  } catch {
    return FALLBACK_BUSINESS_NAME;
  }
}

export type BusinessBrand = { name: string; logoUrl: string | null };

/** Business name and logo for the app shell's sidebar header (UI spec §4.2). */
export async function getBusinessBrand(): Promise<BusinessBrand> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { id: 1 },
      select: { businessName: true, logoUrl: true },
    });
    return {
      name: setting?.businessName || FALLBACK_BUSINESS_NAME,
      logoUrl: setting?.logoUrl || null,
    };
  } catch {
    return { name: FALLBACK_BUSINESS_NAME, logoUrl: null };
  }
}

/** Business time zone for displaying dates (Settings, default Africa/Accra). */
export async function getTimeZone(): Promise<string> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { id: 1 },
      select: { timeZone: true },
    });
    return setting?.timeZone || DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}
