const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Disable package exports to fix Skia resolution on Android with SDK 54
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
