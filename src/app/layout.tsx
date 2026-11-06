import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MusicForU — Your music, your way",
  description:
    "Make playlists from your favorite YouTube tracks. Save the best moments, set your speed, and listen your way.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
