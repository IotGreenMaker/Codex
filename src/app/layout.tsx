import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "G-Buddy",
  description: "AI grow companion for voice logging, monitoring, and cultivation insights.",
  icons: {
    icon: "/gbuddy-icon.svg",
    shortcut: "/gbuddy-icon.svg",
    apple: "/gbuddy-icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
