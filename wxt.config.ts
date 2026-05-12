import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Chrome Proxy Manager',
    description: 'Route Chrome traffic through HTTP, HTTPS, or SOCKS proxies.',
    version: '0.1.0',
    permissions: ['proxy', 'storage', 'webRequest', 'webRequestAuthProvider'],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'Proxy Manager',
    },
  },
});
