/** Public auth screens: centred card on a soft teal gradient (UI spec §4.1). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-linear-to-br from-primary/15 via-secondary to-primary/30 px-4 py-10">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
