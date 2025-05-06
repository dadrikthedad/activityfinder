import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {AuthProvider} from "@/context/AuthContext";
import { ModalProvider } from '@/context/ModalContext';
import NotificationHubClient from "@/components/NotificationHubClient"; // Brukes en gang slik at den kjører globalt
import { ChatProvider } from "@/context/ChatContext";
import Navbar from "@/components/Navbar";



const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

console.log("🔄 Navbar re-rendered");

export const metadata: Metadata = {
  title: "Magee.no",
  description: "Takk for deg",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased  bg-white 
          dark:bg-black 
          text-black 
          dark:text-white 
          min-h-screen`} suppressHydrationWarning={true}>
        <ModalProvider>
          <AuthProvider>
          <NotificationHubClient /> 
          <ChatProvider>
            <Navbar /> {/* 👈 LEGG TIL DENNE */}
              <main>{children}</main>
            </ChatProvider>
          </AuthProvider> 
        </ModalProvider>
      </body>
    </html>
  );
}
