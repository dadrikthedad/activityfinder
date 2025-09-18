import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './ExpoVideoDecryption.types';

type ExpoVideoDecryptionModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class ExpoVideoDecryptionModule extends NativeModule<ExpoVideoDecryptionModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(ExpoVideoDecryptionModule, 'ExpoVideoDecryptionModule');
