// hooks/useMobileDetection.ts
"use client";

import { useState, useEffect } from 'react';
import { create } from 'zustand';

// Store for global mobile state
interface MobileStore {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  setMobileState: (isMobile: boolean, isTablet: boolean, screenWidth: number) => void;
}

const useMobileStore = create<MobileStore>((set) => ({
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  screenWidth: 1920,
  setMobileState: (isMobile: boolean, isTablet: boolean, screenWidth: number) => 
    set({ 
      isMobile, 
      isTablet, 
      isDesktop: !isMobile && !isTablet,
      screenWidth 
    })
}));

// Custom hook for mobile detection
export const useMobileDetection = () => {
  const { isMobile, isTablet, isDesktop, screenWidth, setMobileState } = useMobileStore();
  
  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      const isMobileDevice = width < 768; // Tailwind md breakpoint
      const isTabletDevice = width >= 768 && width < 1024; // Tailwind lg breakpoint
      
      setMobileState(isMobileDevice, isTabletDevice, width);
    };

    // Initial check
    checkDevice();

    // Listen for resize events
    window.addEventListener('resize', checkDevice);
    
    // Listen for orientation changes (mobile specific)
    window.addEventListener('orientationchange', () => {
      // Small delay to ensure dimensions are updated
      setTimeout(checkDevice, 100);
    });

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, [setMobileState]);

  return {
    isMobile,
    isTablet,
    isDesktop,
    screenWidth,
    // Utility functions
    isMobileOrTablet: isMobile || isTablet,
    isSmallScreen: screenWidth < 640, // Tailwind sm breakpoint
    isMediumScreen: screenWidth >= 640 && screenWidth < 1024,
    isLargeScreen: screenWidth >= 1024,
  };
};

// Individual hooks for specific checks (for better performance)
export const useIsMobile = () => useMobileStore(state => state.isMobile);
export const useIsTablet = () => useMobileStore(state => state.isTablet);
export const useIsDesktop = () => useMobileStore(state => state.isDesktop);
export const useScreenWidth = () => useMobileStore(state => state.screenWidth);

// Server-safe hook that returns false until hydrated
export const useMobileDetectionSSR = () => {
  const [isClient, setIsClient] = useState(false);
  const mobileState = useMobileDetection();

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      screenWidth: 1920,
      isMobileOrTablet: false,
      isSmallScreen: false,
      isMediumScreen: false,
      isLargeScreen: true,
    };
  }

  return mobileState;
};