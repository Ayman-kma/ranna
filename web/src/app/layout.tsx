import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LocaleProvider } from "@/lib/locale";

export const metadata: Metadata = {
  title: "رنّة · Ranna — نظام نداء العملاء",
  description:
    "حوّل جوال عميلك إلى جهاز نداء. نظام نداء عملاء فوري للمطاعم والمقاهي والعيادات ومراكز الخدمة — بدون تطبيق.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "رنّة",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.__rannaBIP=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__rannaBIP=e;});",
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
