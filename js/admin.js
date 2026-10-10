// js/admin.js — логика админки: пароль, CRUD товаров, магазины, категории.
import { supabase, isSupabaseConfigured } from './supabase.js';
import { ADMIN_PASSWORD, CACHE_KEY_PRODUCTS } from './config.js';
import { readCache, writeCache } from './storage.js';
import {
  toast, formatRsd, formatEur, escapeHtml,
} from './ui.js';

const SESSION_KEY = 'admin_ok';

// ---------- DOM ----------
const els = {
  loginScreen: document.getElementById('login-screen'),
  loginForm: document.getElementById('login-form'),
  loginPassword: document.getElementById('login-password'),
  app: document.getElementById('admin-app'),
  logout: document.getElementById('logout-btn'),

  form: document.getElementById('product-form'),
  formTitle: document.getElementById('form-title'),
  formSection: document.getElementById('form-section'),
  formHint: document.getElementById('form-hint'),
  cancelEdit: document.getElementById('cancel-edit'),
  id: document.getElementById('product-id'),
  name: document.getElementById('p-name'),
  brand: document.getElementById('p-brand'),
  category: document.getElementById('p-category'),
  store: document.getElementById('p-store'),
  price: document.getElementById('p-price'),
  eur: document.getElementById('p-eur'),
  comment: document.getElementById('p-comment'),

  body: document.getElementById('products-body'),
  productsEmpty: document.getElementById('products-empty'),
  addBtn: document.getElementById('add-btn'),
  exportJson: document.getElementById('export-json'),
  exportCsv: document.getElementById('export-csv'),
  importFile: document.getElementById('import-file'),

  brandList: document.getElementById('brand-list'),
  categoryList: document.getElementById('category-list'),
  storeList: document.getElementById('store-list'),

  storeForm: document.getElementById('store-form'),
  storeName: document.getElementById('store-name'),
  storesList: document.getElementById('stores-list'),

  categoryForm: document.getElementById('category-form'),
  categoryName: document.getElementById('category-name'),
  categoriesList: document.getElementById('categories-list'),
};

// ---------- Состояние ----------
let products = [];
let stores = [];
let categories = [];

// ---------- Авторизация ----------
function isAuthed() {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

function showApp() {
  els.loginScreen.classList.add('hidden');
  els.app.classList.remove('hidden');
  startAdmin();
}

function showLogin() {
  els.app.classList.add('hidden');
  els.loginScreen.classList.remove('hidden');
  els.loginPassword.focus();
}

els.loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (els.loginPassword.value === ADMIN_PASSWORD) {
    sessionStorage.setItem(SESSION_KEY, '1');
    els.loginPassword.value = '';
    showApp();
  } else {
    toast('Неверный пароль', 'error');
  }
});

els.logout.addEventListener('click', () => {
  sessionStorage.removeItem(SESSION_KEY);
  showLogin();
});

// ---------- Загрузка данных ----------
async function fetchAll() {
  if (!isSupabaseConfigured) {
    toast('Supabase не настроен. Укажи ключи в js/config.js', 'error');
  }
  try {
    const [prodRes, storeRes, catRes] = await Promise.all([
      supabase.from('products').select('*').order('updated_at', { ascending: false }),
      supabase.from('stores').select('*').order('name'),
      supabase.from('categories').select('*').order('name'),
    ]);

    if (prodRes.error) throw prodRes.error;
    if (storeRes.error) throw storeRes.error;
    if (catRes.error) throw catRes.error;

    products = prodRes.data || [];
    stores = storeRes.data || [];
    categories = catRes.data || [];

    writeCache(CACHE_KEY_PRODUCTS, products);
    renderAll();
  } catch (e) {
    console.error('Ошибка загрузки:', e);
    toast('Ошибка загрузки данных: ' + e.message, 'error');
    // Фолбэк на кэш.
    const cached = readCache(CACHE_KEY_PRODUCTS);
    if (Array.isArray(cached)) {
      products = cached;
      renderAll();
    }
  }
}

function renderAll() {
  renderTable();
  renderStores();
  renderCategories();
  renderDatalists();
}

// ---------- Таблица товаров ----------
function renderTable() {
  const sorted = [...products].sort((a, b) =>
    String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
  );

  if (sorted.length === 0) {
    els.body.innerHTML = '';
    els.productsEmpty.classList.remove('hidden');
    return;
  }
  els.productsEmpty.classList.add('hidden');

  els.body.innerHTML = sorted.map((p) => `
    <tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.brand)}</td>
      <td>${escapeHtml(p.category)}</td>
      <td>${escapeHtml(p.store)}</td>
      <td class="num">${formatRsd(p.price_rsd)}</td>
      <td class="num muted">${formatEur(p.price_rsd)}</td>
      <td>${escapeHtml(p.comment) || '<span class="muted">—</span>'}</td>
      <td class="actions">
        <button class="btn btn-icon" data-action="edit" data-id="${p.id}" aria-label="Редактировать">✏️</button>
        <button class="btn btn-icon" data-action="delete" data-id="${p.id}" aria-label="Удалить">🗑️</button>
      </td>
    </tr>
  `).join('');
}

els.body.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === 'edit') startEdit(id);
  if (btn.dataset.action === 'delete') deleteProduct(id);
});

// ---------- Форма товара ----------
els.price.addEventListener('input', () => {
  const val = parseFloat(els.price.value);
  els.eur.value = isFinite(val) ? formatEur(val) : '';
});

function resetForm() {
  els.form.reset();
  els.id.value = '';
  els.eur.value = '';
  els.formTitle.textContent = '➕ Добавить товар';
  els.cancelEdit.classList.add('hidden');
  els.formHint.textContent = '';
}

els.cancelEdit.addEventListener('click', resetForm);

function startEdit(id) {
  const p = products.find((x) => x.id === id);
  if (!p) return;
  els.id.value = p.id;
  els.name.value = p.name || '';
  els.brand.value = p.brand || '';
  els.category.value = p.category || '';
  els.store.value = p.store || '';
  els.price.value = p.price_rsd ?? '';
  els.eur.value = formatEur(p.price_rsd);
  els.comment.value = p.comment || '';
  els.formTitle.textContent = '✏️ Редактировать товар';
  els.cancelEdit.classList.remove('hidden');
  els.formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  els.name.focus();
}

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    name: els.name.value.trim(),
    brand: els.brand.value.trim() || null,
    category: els.category.value.trim() || null,
    store: els.store.value.trim(),
    price_rsd: parseFloat(els.price.value),
    comment: els.comment.value.trim() || null,
  };

  if (!payload.name || !payload.store || !isFinite(payload.price_rsd)) {
    toast('Заполни обязательные поля', 'error');
    return;
  }

  const id = els.id.value;
  els.formHint.textContent = 'Сохранение…';

  try {
    if (id) {
      const { data, error } = await supabase
        .from('products').update(payload).eq('id', id).select().single();
      if (error) throw error;
      const idx = products.findIndex((p) => p.id === id);
      if (idx >= 0) products[idx] = data;
    } else {
      const { data, error } = await supabase
        .from('products').insert(payload).select().single();
      if (error) throw error;
      products.unshift(data);
    }

    writeCache(CACHE_KEY_PRODUCTS, products);
    renderAll();
    resetForm();
    toast('Сохранено', 'success');

    // Возможно, появился новый магазин/бренд — обновим справочники.
    await ensureStoreExists(payload.store);
    await ensureCategoryExists(payload.category);
  } catch (err) {
    console.error('Ошибка сохранения:', err);
    els.formHint.textContent = '';
    toast('Ошибка сохранения: ' + err.message, 'error');
  }
});

async function deleteProduct(id) {
  const p = products.find((x) => x.id === id);
  if (!p) return;
  if (!confirm(`Удалить «${p.name}» (${p.store})?`)) return;

  try {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    products = products.filter((x) => x.id !== id);
    writeCache(CACHE_KEY_PRODUCTS, products);
    renderAll();
    toast('Удалено', 'success');
  } catch (err) {
    console.error('Ошибка удаления:', err);
    toast('Ошибка удаления: ' + err.message, 'error');
  }
}

// ---------- Datalist ----------
function renderDatalists() {
  const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ru'));
  els.brandList.innerHTML = brands
    .map((b) => `<option value="${escapeHtml(b)}"></option>`).join('');

  els.categoryList.innerHTML = categories
    .map((c) => `<option value="${escapeHtml(c.name)}"></option>`).join('');

  els.storeList.innerHTML = stores
    .map((s) => `<option value="${escapeHtml(s.name)}"></option>`).join('');
}

// ---------- Магазины ----------
async function ensureStoreExists(name) {
  if (!name) return;
  if (stores.some((s) => s.name.toLowerCase() === name.toLowerCase())) return;
  await addStore(name, true);
}

function renderStores() {
  if (stores.length === 0) {
    els.storesList.innerHTML = '<li class="muted small">Список пуст.</li>';
    return;
  }
  els.storesList.innerHTML = stores.map((s) => `
    <li class="row" style="gap:6px;">
      <span class="badge">${escapeHtml(s.name)}</span>
      <button class="btn btn-icon btn-sm" data-kind="store" data-id="${s.id}" aria-label="Удалить магазин">🗑️</button>
    </li>
  `).join('');
}

async function addStore(name, silent = false) {
  const clean = String(name || '').trim();
  if (!clean) return;
  try {
    const { data, error } = await supabase
      .from('stores').insert({ name: clean }).select().single();
    if (error) throw error;
    stores.push(data);
    stores.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    renderStores();
    renderDatalists();
    if (!silent) toast('Магазин добавлен', 'success');
  } catch (err) {
    console.error('Ошибка добавления магазина:', err);
    if (!silent) toast('Ошибка: ' + err.message, 'error');
  }
}

els.storeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  addStore(els.storeName.value);
  els.storeName.value = '';
});

// ---------- Категории ----------
async function ensureCategoryExists(name) {
  if (!name) return;
  if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) return;
  await addCategory(name, true);
}

function renderCategories() {
  if (categories.length === 0) {
    els.categoriesList.innerHTML = '<li class="muted small">Список пуст.</li>';
    return;
  }
  els.categoriesList.innerHTML = categories.map((c) => `
    <li class="row" style="gap:6px;">
      <span class="badge">${escapeHtml(c.name)}</span>
      <button class="btn btn-icon btn-sm" data-kind="category" data-id="${c.id}" aria-label="Удалить категорию">🗑️</button>
    </li>
  `).join('');
}

async function addCategory(name, silent = false) {
  const clean = String(name || '').trim();
  if (!clean) return;
  try {
    const { data, error } = await supabase
      .from('categories').insert({ name: clean }).select().single();
    if (error) throw error;
    categories.push(data);
    categories.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    renderCategories();
    renderDatalists();
    if (!silent) toast('Категория добавлена', 'success');
  } catch (err) {
    console.error('Ошибка добавления категории:', err);
    if (!silent) toast('Ошибка: ' + err.message, 'error');
  }
}

els.categoryForm.addEventListener('submit', (e) => {
  e.preventDefault();
  addCategory(els.categoryName.value);
  els.categoryName.value = '';
});

// Удаление магазинов/категорий (делегирование).
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-kind]');
  if (!btn) return;
  const kind = btn.dataset.kind; // 'store' | 'category'
  const id = btn.dataset.id;
  const table = kind === 'store' ? 'stores' : 'categories';
  const label = kind === 'store' ? 'магазин' : 'категорию';
  if (!confirm(`Удалить ${label}?`)) return;

  try {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
    if (kind === 'store') {
      stores = stores.filter((s) => s.id !== id);
      renderStores();
    } else {
      categories = categories.filter((c) => c.id !== id);
      renderCategories();
    }
    renderDatalists();
    toast('Удалено', 'success');
  } catch (err) {
    console.error('Ошибка удаления:', err);
    toast('Ошибка: ' + err.message, 'error');
  }
});

// ---------- Кнопка «Добавить товар» ----------
els.addBtn.addEventListener('click', () => {
  resetForm();
  els.formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  els.name.focus();
});

// ---------- Экспорт ----------
function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

els.exportJson.addEventListener('click', () => {
  const exportData = products.map((p) => ({
    name: p.name,
    brand: p.brand,
    category: p.category,
    store: p.store,
    price_rsd: p.price_rsd,
    comment: p.comment,
  }));
  download('products.json', JSON.stringify(exportData, null, 2), 'application/json');
  toast('Экспорт JSON готов', 'success');
});

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return '"' + s.replace(/"/g, '""') + '"';
}

els.exportCsv.addEventListener('click', () => {
  const header = ['name', 'brand', 'category', 'store', 'price_rsd', 'comment'];
  const rows = products.map((p) =>
    [p.name, p.brand, p.category, p.store, p.price_rsd, p.comment].map(csvCell).join(',')
  );
  const csv = '\uFEFF' + [header.map(csvCell).join(','), ...rows].join('\r\n');
  download('products.csv', csv, 'text/csv;charset=utf-8');
  toast('Экспорт CSV готов', 'success');
});

// ---------- Импорт ----------
els.importFile.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('Ожидался массив товаров');

    const rows = parsed
      .map((p) => ({
        name: String(p.name || '').trim(),
        brand: p.brand ? String(p.brand).trim() : null,
        category: p.category ? String(p.category).trim() : null,
        store: String(p.store || '').trim(),
        price_rsd: Number(p.price_rsd),
        comment: p.comment ? String(p.comment).trim() : null,
      }))
      .filter((p) => p.name && p.store && isFinite(p.price_rsd));

    if (rows.length === 0) {
      toast('В файле нет корректных товаров', 'error');
      return;
    }
    if (!confirm(`Добавить ${rows.length} товар(ов) в базу?`)) return;

    const { data, error } = await supabase.from('products').insert(rows).select();
    if (error) throw error;

    products = [...(data || []), ...products];
    writeCache(CACHE_KEY_PRODUCTS, products);
    renderAll();
    toast(`Импортировано: ${rows.length}`, 'success');
  } catch (err) {
    console.error('Ошибка импорта:', err);
    toast('Ошибка импорта: ' + err.message, 'error');
  } finally {
    els.importFile.value = '';
  }
});

// ---------- Старт ----------
async function startAdmin() {
  const cached = readCache(CACHE_KEY_PRODUCTS);
  if (Array.isArray(cached)) {
    products = cached;
    renderTable();
  }
  await fetchAll();
}

if (isAuthed()) {
  showApp();
} else {
  showLogin();
}
