import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('service worker precaches every generated lazy route for offline use', async () => {
  const listeners = {};
  const added = [];
  const stored = [];
  let skippedWaiting = false;

  globalThis.self = {
    registration: { scope: 'https://example.com/seoultrip2026/' },
    location: { origin: 'https://example.com' },
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    skipWaiting() {
      skippedWaiting = true;
    },
    clients: { claim: async () => {} }
  };
  globalThis.caches = {
    open: async () => ({
      put: async (key) => stored.push(String(key)),
      addAll: async (urls) => added.push(...urls.map(String))
    }),
    keys: async () => []
  };
  globalThis.fetch = async (input) => {
    if (String(input).includes('precache-manifest.json')) {
      return new Response(JSON.stringify({
        files: [
          './assets/index.js',
          './assets/Itinerary.js',
          './assets/Wishlist.js',
          './assets/SettingsPage.js'
        ]
      }), { status: 200 });
    }
    return new Response(
      '<script src="./assets/index.js"></script><link href="./assets/index.css" rel="stylesheet">',
      { status: 200, headers: { 'content-type': 'text/html' } }
    );
  };

  const serviceWorkerUrl = `${pathToFileURL(resolve('public/sw.js')).href}?test=${Date.now()}`;
  await import(serviceWorkerUrl);

  let installPromise;
  listeners.install({
    waitUntil(promise) {
      installPromise = promise;
    }
  });
  await installPromise;

  assert.equal(skippedWaiting, true);
  assert.ok(stored.includes('./'));
  assert.ok(stored.includes('./precache-manifest.json'));
  assert.ok(added.includes('./assets/Itinerary.js'));
  assert.ok(added.includes('./assets/Wishlist.js'));
  assert.ok(added.includes('./assets/SettingsPage.js'));
  assert.ok(added.includes('https://example.com/seoultrip2026/assets/index.css'));

  delete globalThis.self;
  delete globalThis.caches;
  delete globalThis.fetch;
});
