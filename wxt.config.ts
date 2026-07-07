import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Chrome Proxy Manager',
    description: 'Route Chrome traffic through HTTP, HTTPS, or SOCKS proxies.',
    version: '1.1.2',
    permissions: ['proxy', 'storage', 'webRequest', 'webRequestAuthProvider'],
    host_permissions: ['<all_urls>'],
    icons: {
      16: '/icon-16.png',
      32: '/icon-32.png',
      48: '/icon-48.png',
      128: '/icon-128.png',
    },
    action: {
      default_title: 'Proxy Manager',
      default_icon: {
        16: '/icon-16.png',
        32: '/icon-32.png',
        48: '/icon-48.png',
        128: '/icon-128.png',
      },
    },
  },
});
