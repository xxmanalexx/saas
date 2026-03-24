import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rana — AI Agent Platform for MENA Businesses",
  description: "Automate customer conversations across WhatsApp, Instagram, web chat, and email. Qualify leads, book appointments, and handle support — while you focus on growing your business.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%2300C853'/><text y='.9em' x='50%' text-anchor='middle' font-size='70' font-weight='bold' fill='black'>R</text></svg>",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
