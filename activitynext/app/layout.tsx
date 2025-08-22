import type { Metadata, Viewport } from "next";
import "./globals.css";
import {AuthProvider} from "@/context/AuthContext";
import { ModalProvider } from '@/context/ModalContext';
import SignalRClient from "@/components/signalr/SignalRClient"; // Her kobler jeg opp mot ChatHub. Brukes en gang slik at den kjøres globalt
import Navbar from "@/components/Navbar";
import CacheCleanup from "@/components/common/CacheCleanup";
import { Toaster } from "sonner";
import { OverlayLayerProvider } from "@/context/OverlayProvider";
import UserActionPopoverPortal from "@/components/common/UserActionPopover/UserActionPopoverPortal";
import GroupSettingsPortal from "@/components/groupmessages/GroupSettingsPortal";
import { AppInitializer } from "@/bootstrap/AppInitializer";
import MobileNavbarOverlay from "@/components/navbar/MobilNavbar";

console.log("🔄 Navbar re-rendered");

export const metadata: Metadata = {
  title: "Magee.no",
  description: "Takk for deg",
  // Mobile PWA metadata
  applicationName: "Magee.no",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Magee.no",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1C6B1C", // ✅ Flyttet hit fra metadata
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
        
        {/* Enhanced mobile viewport */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        
        {/* PWA/App-like experience */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Magee.no" />
        
        {/* Theme colors */}
        <meta name="theme-color" content="#1C6B1C" />
        <meta name="msapplication-navbutton-color" content="#1C6B1C" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        
        {/* Mobile optimizations */}
        <style dangerouslySetInnerHTML={{
          __html: `
            html {
              -webkit-text-size-adjust: 100%;
              -ms-text-size-adjust: 100%;
              height: 100%;
            }
            
            body {
              overscroll-behavior: none;
              -webkit-overflow-scrolling: touch;
              height: 100%;
              overflow-x: hidden;
            }
            
            /* Prevent zoom on input focus */
            input, textarea, select {
              font-size: 16px !important;
            }
            
            /* Improve touch targets */
            button, a, input, textarea {
              -webkit-tap-highlight-color: transparent;
            }
          `
        }} />
      </head>
      <body
        className={` antialiased  bg-white
          dark:bg-black
          text-black
          dark:text-white
          min-h-screen`}
        suppressHydrationWarning={true}>
          <OverlayLayerProvider>
             <AuthProvider>
              <AppInitializer />
                <ModalProvider>
                  <CacheCleanup>
                    <SignalRClient/>
                      <MobileNavbarOverlay /> {/* ✅ Mobil navbar - vises kun på mobil/tablet */}
                      <Navbar />        
                        <UserActionPopoverPortal />
                          <GroupSettingsPortal />
                            <main>{children}</main>
                          <Toaster position="bottom-right" richColors />
                        </CacheCleanup>
                </ModalProvider>
            </AuthProvider>
          </OverlayLayerProvider>
      </body>
    </html>
  );
}