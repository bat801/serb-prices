// js/storage.js — обёртка над localStorage для кэша.

// Прочитать значение из кэша (или null при ошибке/отсутствии).
export function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('Ошибка чтения кэша:', e);
    return null;
  }
}

// Записать значение в кэш.
export function writeCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Ошибка записи кэша:', e);
  }
}

// Удалить ключ кэша.
export function clearCache(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error('Ошибка очистки кэша:', e);
  }
}
