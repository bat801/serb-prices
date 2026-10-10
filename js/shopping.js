// js/shopping.js — общий список покупок с оптимистичными обновлениями.
import { supabase, isSupabaseConfigured } from './supabase.js';
import { CACHE_KEY_SHOPPING } from './config.js';
import { readCache, writeCache } from './storage.js';
import { toast, escapeHtml } from './ui.js';

const els = {
  form: document.getElementById('add-form'),
  input: document.getElementById('new-item'),
  list: document.getElementById('list'),
  empty: document.getElementById('empty'),
  clearDone: document.getElementById('clear-done'),
  refresh: document.getElementById('refresh-btn'),
  status: document.getElementById('status-text'),
};

let items = [];

// ---------- Кэш ----------
function saveCache() {
  writeCache(CACHE_KEY_SHOPPING, items);
}

function setStatus(text) {
  els.status.textContent = text;
}

// ---------- Рендер ----------
function render() {
  if (items.length === 0) {
    els.list.innerHTML = '';
    els.empty.classList.remove('hidden');
    return;
  }
  els.empty.classList.add('hidden');

  const sorted = [...items].sort((a, b) =>
    String(a.created_at || '').localeCompare(String(b.created_at || ''))
  );

  els.list.innerHTML = sorted.map((it) => `
    <li class="shop-item ${it.is_done ? 'is-done' : ''}" data-id="${it.id}">
      <input class="shop-item__check" type="checkbox" data-role="toggle" ${it.is_done ? 'checked' : ''}
             aria-label="Куплено" />
      <div class="shop-item__text" contenteditable="true" data-role="text"
           aria-label="Текст пункта">${escapeHtml(it.text)}</div>
      <button class="btn btn-icon" data-role="delete" aria-label="Удалить">🗑️</button>
    </li>
  `).join('');
}

// ---------- Добавление ----------
els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = els.input.value.trim();
  if (!text) return;

  // Оптимистично добавляем с временным id.
  const tempId = 'temp-' + Date.now();
  const temp = { id: tempId, text, is_done: false, created_at: new Date().toISOString() };
  items.push(temp);
  els.input.value = '';
  render();
  saveCache();

  try {
    const { data, error } = await supabase
      .from('shopping_list').insert({ text }).select().single();
    if (error) throw error;
    const idx = items.findIndex((x) => x.id === tempId);
    if (idx >= 0) items[idx] = data;
    saveCache();
    render();
  } catch (err) {
    console.error('Ошибка добавления:', err);
    items = items.filter((x) => x.id !== tempId);
    saveCache();
    render();
    toast('Не удалось добавить: ' + err.message, 'error');
  }
});

// ---------- Делегирование событий списка ----------
els.list.addEventListener('change', (e) => {
  if (e.target.matches('input[data-role="toggle"]')) {
    const li = e.target.closest('li');
    toggleItem(li.dataset.id, e.target.checked);
  }
});

els.list.addEventListener('blur', (e) => {
  if (e.target.matches('[data-role="text"]')) {
    const li = e.target.closest('li');
    editItem(li.dataset.id, e.target);
  }
}, true);

// Enter в contenteditable — завершить редактирование.
els.list.addEventListener('keydown', (e) => {
  if (e.target.matches('[data-role="text"]') && e.key === 'Enter') {
    e.preventDefault();
    e.target.blur();
  }
});

els.list.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-role="delete"]');
  if (!btn) return;
  const li = btn.closest('li');
  deleteItem(li.dataset.id);
});

// ---------- Toggle ----------
async function toggleItem(id, checked) {
  const it = items.find((x) => x.id === id);
  if (!it) return;
  const prev = it.is_done;
  it.is_done = checked;
  render();
  saveCache();

  try {
    const { error } = await supabase
      .from('shopping_list').update({ is_done: checked }).eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.error('Ошибка переключения:', err);
    it.is_done = prev;
    render();
    saveCache();
    toast('Не удалось сохранить: ' + err.message, 'error');
  }
}

// ---------- Редактирование текста ----------
async function editItem(id, el) {
  const it = items.find((x) => x.id === id);
  if (!it) return;

  const newText = el.textContent.trim();
  if (!newText) {
    // Пустой текст — вернуть прежний.
    el.textContent = it.text;
    return;
  }
  if (newText === it.text) return;

  const prev = it.text;
  it.text = newText;
  el.textContent = newText;
  saveCache();

  try {
    const { error } = await supabase
      .from('shopping_list').update({ text: newText }).eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.error('Ошибка редактирования:', err);
    it.text = prev;
    render();
    saveCache();
    toast('Не удалось сохранить: ' + err.message, 'error');
  }
}

// ---------- Удаление ----------
async function deleteItem(id) {
  const it = items.find((x) => x.id === id);
  if (!it) return;
  if (!confirm(`Удалить «${it.text}»?`)) return;

  const backup = items.slice();
  items = items.filter((x) => x.id !== id);
  render();
  saveCache();

  try {
    const { error } = await supabase.from('shopping_list').delete().eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.error('Ошибка удаления:', err);
    items = backup;
    render();
    saveCache();
    toast('Не удалось удалить: ' + err.message, 'error');
  }
}

// ---------- Очистить купленное ----------
els.clearDone.addEventListener('click', async () => {
  const doneIds = items.filter((x) => x.is_done).map((x) => x.id);
  if (doneIds.length === 0) {
    toast('Нет купленных позиций', 'info');
    return;
  }
  if (!confirm(`Удалить ${doneIds.length} купленных позиций?`)) return;

  const backup = items.slice();
  items = items.filter((x) => !x.is_done);
  render();
  saveCache();

  try {
    const { error } = await supabase.from('shopping_list').delete().in('id', doneIds);
    if (error) throw error;
    toast('Очищено', 'success');
  } catch (err) {
    console.error('Ошибка очистки:', err);
    items = backup;
    render();
    saveCache();
    toast('Не удалось очистить: ' + err.message, 'error');
  }
});

// ---------- Загрузка ----------
async function loadFromServer() {
  if (!isSupabaseConfigured) {
    toast('Supabase не настроен. Укажи ключи в js/config.js', 'error');
    setStatus('Показаны данные из кэша');
    return;
  }
  try {
    const { data, error } = await supabase
      .from('shopping_list').select('*').order('created_at', { ascending: true });
    if (error) throw error;

    items = data || [];
    saveCache();
    render();
    setStatus('Данные с сервера');
  } catch (err) {
    console.error('Ошибка загрузки:', err);
    toast('Нет связи, показаны сохранённые данные', 'error');
    setStatus('Данные из кэша');
  }
}

els.refresh.addEventListener('click', loadFromServer);

// ---------- Старт ----------
(async function init() {
  const cached = readCache(CACHE_KEY_SHOPPING);
  if (Array.isArray(cached)) {
    items = cached;
  }
  render();
  if (items.length > 0) setStatus('Данные из кэша');
  await loadFromServer();
})();
