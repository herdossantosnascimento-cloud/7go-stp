import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "7Go STP | Drive Your Way",
  description: "Plataforma profissional de aluguer de carros em São Tomé e Príncipe.",
};

const themeScript = `
(function () {
  function applyTheme() {
    var hour = new Date().getHours();
    var theme = hour >= 6 && hour < 19 ? "day" : "night";
    document.documentElement.setAttribute("data-theme", theme);
  }

  applyTheme();
  setInterval(applyTheme, 60000);
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
