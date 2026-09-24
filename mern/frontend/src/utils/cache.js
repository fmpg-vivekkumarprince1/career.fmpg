const cache = new Map();

export const setCache = (key, value, ttl) => {
  const expires = Date.now() + ttl;
  cache.set(key, { value, expires });
};

export const getCache = (key) => {
  const cached = cache.get(key);
  if (!cached) {
    return null;
  }

  if (Date.now() > cached.expires) {
    cache.delete(key);
    return null;
  }

  return cached.value;
};

export const deleteCache = (key) => {
  if (!key) {
    cache.clear();
    return;
  }
  cache.delete(key);
};

export const clearCachePattern = (prefix) => {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
};