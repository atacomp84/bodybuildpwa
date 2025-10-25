const CACHE_NAME = 'idman-app-v2'; // Sürümü güncelledik
// Ana dosyalar
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './logo.png',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// Uygulamada kullanılan egzersiz resimleri
const imageUrls = [
    './dumbellbench.jpg',
    './seatedshoulder.png',
    './incline dumbell.jpg',
    './lateralraise.jpg',
    './tricepspush.jpg',
    './overheadextension.jpg',
    './latpulldown.jpg',
    './seatedcable.jpg',
    './singlearm.jpg',
    './facepull.jpg',
    './bicepcurl.jpg',
    './hummercurl.jpg',
    './leggpress.jpg',
    './legext.jpg',
    './lyingleg.jpg',
    './calfraise.jpg',
    './reversecrunch.jpg',
    './plank.jpg',
    './runninng.jpg'
];

self.addEventListener('install', event => {
  // waitUntil, içindeki async işlem bitene kadar 'install' aşamasını bitirmez.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      console.log('Cache açıldı, dosyalar önbelleğe alınıyor...');
      
      // Ana dosyaları ekle
      // addAll atomiktir, biri bile başarısız olursa hepsi başarısız olur.
      try {
        await cache.addAll(urlsToCache);
      } catch (err) {
         console.warn('Ana dosyalar addAll ile önbelleğe alınamadı, tek tek deneniyor...', err);
         // addAll başarısız olursa tek tek dene
         for (const url of urlsToCache) {
           try {
             await cache.add(url);
           } catch (addErr) {
             console.warn(`Install: Ana kaynak önbelleğe alınamadı: ${url}`, addErr);
           }
         }
      }

      // Resimleri önbelleğe al
      // Resimlerin yüklenmesi install'u başarısız kılmasın, o yüzden tek tek deniyoruz.
      console.log('Resimler önbelleğe alınıyor...');
      for (const url of imageUrls) {
        try {
          // cache.add() dosyayı fetch edip cache'e atar
          await cache.add(url);
        } catch (err) {
          // Bir resim başarısız olursa sadece uyar, kuruluma devam et
          console.warn(`Resim önbelleğe alınamadı (sorun değil, devam ediliyor): ${url}`, err);
        }
      }
      console.log('Tüm varlıklar önbelleğe alındı.');
    })()
  );
  // Yeni service worker'ın eskisiyle çakışmadan hemen aktif olmasını sağla
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  // Sadece http/https isteklerini işle, chrome-extension:// vb. olanları yoksay
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // "Cache First" stratejisi
  event.respondWith(
    (async () => {
      // 1. Önbellekte var mı diye bak
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        // Önbellekte varsa, doğrudan onu döndür
        return cachedResponse;
      }

      // 2. Önbellekte yoksa, ağdan getirmeyi dene
      try {
        const networkResponse = await fetch(event.request);
        
        // 3. Ağı yanıtını alırsak, önbelleğe ekle ve döndür
        // Sadece 'GET' isteklerini ve başarılı (200) yanıtları önbelleğe al
        if (event.request.method === 'GET' && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            // Yanıtı klonla, çünkü hem cache'e hem tarayıcıya gidecek
            await cache.put(event.request, networkResponse.clone());
        }

        return networkResponse;
      } catch (error) {
        // Ağ hatası. Önbellekte de yoktu.
        console.warn('Ağ hatası, kaynak getirilemedi ve önbellekte de yok:', event.request.url, error);
        // İsteğe bağlı olarak burada 'çevrimdışı' bir sayfa döndürebiliriz.
        // return caches.match('./offline.html');
      }
    })()
  );
});

self.addEventListener('activate', event => {
  // Eski, gereksiz cache'leri temizle
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Eski cache temizleniyor:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
      // Aktif service worker'ın sayfayı hemen kontrol etmesini sağla
      return self.clients.claim();
    })()
  );
});
