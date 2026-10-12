// Language handling.
// All visible text lives in lang/<code>.json. Elements with a data-i18n
// attribute get their text filled in from the active language file.
// t('results.correct', { n: 5 }) replaces {n} in the text with 5.

import { load, save } from './storage.js';

export const LANGUAGES = { af: 'Afrikaans', en: 'English' };
const DEFAULT_LANG = 'af';

let strings = {};
let current = DEFAULT_LANG;

export function currentLang() {
  return current;
}

export async function setLanguage(code) {
  if (!LANGUAGES[code]) code = DEFAULT_LANG;
  const res = await fetch(`lang/${code}.json`);
  strings = await res.json();
  current = code;
  save('lang', code);
  document.documentElement.lang = code;
  applyTranslations();
}

export async function initLanguage() {
  await setLanguage(load('lang', DEFAULT_LANG));
}

// Look up a key like "home.tagline". Falls back to the key itself so
// missing translations are easy to spot while developing.
export function t(key, vars = {}) {
  const value = key.split('.').reduce((obj, part) => obj?.[part], strings);
  if (typeof value !== 'string') return key;
  return value.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? vars[name] : m));
}

export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}
