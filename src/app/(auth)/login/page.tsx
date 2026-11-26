import type { Metadata } from "next";

import { BrandMark } from "@/components/brand-mark";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { safeCallbackUrl } from "@/lib/validators/auth";
import { getBusinessName } from "@/server/queries/settings";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Joy Palma Imports" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const [{ callbackUrl }, businessName] = await Promise.all([searchParams, getBusinessName()]);

  return (
    <Card className="gap-6">
      <CardHeader className="justify-items-center gap-3 text-center">
        <BrandMark />
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">{businessName}</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>
      </CardHeader>
      <CardContent>
        <LoginForm callbackUrl={safeCallbackUrl(callbackUrl)} />
      </CardContent>
    </Card>
  );
}
