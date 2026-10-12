// Small helpers for drawing screens.

import { applyTranslations, currentLang } from '../core/i18n.js';

// Escape text typed by a user (e.g. a learner's name) before putting it in HTML.
export function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Replace the whole screen with new HTML and fill in the translations.
export function mount(html) {
  const app = document.getElementById('app');
  app.innerHTML = html;
  applyTranslations(app);
  window.scrollTo(0, 0);
  return app;
}

// Show or hide the footer (hidden while a learner is answering questions).
export function setPlaying(playing) {
  document.body.classList.toggle('playing', playing);
}

// Seconds with one decimal, using the right decimal sign for the language.
export function formatSeconds(ms) {
  const locale = currentLang() === 'af' ? 'af-ZA' : 'en-ZA';
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(ms / 1000) + ' s';
}
