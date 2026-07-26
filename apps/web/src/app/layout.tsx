import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "StuffHub — Your home, accounted for",
  description: "A private, insurance-ready home inventory.",
};

// Next and Expo currently install separate React type trees in this monorepo.
// The runtime contract remains the standard Next layout children prop.
export default function RootLayout({ children }: { children: any }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
