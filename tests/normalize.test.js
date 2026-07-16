'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const {normalizeText,wordPrefixMatch,canonicalPair}=require('../src/shared/normalize');
test('Türkçe karakter ve aksan normalizasyonu',()=>{assert.equal(normalizeText('İlkay Gündoğan'),'ilkay gundogan');assert.equal(normalizeText('IŞIK ÇAĞRI'),'isik cagri');});
test('ad veya soyad kelime başlangıcından eşleşir',()=>{assert.equal(wordPrefixMatch('Robert Lewandowski','lew'),true);assert.equal(wordPrefixMatch('Cristiano Ronaldo','ron'),true);assert.equal(wordPrefixMatch('Christian Eriksen','er'),true);});
test('ters kulüp sırası aynı çift anahtarını üretir',()=>assert.equal(canonicalPair(9,2),canonicalPair(2,9)));
