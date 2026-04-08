import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
};

export const metadata: Metadata = {
  title: "G-Buddy - AI Grow Companion",
  description: "Your AI-powered grow companion. 100% private. 100% offline. No account needed.",
  manifest: "/manifest.json",
  icons: {
    icon: "/gbuddy-icon.svg",
    shortcut: "/gbuddy-icon.svg",
    apple: "/gbuddy-icon.svg"
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "G-Buddy"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#84cc16" />
        <link rel="apple-touch-icon" href="/gbuddy-icon.svg" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
