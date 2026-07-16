# İki Forma

İki Forma; futbolcu kariyerlerini keşfetmeye ve futbol hafızasını sınamaya yönelik, tamamen tarayıcıda çalışan statik bir web sitesidir.

## Özellikler

- İki kulüpte de oynamış futbolcuyu bulma oyunu
- Vatandaşlık × kulüp kariyeri oyunu (milli maç şartı yoktur)
- 3×3 kulüp ızgarası
- İki kulübün tüm ortak oyuncularını karşılaştırma
- 100 oyunculuk sayfalar, isim/kulüp/milliyet filtresi ve çoklu sıralama içeren katalog
- En fazla farklı kulüpte oynayan futbolcular sıralaması
- Responsive, erişilebilir ve animasyonlu web arayüzü
- Sunucu veya API anahtarı gerektirmeyen statik çalışma

## Siteyi yerelde çalıştırma

Tarayıcıların yerel JSON dosyası güvenlik kısıtlaması nedeniyle dosyayı doğrudan çift tıklamak yerine küçük bir HTTP sunucusu kullanın:

```bash
npx serve .
```

Ardından terminalde gösterilen adrese gidin.

## Web verisini güncelleme

Kaynak SQLite veritabanı hazırken:

```bash
node scripts/export-web-data.js
```

Bu komut `data/web-data.json` dosyasını üretir. Web sitesi bu statik dosyayı okuyarak çalışır.

## Teknoloji

- HTML5
- CSS3
- Vanilla JavaScript
- Statik JSON veri paketi
- GitHub Pages

## Veri yaklaşımı

Oyuncular kaynak oyuncu kimlikleriyle tutulur; benzer adlara göre kişi veya kulüp birleştirilmez. Web paketinde yalnızca doğrulanmış A takım kariyerleri bulunur. Vatandaşlık bilgisi kaynak oyuncu profilindeki vatandaşlık alanıdır; milli takımda oynama şartı anlamına gelmez.

## Dağıtım

`main` dalına yapılan her push, `.github/workflows/pages.yml` üzerinden GitHub Pages dağıtımını tetikler.

## Lisans ve veri kaynağı

Uygulama kodu proje sahibine aittir. Açık veri paketi, projedeki veri üretim betiklerinde belirtilen kaynaklardan türetilmiştir. Yeniden kullanım öncesinde kaynak veri lisanslarını ayrıca kontrol edin.
