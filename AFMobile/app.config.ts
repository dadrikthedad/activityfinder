import { ExpoConfig, ConfigContext } from 'expo/config';

const PROD_API_URL = "https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net";

export default ({ config }: ConfigContext): ExpoConfig => {
  const apiUrl = process.env.API_URL ?? PROD_API_URL;
  console.log(`📡 API URL: ${apiUrl}`);

  return {
    ...config,
    name: "AFMobile",
    slug: "AFMobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.dadrikthedad.AFMobile",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
      requireFullScreen: false,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      package: "com.dadrikthedad.AFMobile",
      largeHeap: true,
      enableProguardInReleaseBuilds: false,
      minSdkVersion: 23,
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-video",
      [
        "expo-media-library",
        {
          photosPermission:
            "AFMobile needs access to your photos to save downloaded images and videos to your gallery",
          savePhotosPermission:
            "AFMobile wants to save downloaded files to your photo library",
        },
      ],
      // Tvinger androidx.core til 1.15.0 — overlever prebuild --clean
      "./plugins/withAndroidxCoreResolution",
    ],
    extra: {
      eas: {
        projectId: "15b8fa03-452f-401f-9b78-eb22812d93bd",
      },
      apiUrl,
    },
  };
};
