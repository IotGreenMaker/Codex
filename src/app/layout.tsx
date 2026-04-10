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
  description: "Your AI-powered grow companion. 100% private. No account needed. Data stays on your device.",
  icons: {
    icon: "/g-icon.png",
    shortcut: "/g-icon.png",
    apple: "/g-icon.png"
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
        <link rel="apple-touch-icon" href="/g-icon.png" />
        <link rel="icon" type="image/png" href="/g-icon.png" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
