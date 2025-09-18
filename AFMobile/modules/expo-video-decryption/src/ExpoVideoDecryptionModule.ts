import { NativeModule, requireNativeModule } from 'expo';

import { ExpoVideoDecryptionModuleEvents } from './ExpoVideoDecryption.types';

declare class ExpoVideoDecryptionModule extends NativeModule<ExpoVideoDecryptionModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ExpoVideoDecryptionModule>('ExpoVideoDecryption');
