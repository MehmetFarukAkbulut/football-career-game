# İki Forma

İki Forma, futbolcu kariyerlerini keşfetmeye ve futbol hafızasını sınamaya yönelik, sunucu gerektirmeden tarayıcıda çalışan bir futbol oyunudur.

## Oyunlar

- İki kulüpte de oynamış futbolcuyu bulma
- Vatandaşlık ve kulüp kariyeri eşleştirme
- Bilgisayara karşı veya aynı cihazda iki oyunculu 3×3 kulüp ızgarası
- Kulüp karşılaştırma, futbolcu kataloğu ve gezgin futbolcular

Izgarada doğru ve yanlış her tahminden sonra sıra değişir. Bir futbolcu oyun boyunca yalnız bir kez kullanılabilir. Doğrulanmış kiralık A takım kariyerleri geçerli; altyapı ve rezerv takım kariyerleri geçersizdir.

Bilgisayar rakibi statik veri paketindeki gerçek oyunculardan seçim yapar. Kolay, normal ve zor modları sırasıyla yaklaşık %52, %72 ve %90 doğruluk ile farklı düşünme süreleri kullanır. Yanlış cevaplar da iki kulüpten en az biriyle ilişkili gerçek oyunculardır.

## Yerelde çalıştırma

```bash
npm install
npm run web:serve
```

## Veri ve asset iş akışı

```bash
npm run web:export
npm run assets:dry-run
npm run assets:update
```

`data/web-data.json`; benzersiz Transfermarkt kaynak kimlikleri, lig/ülke metadata'sı ve doğrulanmış A takım kariyerlerini taşır. Manuel denetlenen kariyerler `data/web-career-overrides.json` içinde tutulur. Aynı adlı oyuncular isimle birleştirilmez.

Kulüp armaları yalnız kaynak ve lisansı kaydedilebilen resmî kulüp veya Wikimedia Commons girdilerinden kademeli eklenir. `data/club-assets.json` kaynak URL'si ve lisans manifestidir; eksik veya kırık görseller baş harf avatarına düşer. Transfermarkt toplu görsel kaynağı olarak scrape edilmez.

## Test

```bash
npm test
npm run lint
```

Manuel kontrol matrisi masaüstü, tablet, mobil; iki oyun modu; üç zorluk; klavye kullanımı; kırık görsel ve çevrimdışı senaryoları kapsar.

## GitHub Pages

`main` branch'ine push, test ve lint başarılı olduktan sonra `.github/workflows/pages.yml` ile statik siteyi dağıtır. Asset yolları repository alt yoluyla uyumlu göreli yollardır.

## Veri kapsamı

Kariyer paketi açık maç verileri ve kimlik doğrulamasından türetilir. Her tarihsel kariyer veya her kulüp/oyuncu görseli kapsanmayabilir; eksik metadata oyunun çalışmasını engellemez.
