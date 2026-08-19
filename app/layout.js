import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  title: "Bengaluru Dhwani",
  description: "Live Kannada music from Bengaluru",

  icons: {
    icon: "/android-chrome-192x192.png",
    shortcut: "/android-chrome-192x192.png",
    apple: "/android-chrome-192x192.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}