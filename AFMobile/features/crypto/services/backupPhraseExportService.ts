import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

const FILE_NAME = "activityfinder-backup-phrase.txt";

function buildContent(phrase: string): string {
  return [
    "ActivityFinder — Krypteringsnøkkel backup",
    "==========================================",
    "",
    "Ta vare på disse 24 ordene på et trygt sted.",
    "De er den eneste måten å gjenopprette krypterte meldinger på en ny enhet.",
    "",
    phrase,
    "",
    "==========================================",
    "Ikke del dette med noen.",
  ].join("\n");
}

// Android: lar brukeren velge mappe og lagrer direkte der (ingen share sheet).
// Returnerer false hvis brukeren avbrøt mappe-pickeren.
async function saveToDeviceAndroid(phrase: string): Promise<boolean> {
  const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissions.granted) return false;

  const uri = await FileSystem.StorageAccessFramework.createFileAsync(
    permissions.directoryUri,
    FILE_NAME,
    "text/plain"
  );

  await FileSystem.writeAsStringAsync(uri, buildContent(phrase), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return true;
}

// iOS: share sheet — brukeren velger "Lagre til Filer" selv.
// Vi kan ikke vite om de faktisk lagret, så returnerer alltid true etter sheet lukkes.
async function saveToDeviceIos(phrase: string): Promise<boolean> {
  const fileUri = `${FileSystem.cacheDirectory}${FILE_NAME}`;
  await FileSystem.writeAsStringAsync(fileUri, buildContent(phrase), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await Sharing.shareAsync(fileUri, {
    mimeType: "text/plain",
    dialogTitle: "Lagre til Filer",
    UTI: "public.plain-text",
  });

  return true;
}

// Returnerer true hvis filen ble lagret, false hvis brukeren avbrøt.
export async function saveBackupPhraseToDevice(phrase: string): Promise<boolean> {
  if (Platform.OS === "android") {
    return saveToDeviceAndroid(phrase);
  } else {
    return saveToDeviceIos(phrase);
  }
}
