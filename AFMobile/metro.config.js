// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add the parent directory and shared folder to watchFolders
config.watchFolders = [
  path.resolve(__dirname, '..'), // Parent directory (ActivityFinder)
  path.resolve(__dirname, '../shared'), // Shared folder
];

// Configure resolver to find modules outside AFMobile
config.resolver.platforms = ['ios', 'android', 'web'];
config.resolver.alias = {
  '@shared': path.resolve(__dirname, '../shared'),
};

// Allow imports from outside the project root
config.resolver.nodeModulesPath = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../node_modules'),
];

// Enable symlinks (useful for monorepos)
config.resolver.unstable_enableSymlinks = true;

// Increase the transformer worker count for better performance
config.maxWorkers = 2;

module.exports = config;