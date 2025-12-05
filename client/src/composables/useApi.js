export const apiBase = import.meta.env.VITE_API_BASE_URL || ''

export const apiFetch = (path, options = {}) => {
  const t = typeof window !== 'undefined' ? (localStorage.getItem('token') || '') : ''
  const url = /^https?:\/\//.test(path) ? path : `${apiBase}${path}`
  const headers = { ...(options.headers || {}) }
  if (t) headers['Authorization'] = `Bearer ${t}`
  return fetch(url, { ...options, headers })
}
