import { prisma } from "@/lib/db";

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
