// js/index.js — логика главной страницы (база цен).
import { supabase, isSupabaseConfigured } from './supabase.js';
import { CACHE_KEY_PRODUCTS } from './config.js';
import { readCache, writeCache } from './storage.js';
import {
  toast, formatRsd, formatEur, formatDate, escapeHtml,
  storeColor, storeTextColor,
} from './ui.js';

const els = {
  cards: document.getElementById('cards'),
  empty: document.getElementById('empty'),
  search: document.getElementById('search'),
  store: document.getElementById('filter-store'),
  category: document.getElementById('filter-category'),
  statusDot: document.getElementById('status-dot'),
  statusText: document.getElementById('status-text'),
  refresh: document.getElementById('refresh-btn'),
};

// Текущее состояние.
let allProducts = [];
let state = { search: '', store: '', category: '' };

// ---------- Утилиты ----------
function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), 'ru')
  );
}

function setStatus(source) {
  // source: 'server' | 'cache' | 'loading'
  els.statusDot.className = 'dot';
  if (source === 'server') {
    els.statusDot.classList.add('is-server');
    els.statusText.textContent = 'Данные с сервера';
  } else if (source === 'cache') {
    els.statusDot.classList.add('is-cache');
    els.statusText.textContent = 'Данные из кэша';
  } else {
    els.statusText.textContent = 'Загрузка…';
  }
}

// ---------- Скелетон ----------
function renderSkeleton(count = 6) {
  els.empty.classList.add('hidden');
  els.cards.innerHTML = Array.from({ length: count }).map(() => `
    <div class="skeleton-card">
      <div class="skeleton skeleton-line tall"></div>
      <div class="skeleton skeleton-line w40"></div>
      <div class="skeleton skeleton-line w80"></div>
      <div class="skeleton skeleton-line w60"></div>
    </div>
  `).join('');
}

// ---------- Фильтрация ----------
function getFiltered() {
  const q = state.search.trim().toLowerCase();
  return allProducts.filter((p) => {
    if (state.store && p.store !== state.store) return false;
    if (state.category && p.category !== state.category) return false;
    if (q) {
      const haystack = [p.name, p.brand, p.category, p.store, p.comment]
        .filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

// ---------- Рендер карточек ----------
function cardHtml(p) {
  const brand = p.brand
    ? `<div class="card__brand">${escapeHtml(p.brand)}</div>` : '';
  const category = p.category
    ? `<span class="badge">${escapeHtml(p.category)}</span>` : '';
  const store = `<span class="badge" style="background:${storeColor(p.store)};color:${storeTextColor(p.store)};border-color:transparent;">${escapeHtml(p.store)}</span>`;
  const comment = p.comment
    ? `<div class="card__comment">${escapeHtml(p.comment)}</div>` : '';

  return `
    <article class="card">
      <div class="card__head">
        <div>
          <div class="card__title">${escapeHtml(p.name)}</div>
          ${brand}
        </div>
      </div>
      <div class="card__badges">${category}${store}</div>
      <div class="card__prices">
        <span class="price-rsd">${formatRsd(p.price_rsd)}</span>
        <span class="price-eur">${formatEur(p.price_rsd)}</span>
      </div>
      ${comment}
      <div class="card__date">Обновлено: ${formatDate(p.updated_at)}</div>
    </article>
  `;
}

function render() {
  const list = getFiltered().sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), 'ru')
  );

  if (list.length === 0) {
    els.cards.innerHTML = '';
    els.empty.classList.remove('hidden');
    if (allProducts.length > 0) {
      els.empty.querySelector('p').textContent = 'Ничего не найдено по фильтрам.';
    } else {
      els.empty.querySelector('p').textContent = 'Пока ничего нет. Добавь товары в админке.';
    }
    return;
  }

  els.empty.classList.add('hidden');
  els.cards.innerHTML = list.map(cardHtml).join('');
}

// ---------- Фильтры (select) ----------
function populateFilters() {
  const stores = uniqueSorted(allProducts.map((p) => p.store));
  const categories = uniqueSorted(allProducts.map((p) => p.category));

  const rebuild = (select, values, allLabel) => {
    const current = select.value;
    select.innerHTML = `<option value="">${allLabel}</option>` +
      values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    // Восстановить выбор, если он ещё доступен.
    select.value = values.includes(current) ? current : '';
  };

  rebuild(els.store, stores, 'Все магазины');
  rebuild(els.category, categories, 'Все категории');
  state.store = els.store.value;
  state.category = els.category.value;
}

// ---------- Загрузка данных ----------
function loadFromCache() {
  const cached = readCache(CACHE_KEY_PRODUCTS);
  if (Array.isArray(cached) && cached.length) {
    allProducts = cached;
    populateFilters();
    render();
    setStatus('cache');
    return true;
  }
  return false;
}

async function loadFromServer() {
  if (!isSupabaseConfigured) {
    toast('Supabase не настроен. Укажи ключи в js/config.js', 'error');
    setStatus('cache');
    render();
    return;
  }
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    allProducts = data || [];
    writeCache(CACHE_KEY_PRODUCTS, allProducts);
    populateFilters();
    render();
    setStatus('server');
  } catch (e) {
    console.error('Ошибка загрузки:', e);
    toast('Нет связи, показаны сохранённые данные', 'error');
    setStatus('cache');
    render();
  }
}

// ---------- События ----------
els.search.addEventListener('input', (e) => {
  state.search = e.target.value;
  render();
});

els.store.addEventListener('change', (e) => {
  state.store = e.target.value;
  render();
});

els.category.addEventListener('change', (e) => {
  state.category = e.target.value;
  render();
});

els.refresh.addEventListener('click', async () => {
  renderSkeleton();
  setStatus('loading');
  await loadFromServer();
});

// ---------- Старт ----------
(async function init() {
  const hasCache = loadFromCache();
  if (!hasCache) {
    renderSkeleton();
    setStatus('loading');
  }
  await loadFromServer();
})();
