import { NativeModule, requireNativeModule } from 'expo';

declare class ExpoVideoDecryptionModule extends NativeModule {
  hello(): string;
}

export default requireNativeModule<ExpoVideoDecryptionModule>('ExpoVideoDecryption');