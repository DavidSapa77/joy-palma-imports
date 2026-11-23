import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Joy Palma Imports",
  description: "Inventory & Sales Intelligence System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
