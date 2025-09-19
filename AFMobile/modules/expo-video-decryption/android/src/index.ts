import ExpoVideoDecryptionModule from "../../src/ExpoVideoDecryptionModule";

export function hello(): string {
  return ExpoVideoDecryptionModule.hello();
}

export async function decryptVideo(base64Data: string, key: string): Promise<string> {
  return await ExpoVideoDecryptionModule.decryptVideo(base64Data, key);
}

export { ExpoVideoDecryptionModule };