'use strict';

const TURKISH_MAP = { 'ı': 'i', 'İ': 'i', 'I': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g', 'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c' };

function normalizeText(value = '') {
  return String(value).replace(/[ıİIşŞğĞüÜöÖçÇ]/g, char => TURKISH_MAP[char])
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function wordPrefixMatch(name, query) {
  const q = normalizeText(query);
  return q.length >= 2 && normalizeText(name).split(' ').some(word => word.startsWith(q));
}

function canonicalPair(a, b) {
  return [Number(a), Number(b)].sort((x, y) => x - y).join(':');
}

module.exports = { normalizeText, wordPrefixMatch, canonicalPair };
