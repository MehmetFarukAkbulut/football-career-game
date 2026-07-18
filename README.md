# İki Forma

## FC 26 Reyting Düellosu

Ana menüdeki **FC 26 Reyting Düellosu**, iki oyuncudan overall değeri daha yüksek olanı seçtirir. Kolay, normal ve zor seviyeleri sırasıyla belirgin, dengeli ve yakın reyting farkları üretir. Oyuncuların ana ve alternatif mevkileri veri paketinde tutulur; bu alanlar ileride ülke bazlı ilk 11 kurma oyunlarında kullanılabilir.

Reyting verisi çalışma anında internetten çağrılmaz. `data/fc26-ratings.json`, EA Sports FC 26 ratings verisinin update 2 sürümünden üretilmiş statik bir pakettir. Paket; EA oyuncu kimliği, ad, cinsiyet, overall, ana/alternatif mevkiler, ülke, kulüp ve resmi EA oyuncu sayfasını içerir. Oyunda reytingi açığa çıkaran kart görselleri kullanılmaz. Önce mevcut kariyer paketindeki doğrulanmış Transfermarkt portresi eşleştirilir; eşleşmeyen kayıtlarda EA oyuncu kimliğiyle eşleşen normal SoFIFA portresi kullanılır. Reytingleri ve fotoğraf eşlemelerini yenilemek için:

```powershell
npm run ratings:fc26
```

## Turnuva 11'i

Turnuva 11'i, yalnız güncel FC 26 paketinde overall ve mevki kaydı bulunan aktif futbolcularla 4-3-3 kadrosu kurdurur. Her mevki için seçim biçimine göre üç aday veya beş kutu gösterilir; seçilen 11'in overall ortalaması, seçilen zorlukla birlikte turnuva performans olasılığını belirler. Emekli olmuş ve güncel FC 26 reytingi bulunmayan futbolcular havuza alınmaz.

Oyunda iki seçim biçimi vardır. **Klasik seçimde** üç futbolcunun kimliği ve kariyer bilgisi görünür, overall değerleri karar verilene kadar gizli kalır ve seçimden sonra tüm adayların reytingleri açılır. **Şans kutusunda** beş kapalı kutudan biri seçilir; kutu açılınca seçilen oyuncuyla birlikte kaçırılan dört oyuncu ve tüm reytingler gösterilir. Şans havuzu kolay seviyede 2 yüksek/2 orta/1 düşük, normalde 1 yüksek/2 orta/2 düşük, zorda 1 yüksek/1 orta/3 düşük reyting katmanından oluşturulur.

Lig filtresi yalnız futbolcunun güncel kulübüne bakmaz. FC 26 kaydı güvenli biçimde kariyer veri setindeki tekil oyuncuyla eşleşiyorsa `careerPlayerId` ve `careerClubIds` statik rating paketine yazılır; oyuncunun geçmişte filtrelenen ligde A takım kariyeri bulunması da yeterlidir. Güvenli kariyer eşleşmesi bulunmayan FC 26 oyuncularında güncel lig bilgisi kullanılmaya devam eder.

Şampiyonlar Ligi senaryosu UEFA'nın güncel formatını temel alır: sekiz lig maçı, ilk sekiz için doğrudan son 16, 9–24 için iki maçlı play-off ve ardından eleme turları. 2026 Dünya Kupası senaryosu 12 adet dörderli grup, ilk iki takımla en iyi sekiz üçüncünün Son 32'ye çıkması ve şampiyonun toplam sekiz maç oynaması yapısını kullanır. Simülasyon gerçek maç sonucu iddiası değildir; takım overall ortalaması, rakip seviyesi ve seçilen zorluktan üretilmiş oyunlaştırılmış bir olasılık modelidir.

Format kaynakları: [UEFA Champions League 2026/27 Regulations, Article 17](https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/Article-17-Match-system-league-phase-Online) ve [FIFA 2026 World Cup format açıklaması](https://www.fifa.com/en/articles/article-fifa-world-cup-2026-mexico-canada-usa-new-format-tournament-football-soccer?pubDate=20250524).

Kaynaklar: [EA Sports FC resmi ratings sayfası](https://careers.ea.com/games/ea-sports-fc/ratings) ve bunun makinece okunabilir alanlarını sunan [EAFC API dokümantasyonu](https://api.msmc.cc/eafc/). Reytingler oyun güncellemeleriyle değişebildiği için paket sürümü ve üretim tarihi JSON metadata'sında saklanır.

## Gizli Futbolcu

Gizli Futbolcu modunda kullanıcı seçtiği lig havuzundan gelen bulanık portredeki oyuncuyu sekiz tahminde bulur. Her tahminden sonra ülke, takım ve mevki eşleşmeleri ile yaş/overall değerinin hedefe göre yukarı veya aşağı yönü gösterilir. Doğru tahminde ya da haklar bittiğinde gerçek fotoğraf ve oyuncu adı açıklanır. Ayarlarda aranabilir lig filtresi ve 1, 3 veya 5 futbolculuk oyun seçenekleri bulunur.

## Kariyer Peteği

Kariyer Peteği, doğrulanmış kulüp kariyeri ve istatistik alanlarından dinamik bir altıgen tahta üretir. Kullanıcı boş bir hücreyi seçip koşulu sağlayan futbolcuyu girer. Aynı futbolcu komşu kulüp, lig, milliyet, doğum dönemi veya kariyer eşiği koşullarını da sağlıyorsa bu hücreler aynı hamlede alınır. Yeni hücreler kombinasyon puanı, önceden alınmış komşular ise ısıtma puanı kazandırır. Zorluk kategori eşiklerini, lig filtresi ise kullanılabilen kulüp ve futbolcu havuzunu belirler. Eksik başarı/kupa verileri oyun tarafından tahmin edilmez.

## Kariyer Kozları

Kariyer Kozları, açık oyuncu kartındaki doğrulanmış kariyer maçı, gol, asist, millî maç veya kulüp sayısı metriklerinden birini seçerek sıradaki gizli futbolcuyla karşılaştırır. Açık kartın değeri yüksek veya eşitse oyuncu pakette ilerler. İlk yanlış seçim sarı kart, ikinci yanlış seçim kırmızı kart ve oyun sonu anlamına gelir. Paket 7, 11 veya 15 karttan oluşabilir ve aranabilir lig filtresi oyuncu havuzunu sınırlar. Tüm oyuncularda bulunmayan sezonluk orta, ikili mücadele veya faul istatistikleri kullanılmaz.

> Veri denetimi: `npm run data:audit` üretilmiş paketteki bütün oyuncuları Transfermarkt/player ID eşitliği, benzersiz kimlik, isim, milliyet kodu, doğum tarihi, fotoğraf URL'si, A takım kariyeri, kulüp referansları ve istatistik alanları açısından tarar. Rapor `data/player-data-audit.json` dosyasına yazılır. İsim benzerliğiyle kayıt birleştirilmez; kalıcı düzeltmeler generated JSON yerine override/export katmanına eklenir.

Zor soru havuzu yetmezse normal, ardından kolay havuz tekrarsız biçimde kullanılır. Ülke × Kulüp çoktan seçmelide tüm seçenekler hedef vatandaşlıktandır. Izgara; Kulüp × Kulüp, Lig × Kulüp, Ülke × Kulüp ve Karışık kriterlerini serbest metin veya çoktan seçmeli destekler; lig kriterleri Premier League, LaLiga, Serie A, Bundesliga, Ligue 1 ve Süper Lig ile sınırlıdır.

GitHub Pages üzerinde çalışan, 28 binden fazla doğrulanmış oyuncu kariyerini kullanan futbol bilgi oyunu. İki Forma ve Ülke × Forma oyunları serbest metin veya dört seçenekli oynanabilir; tek oyuncu, aynı cihazda iki oyuncu, bilgisayara karşı ve Supabase destekli beş kişiye kadar online oda biçimleri bulunur.

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

Senkronize state; oda kodu, en fazla beş oyuncu, bağlantı/hazır durumu, kilitli ayarlar, soru kimliği, kulüp/ülke kimlikleri, seçenek kimlikleri, oyuncu bazlı kapalı cevaplar, sonuç, skor, soru sırası ve sürümü taşır. Her oyuncunun cevabı ayrı kaydedilir; doğru cevap ve tüm seçimler ancak herkes cevapladıktan sonra iki saniyelik sonuç aşamasında açılır. Oturum token'ı `localStorage` içinde tutulur; sayfa yenilendiğinde oda tekrar alınır. Realtime bildirimi kaçarsa sonraki RPC yine yetkili güncel state'i döndürür.

Oda maçtan sonra kapanmaz. Son sıralama lobide gösterilir; oda sahibi aynı oyunu yeniden başlatabilir veya İki Forma, Ülke × Kulüp, Kulüp Izgarası, Kariyer İkizi ve Rastgele Beşler arasında yeni oyun/kurallar seçebilir. Her yeni maç öncesinde bütün oyuncular yeniden hazır olmalıdır.

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
