import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppLayout from "../components/AppLayout"; // Importing our new wrapper

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Billing ERP System",
  description: "Enterprise billing and master data management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* We wrap 'children' (your pages) inside our new AppLayout */}
        <AppLayout>
          {children}
        </AppLayout>
      </body>
    </html>
  );
}