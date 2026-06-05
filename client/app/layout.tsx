import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Virtual Xbox Controller",
  description: "Touch controller that drives any Python-capable device.",
  manifest: "/manifest.webmanifest",
  // iOS: when launched from the Home Screen this runs chromeless (no Safari UI),
  // which is the only way to get true fullscreen on iPhone.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Controller",
  },
  // legacy tag some iOS versions still require for a chromeless home-screen launch
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0c10",
  viewportFit: "cover" as const, // extend under the notch/safe areas
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
