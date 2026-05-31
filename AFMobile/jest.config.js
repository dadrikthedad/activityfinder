module.exports = {
  preset: 'jest-expo',
  testTimeout: 10000,
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@s77rt/react-native-sodium)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@shared/(.*)$': '<rootDir>/../shared/$1',
  },
  collectCoverageFrom: [
    'components/ende-til-ende/**/*.ts',
    'features/auth/services/**/*.ts',
    'features/auth/hooks/**/*.ts',
    '!**/*.d.ts',
  ],
};
