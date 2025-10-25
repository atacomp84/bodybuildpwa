const CACHE_NAME = 'idman-app-v1';
// Sadece yerel (same-origin) statik dosyaları önbelleğe almak daha güvenli.
const urlsToCache = [
 '/', '/index.html', '/manifest.json', '/logo.png',
'/icons/icon-192x192.png', '/icons/icon-512x512.png'

];

self.addEventListener('install', event => {
  // cache.addAll tek tek başarısız olursa tüm işlemi reddeder; bu yüzden
  // kendi caching mantığımızı kullanıyoruz ve başarısız olanları atlıyoruz.
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (const url of urlsToCache) {
        try {
const request = new Request(url);
          const response = await fetch(request);
          if (response && response.ok) {
            await cache.put(request, response.clone());
          } else {
            console.warn('Install: kaynak önbelleğe alınmadı (bad response):', url, response && response.status);
          }
        } catch (err) {
          console.warn('Install: kaynak önbelleğe alınamadı (fetch failed):', url, err);
        }
      }
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    (async () => {
      // Eğer istek http/https protokolü dışındaysa (ör. chrome-extension://),
      // servis worker'ın cache mantığına sokmayalım — doğrudan fetch et.
      try {
        const proto = new URL(event.request.url).protocol;
        if (proto !== 'http:' && proto !== 'https:') {
          return fetch(event.request);
        }
      } catch (e) {
        // URL parse edilemezse, fallback olarak doğrudan fetch et
        return fetch(event.request);
      }

      return caches.match(event.request).then(response => {
        if (response) {
          return response;
        }

        return fetch(event.request)
          .then(response => {
            // Geçersiz cevapsa sadece döndür
            if (!response || !response.ok) {
              return response;
            }

            // Sadece aynı-origin ve GET isteklerini cache'le
            try {
              const reqUrl = new URL(event.request.url);
              const isSameOrigin = reqUrl.origin === self.location.origin;
              const isHttpScheme = reqUrl.protocol === 'http:' || reqUrl.protocol === 'https:';
              const isGet = event.request.method === 'GET';

              if (isSameOrigin && isHttpScheme && isGet) {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                  try {
                    cache.put(event.request, responseToCache);
                  } catch (err) {
                    // Unsupported scheme (chrome-extension:// vb.) veya diğer hatalarda sıkıntıyı yut
                    console.warn('Cache put atlanıyor (unsupported request):', event.request.url, err);
                  }
                });
              }
            } catch (e) {
              // URL parse hatası veya benzeri durumlarda cache işleminden vazgeç
              console.warn('Fetch handler URL parse hatası veya caching atlandı:', event.request.url, e);
            }

            return response;
          })
          .catch(err => {
            // Ağ hatası olursa cache'den dönmeyi dene, yoksa hatayı ileri fırlat
            console.warn('Fetch failed, trying cache fallback for:', event.request.url, err);
            return caches.match(event.request).then(cached => cached || Promise.reject(err));
          });
      });
    })()
  );
});