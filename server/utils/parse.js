function parseTagsField(t) {
  if (!t) return [];
  try {
    const v = JSON.parse(t);
    return Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : []);
  } catch {
    return String(t).split(',').map(s => s.trim()).filter(Boolean);
  }
}

module.exports = { parseTagsField };
