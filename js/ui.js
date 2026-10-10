// js/ui.js — общие UI-функции: тосты, форматирование, утилиты.
import { EUR_RATE } from './config.js';

// ---------- Тосты ----------
let toastRoot = null;

function ensureToastRoot() {
  if (!toastRoot) {
    toastRoot = document.getElementById('toast-root');
    if (!toastRoot) {
      toastRoot = document.createElement('div');
      toastRoot.id = 'toast-root';
      toastRoot.className = 'toast-root';
      document.body.appendChild(toastRoot);
    }
  }
  return toastRoot;
}

// Показать всплывающее сообщение. type: 'info' | 'success' | 'error'.
export function toast(message, type = 'info') {
  const root = ensureToastRoot();
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  root.appendChild(el);

  // Авто-скрытие через 3 сек, затем удаляем из DOM.
  setTimeout(() => {
    el.classList.add('toast-hide');
    setTimeout(() => el.remove(), 200);
  }, 3000);
}

// ---------- Форматирование ----------
const rsdFmt = new Intl.NumberFormat('sr-RS', {
  style: 'currency',
  currency: 'RSD',
});

// Цена в RSD (например, "1.234,56 RSD").
export function formatRsd(value) {
  return rsdFmt.format(Number(value) || 0);
}

// Цена в EUR, пересчёт по курсу.
export function formatEur(priceRsd) {
  const eur = (Number(priceRsd) || 0) / EUR_RATE;
  return eur.toFixed(2) + ' €';
}

// Дата в формате ru-RU.
export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU');
}

// ---------- Утилиты ----------
// Экранирование HTML для безопасного вывода пользовательских данных.
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Детерминированный HSL-оттенок по имени магазина (Maxi — всегда один цвет).
export function storeColor(name) {
  const s = String(name || '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 70%, 88%)`;
}

// Тёмный текст под светлый бейдж.
export function storeTextColor(name) {
  const s = String(name || '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 45%, 30%)`;
}

// Сортировка по строке (регистронезависимо, безопасно к null).
export function byString(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'ru');
}
