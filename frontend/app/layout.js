import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata = {
  title: "IPO Tracker",
  description: "Live IPO status, issue details and subscription figures.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <header className="sticky top-0 z-10 border-b border-border bg-paper-surface/90 backdrop-blur">
          <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="font-display text-lg font-semibold tracking-tight text-ink">
              IPO<span className="text-brand">Tracker</span>
            </Link>
            <div className="flex items-center gap-5 text-sm">
              <Link href="/ipos" className="text-ink-muted transition-colors hover:text-ink">
                All IPOs
              </Link>
              <Link
                href="/admin/login"
                className="text-ink-faint transition-colors hover:text-ink-muted"
              >
                Admin
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </body>
    </html>
  );
}
