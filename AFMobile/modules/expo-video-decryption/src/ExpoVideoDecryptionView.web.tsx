import * as React from 'react';

import { ExpoVideoDecryptionViewProps } from './ExpoVideoDecryption.types';

export default function ExpoVideoDecryptionView(props: ExpoVideoDecryptionViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
