import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Navigation from "@/components/Navigation";
import BottomNav from "@/components/BottomNav";
import packageJson from "../../package.json";

const inter = Inter({ subsets: ["latin"] });
const appVersion = packageJson.version;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Wurgprat",
  description: "Plan your weekly meals and groceries together",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Navigation />
            <main className="flex-1 container mx-auto px-4 py-6 pb-24 lg:pb-6">
              {children}
            </main>
            <footer className="hidden lg:block py-2 text-center text-xs text-gray-400">
              v{appVersion}
            </footer>
            <BottomNav />
          </div>
        </Providers>
      </body>
    </html>
  );
}
