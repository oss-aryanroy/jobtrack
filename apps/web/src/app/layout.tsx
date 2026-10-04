import type { Metadata, Viewport } from "next";
import "@jobtrack/ui/styles.css";

export const metadata: Metadata = {
  title: "JobTrack",
  description: "Track every job you apply to with one field. Follow-ups and history take care of themselves.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#16141f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
