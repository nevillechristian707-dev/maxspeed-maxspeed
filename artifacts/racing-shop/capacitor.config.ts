import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.maxspeed.app',
  appName: 'Maxspeed',
  webDir: 'dist/public',
  bundledWebRuntime: false,
  server: {
    url: 'https://maxspeed-racingshop-production.up.railway.app',
    cleartext: true
  }
};

export default config;
