# İki Forma

> Veri denetimi: `npm run data:audit` üretilmiş paketteki bütün oyuncuları Transfermarkt/player ID eşitliği, benzersiz kimlik, isim, milliyet kodu, doğum tarihi, fotoğraf URL'si, A takım kariyeri, kulüp referansları ve istatistik alanları açısından tarar. Rapor `data/player-data-audit.json` dosyasına yazılır. İsim benzerliğiyle kayıt birleştirilmez; kalıcı düzeltmeler generated JSON yerine override/export katmanına eklenir.

Zor soru havuzu yetmezse normal, ardından kolay havuz tekrarsız biçimde kullanılır. Ülke × Kulüp çoktan seçmelide tüm seçenekler hedef vatandaşlıktandır. Izgara; Kulüp × Kulüp, Lig × Kulüp, Ülke × Kulüp ve Karışık kriterlerini serbest metin veya çoktan seçmeli destekler; lig kriterleri Premier League, LaLiga, Serie A, Bundesliga, Ligue 1 ve Süper Lig ile sınırlıdır.

GitHub Pages üzerinde çalışan, 28 binden fazla doğrulanmış oyuncu kariyerini kullanan futbol bilgi oyunu. İki Forma ve Ülke × Forma oyunları serbest metin veya dört seçenekli oynanabilir; tek oyuncu, aynı cihazda iki oyuncu, bilgisayara karşı ve Supabase destekli online iki oyuncu biçimleri bulunur.

Kulüp Izgarası, Kariyer İkizi ve Rastgele Beşler de aynı oda kodlu online altyapıyı kullanır. Kariyer İkizi ve Rastgele Beşler serbest metin veya dört seçenekli oynanabilir. Futbolcular farklı sorularda ve hücrelerde tekrar kullanılabilir; bunun için ayrıca bir ayar gösterilmez.

## Oyun ve soru kuralları

- İki Forma doğru cevabı iki hedef kulübün de A takımında oynamıştır. Yanlış seçeneklerin her biri kulüplerden tam olarak birinde oynamıştır.
- Ülke × Forma doğru cevabı hedef vatandaşlık ve A takım kulübü koşullarının ikisini sağlar. Yanlış seçeneklerin her biri tam olarak bir koşulu sağlar.
- Seçenekler isimle değil `playerId` ile doğrulanır. Duplicate ID, birden fazla doğru, eksik kariyer ve tekrar kullanım kontrollerinden geçmeyen soru gösterilmez.
- Kolay seviye `elite`/`popular`, normal seviye `elite`/`popular`/`standard`, zor seviye tüm doğrulanmış kulüpleri kullanabilir. Galatasaray, Fenerbahçe, Beşiktaş ve Trabzonspor kolay/normal havuzundadır.
- Çoktan seçmeli düğmeler Tab, ok tuşları, Enter ve Space ile kullanılabilir; sonuç yalnız renkle değil ikon ve metinle de açıklanır.

## Yerelde çalıştırma ve test

```bash
npm install
npm run web:serve
npm run test:web
npm run lint
npm run web:smoke
```

Online sistemi Supabase olmadan iki sekmede geliştirmek için siteyi `?onlineMock=1` sorgusuyla açın. Bu mod `localStorage` ve `BroadcastChannel` kullanır, ekranda geliştirme mock'u olarak işaretlenir ve gerçek internet oyunu değildir.

## Supabase online multiplayer kurulumu

Supabase seçildi çünkü statik GitHub Pages istemcisinden kullanılabilir, Realtime düşük gecikmeli değişiklik bildirimi sağlar ve PostgreSQL RPC işlemleri sıra/cevap güncellemesini satır kilidiyle atomik yapabilir.

1. Ücretsiz bir Supabase projesi oluşturun.
2. SQL Editor içinde [`supabase/schema.sql`](supabase/schema.sql) dosyasının tamamını çalıştırın.
3. Project Settings → API bölümünden Project URL ve yalnızca **Publishable key** (`sb_publishable_...`; eski projelerde anon key) değerini alın. Secret/service-role key kullanmayın.
4. [`web/runtime-config.js`](web/runtime-config.js) dosyasını şu şekilde doldurun:

```js
window.IKI_FORMA_CONFIG = Object.freeze({
  supabaseUrl: "https://PROJECT_REF.supabase.co",
  supabasePublishableKey: "sb_publishable_...",
  onlineMode: "production",
});
```

5. Değişikliği GitHub Pages'e dağıtın ve iki farklı cihazda oda oluşturma/katılma akışını sınayın.

Publishable key tarayıcı uygulamalarında açık olması tasarlanan public yapılandırmadır. Güvenlik anahtarı saklamaya değil SQL katmanına dayanır: `game_rooms` üzerinde RLS açıktır ve anon/authenticated rollerine tablo erişimi verilmez. State yalnız oda oyuncusunun rastgele 256-bit token'ı ile `get_game_room` RPC'sinden okunur. Token veritabanında SHA-256 özetiyle saklanır. Altı karakterli oda kodu belirsiz karakterleri dışlayan kriptografik RNG ile üretilir; erişim için oda kodu tek başına yetmez.

Her değişiklik `FOR UPDATE` kilidi ve `stateVersion` kontrolü kullanır. Eski istemci state'i ezemez, aktif olmayan oyuncu cevaplayamaz, soru iki kez cevaplanamaz ve ayarlar başladıktan sonra kilitlenir. Production SQL, doğru cevap ID'lerini public state'ten cevaplanana kadar çıkarıp yalnız erişilemeyen `answer_keys` sütununda tutar. Realtime kanalı yalnız yeni sürüm numarasını bildirir; istemci token'lı RPC ile state'i tekrar alır. Odalar iki saat sonra RPC düzeyinde geçersizdir; dosyanın sonundaki isteğe bağlı `pg_cron` temizliği fiziksel satırları da siler.

`.env.example` CI veya ileride eklenecek build adımı için aynı değerlerin şablonudur. Mevcut saf statik dağıtım doğrudan `runtime-config.js` kullanır.

## Online state ve yeniden bağlantı

Senkronize state; oda kodu, oyuncular, bağlantı/hazır durumu, kilitli ayarlar, soru kimliği, kulüp/ülke kimlikleri, seçenek kimlikleri, aktif sıra, cevaplayan, seçim, sonuç, skor, soru sırası ve sürümü taşır. Oturum token'ı `sessionStorage` içinde tutulur; sayfa yenilendiğinde oda tekrar alınır. Realtime bildirimi kaçarsa sonraki RPC yine yetkili güncel state'i döndürür.

Gerçek cihazlar arası çalışma Supabase projesi ve public yapılandırma olmadan etkinleşmez. Disabled durumda arayüz kurulum gerektiğini açıkça söyler; sahte oda sistemini production online oyun olarak sunmaz.

## Bilinirlik modeli

`npm run data:popularity`, `data/web-data.json` içine statik `popularityScore` ve `popularityTier` alanlarını yazar. Model şunları dengeler:

- [UEFA'nın beş yıllık kulüp katsayıları](https://www.uefa.com/nationalassociations/uefarankings/?year=2026),
- [EA Sports FC rating ekosistemi](https://www.ea.com/games/ea-sports-fc/ratings) (güç göstergesidir, tek başına popülerlik değildir),
- lig ve lig seviyesi,
- uluslararası/genel tanınırlık için editoryal eşikler,
- veri paketindeki A takım kariyeri kapsama yoğunluğu,
- oyuncu için maç, gol, milli maç, piyasa değeri ve oynadığı en bilinen kulüp.

Bu sınıflandırma resmî veya bilimsel bir popülerlik sıralaması değil, oyun zorluğunu dengeleyen sürümlü bir tasarım verisidir. Üretim mantığı [`scripts/enrich-popularity.js`](scripts/enrich-popularity.js) içindedir.

## Veri ve asset iş akışı

```bash
npm run web:export
npm run data:popularity
npm run assets:dry-run
```

`data/web-data.json` benzersiz Transfermarkt kaynak kimlikleri, lig/ülke metadata'sı ve doğrulanmış A takım kariyerlerini taşır. Aynı adlı oyuncular birleştirilmez. Kulüp armaları yalnız kaynağı/lisansı manifestte bulunan resmî veya Wikimedia girdilerinden gelir; kırık görsel baş harf fallback'ine düşer.

## GitHub Pages

Pull request'lerde `.github/workflows/pages.yml` test ve lint çalıştırır. `main` push'u başarılı olursa aynı workflow statik siteyi GitHub Pages'e dağıtır. Supabase ayarları eklenmeden çevrimdışı oyunların tamamı çalışmaya devam eder; online giriş yapılandırma mesajı gösterir.
