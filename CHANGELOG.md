# Değişiklik günlüğü

## Yayımlanmamış - 2026-07-16

- Oğuzhan Özyakup'un 2011-12 Arsenal A takımındaki iki Lig Kupası görünümü denetlenerek Arsenal–Beşiktaş kesişimine eklendi.
- Oyuncu kimliği ad yerine kaynak ID'siyle eşleniyor; aynı adlı farklı futbolcuların kariyerlerinin birleşmesi engellendi ve DB temiz kaynaktan yeniden kuruldu.
- Karşılaştırma, ızgara ve gezgin listelerinde teyitsiz P54 adayları kaldırıldı; Real Madrid–Beşiktaş Marcelo hatası için regresyon testi eklendi.
- Fotoğrafı olmayan veya görseli yüklenemeyen oyuncularda soru işareti/baş harf yerine boş görsel alan kullanılıyor.
- Izgara puanı her doğru hücrede 100, kazanınca 300 bonus olarak X/O skoruna bağlandı; yanlış cevap sırayı rakibe geçiriyor.
- Kolay ızgara bilinen kulüpler ve hücre başına en az üç cevapla sınırlandı; normal en az iki, zor en az bir cevap kullanıyor.
- Emmanuel Adebayor'un sekiz hedef lig kulübü denetlenip kalıcı kariyer düzeltmesine eklendi; kariyer listeleri açık veri adaylarını da tekilleştirerek kapsıyor.
- Ana menüye dokuz geçerli kulüp kesişimli, tek oyunculu bilgisayar rakibi ve iki oyunculu Kulüp Izgarası eklendi.
- Ana menüye kulüp sayısı ve kariyer kulüpleriyle Gezgin Futbolcular sıralaması eklendi.
- Oyuncu önerileri farklı A takım kulübü sayısına göre sıralanıyor; adın altında kulüp sayısı ve kariyer kulüpleri gösteriliyor.
- Seçili kulüp alanına yeniden tıklandığında mevcut ad otomatik seçiliyor ve tüm liste açılıyor; eski adı elle silmeden yeni seçim yapılabiliyor.
- Altı hedef lig için CC0 lisanslı açık veri import hattı eklendi; yaklaşık 992 bin maç görünümü 25 binden fazla doğrulanmış oyuncu-kulüp ilişkisine dönüştürüldü.
- Kulüp alias/mapping birleştirme, oyuncu tekilleştirme, devam eden indirme ve SHA-256 manifesti eklendi.
- Beyaz sistem `datalist` bileşeni koyu temalı, filtrelenebilir ve tüm kulüpleri gösteren combobox ile değiştirildi.
- Kulüp alanlarındaki zorunlu varsayılan değerler kaldırıldı ve aynı kulüp karşı tarafta gizlendi.
- 3 turluk oyun eklendi; geri sayımda kulüp kartları gizlendi.
- Karşılaştırma kapsamı yerel Wikidata P54 adaylarıyla genişletildi; doğrulanmış ve teyit bekleyen sonuçlar ayrı gösteriliyor.
- Veri durumu toplam ve A takım doğrulanmış kariyer kayıtlarını ayrı gösterecek şekilde netleştirildi.
- Boş oyuncu öneri listesinde ok tuşu kullanımının geçersiz seçim indeksi oluşturması engellendi.
- Portable build normal sıkıştırmaya alındı ve Windows EXE açılışı doğrulandı.

## 2.0.0 - 2026-07-15

- Canlı isim tabanlı Wikidata çözümlemesi kaldırıldı; kalıcı kulüp slug/QID mapping'i eklendi.
- Yerel SQLite şeması, indeksler, doğrulanmış temel veri ve atomik açık veri güncelleyicisi eklendi.
- Oyun, arama ve kulüp karşılaştırma sorguları SQLite'a geçirildi.
- Güvenli preload/IPC hata sınırı, CSP, sandbox ve yerel loglama eklendi.
- Autocomplete, filtre, sıralama, sayfalama, final tur özeti ve erişilebilir klavye durumları eklendi.
- Birim/entegrasyon testleri ile portable build zinciri eklendi.
