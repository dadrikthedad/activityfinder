import 'react-native-get-random-values';
import { Buffer } from 'buffer';

// Sett opp Buffer polyfill
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

export const initializePolyfills = () => {
  console.log('🔐 Crypto polyfill status:', {
    buffer: !!global.Buffer,
    getRandomValues: !!global.crypto?.getRandomValues,
  });
 
  return {
    buffer: !!global.Buffer,
    getRandomValues: !!global.crypto?.getRandomValues,
  };
};