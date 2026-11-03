const CACHE_NAME = 'idman-app-v19'; // Sürüm numarası sayfa sonunda (index.html'deki APP_VERSION ile aynı tutun)
// Sayfa isteği bu süreden uzun sürerse önbellekteki sayfa açılır
const NAV_TIMEOUT = 2500;
// Ana dosyalar
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './logo.png',
  './favicon.ico',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/icon-maskable-512x512.png',
  './icons/apple-touch-icon.png'
];

// Uygulamada kullanılan egzersiz resimleri
const imageUrls = [
    './runninng.jpg',
    // free-exercise-db (Unlicense) fotoğraflarından üretilen iki pozlu GIF'ler
    './Dumbbell-Lateral-Raise.gif',
    './Seated-Cable-Row.gif',
    './Seated-Dumbbell-Shoulder-Press.gif',
    './Single-Arm-Dumbbell-Row.gif',
    './Hack-Squat.gif',
    './Dumbbell-Bench-Press.gif',
    './Cable-Lateral-Raise.gif',
    './Dead-Bug.gif',
    './Seated-Leg-Curl.gif',
    './Glute-Bridge.gif',
    './Machine-Shoulder-Press.gif',
    './Hip-Abduction.gif',
    './Side-Lying-Leg-Raise.gif',
    './Banded-Clamshell.jpg',
    // Hareket ve muadil GIF'leri (index.html'deki DAYS listesiyle aynı tutun)
    './Leg-Press.gif',
    './LEG-EXTENSION.gif',
    './Dumbbell-Romanian-Deadlift.gif',
    './cablebicepscurl.gif',
    './f1/Lat-Pulldown.gif',
    './f1/neutral Lat-Pulldown.gif',
    './f1/lrase.gif',
    './f1/One-arm-triceps-pushdown.gif',
    './f1/High-Pulley-Overhead-Tricep-Extension.gif',
    './f1/Incline-Dumbbell-Press.gif',
    './f1/dumbbell-chest-supported-row-exercise.gif',
    './f1/Face-Pull.gif',
    './f1/cable-rear-delt-fly.gif',
    './f1/LEG_CURL.gif',
    './f1/Flexor-Incline-Dumbbell-Curls.gif',
    './f1/ez-bar-preacher-curl-exercise.gif',
    './f1/Seated-Hammer-Curl.gif',
    './f2/Chest-Press-Machine.gif',
    './f2/Z-Bar-Curl.gif',
    './f2/Weighted-Front-Plank.gif',
    './f2/Kneeling-Cable-Crunch.gif'
];

self.addEventListener('install', event => {
  // waitUntil, içindeki async işlem bitene kadar 'install' aşamasını bitirmez.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      console.log('Cache açıldı, dosyalar önbelleğe alınıyor...');
      
      // Ana dosyaları ekle
      // addAll atomiktir, biri bile başarısız olursa hepsi başarısız olur.
      // cache: 'reload' → tarayıcının HTTP önbelleğini atla; yoksa yeni sürüm eski dosyalarla kurulabilir
      const fresh = url => new Request(url, { cache: 'reload' });
      try {
        await cache.addAll(urlsToCache.map(fresh));
      } catch (err) {
         console.warn('Ana dosyalar addAll ile önbelleğe alınamadı, tek tek deneniyor...', err);
         // addAll başarısız olursa tek tek dene
         for (const url of urlsToCache) {
           try {
             await cache.add(fresh(url));
           } catch (addErr) {
             console.warn(`Install: Ana kaynak önbelleğe alınamadı: ${url}`, addErr);
           }
         }
      }
      // Resimler (~5 MB) burada BEKLENMEZ: kurulum uzarsa ve uygulama kapanırsa güncelleme yarıda kalıyordu.
      // Resimler 'activate' sonrasında arka planda iner; görüntülenenler zaten fetch sırasında önbelleğe girer.
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

  // Sayfanın kendisi: önce ağ, ama en fazla NAV_TIMEOUT ms. Ağ zayıfsa (salonda tek çizgi) önbellekteki
  // sayfa hemen açılır; ağ isteği arka planda sürer ve gelince önbelleği günceller (bir sonraki açılışta yeni sürüm).
  // Zaman sınırı yokken zayıf ağda uygulama logoda 20-40 sn bekliyordu.
  if (event.request.mode === 'navigate') {
    const network = fetch(event.request).then(async res => {
      if (res.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, res.clone());
      }
      return res;
    });
    event.waitUntil(network.catch(() => {}));
    event.respondWith(
      (async () => {
        const cached = (await caches.match(event.request)) || (await caches.match('./index.html'));
        if (!cached) return network; // ilk kurulumdan önce önbellek boş: ağı bekle
        const timeout = new Promise(resolve => setTimeout(() => resolve(cached), NAV_TIMEOUT));
        try {
          return await Promise.race([network, timeout]);
        } catch (error) {
          return cached;
        }
      })()
    );
    return;
  }

  // Diğer dosyalar için "Cache First" stratejisi
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
        // Boş yanıt (undefined) tarayıcıda ERR_FAILED hatasına yol açar; anlamlı bir 503 döndür
        return new Response('Çevrimdışı: kaynak önbellekte yok', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
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
      await self.clients.claim();
    })()
  );
  // Resimleri arka planda önbelleğe al (çevrimdışı kullanım için); etkinleşmeyi geciktirmez
  precacheImages();
});

async function precacheImages() {
  const cache = await caches.open(CACHE_NAME);
  for (const url of imageUrls) {
    try {
      if (!(await cache.match(url))) await cache.add(new Request(url, { cache: 'reload' }));
    } catch (err) {
      console.warn(`Resim önbelleğe alınamadı (sorun değil): ${url}`, err);
    }
  }
}
