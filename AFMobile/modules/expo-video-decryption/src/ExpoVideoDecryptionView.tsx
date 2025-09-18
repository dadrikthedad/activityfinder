import { requireNativeView } from 'expo';
import * as React from 'react';

import { ExpoVideoDecryptionViewProps } from './ExpoVideoDecryption.types';

const NativeView: React.ComponentType<ExpoVideoDecryptionViewProps> =
  requireNativeView('ExpoVideoDecryption');

export default function ExpoVideoDecryptionView(props: ExpoVideoDecryptionViewProps) {
  return <NativeView {...props} />;
}
