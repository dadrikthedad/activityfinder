// plugins/withAndroidxCoreResolution.js
//
// Expo config plugin som tvinger androidx.core til 1.15.0.
// Nødvendig fordi react-native-keychain v10 trekker inn androidx.core:1.17.0
// som krever compileSdk 36 og AGP 8.9.1 — inkompatibelt med Expo 53 / AGP 8.8.2.

const { withProjectBuildGradle } = require('@expo/config-plugins');

const RESOLUTION_BLOCK = `
  // Tvinger androidx.core til 1.15.0 — react-native-keychain v10 trekker inn 1.17.0
  // som er inkompatibelt med Expo 53 / AGP 8.8.2 / compileSdk 35.
  configurations.all {
    resolutionStrategy {
      force 'androidx.core:core:1.15.0'
      force 'androidx.core:core-ktx:1.15.0'
    }
  }
`;

const withAndroidxCoreResolution = (config) => {
  return withProjectBuildGradle(config, (mod) => {
    const contents = mod.modResults.contents;

    // Idempotent — ikke legg til hvis den allerede er der
    if (contents.includes("androidx.core:core:1.15.0")) {
      return mod;
    }

    // Sett inn rett før den siste } i allprojects-blokken
    mod.modResults.contents = contents.replace(
      /(allprojects\s*\{[\s\S]*?)(^\})/m,
      `$1${RESOLUTION_BLOCK}}`
    );

    return mod;
  });
};

module.exports = withAndroidxCoreResolution;
