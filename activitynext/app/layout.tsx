import type { Metadata } from "next";
import "./globals.css";
import {AuthProvider} from "@/context/AuthContext";
import { ModalProvider } from '@/context/ModalContext';
import NotificationHubClient from "@/components/signalr/NotificationHubClient"; // Her kobler jeg opp mot NotificationHub. Brukes en gang slik at den kjører globalt
import ChatHubClient from "@/components/signalr/ChatHubClient";  // Her kobler jeg opp mot ChatHub. Brukes en gang slik at den kjøres globalt
import Navbar from "@/components/Navbar";
import CacheCleanup from "@/components/common/CacheCleanup";


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
      <body className={` antialiased  bg-white 
          dark:bg-black 
          text-black 
          dark:text-white 
          min-h-screen`} suppressHydrationWarning={true}>
        <ModalProvider>
          <CacheCleanup>
          <AuthProvider>
          <NotificationHubClient /> 
          <ChatHubClient />
            <Navbar /> {/* 👈 LEGG TIL DENNE */}
              <main>{children}</main>
          </AuthProvider>
          </CacheCleanup>
        </ModalProvider>
      </body>
    </html>
  );
}
