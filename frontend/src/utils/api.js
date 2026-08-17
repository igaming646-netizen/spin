const BASE = '/api'

async function req(path, opts = {}) {
  try {
    const hasBody = opts.body != null
    const r = await fetch(BASE + path, {
      ...opts,
      headers: hasBody ? { 'Content-Type': 'application/json' } : {},
      body: hasBody ? JSON.stringify(opts.body) : undefined,
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      console.error('API error', r.status, err)
      return null
    }
    return r.json()
  } catch (e) {
    console.error('API error', e)
    return null
  }
}

export const api = {
  getChars: () => req('/characters'),
  createChar: (c) => req('/characters', { method: 'POST', body: c }),
  updateChar: (id, c) => req('/characters/' + id, { method: 'PUT', body: c }),
  deleteChar: (id) => req('/characters/' + id, { method: 'DELETE' }),
  saveBattle: (b) => req('/battles', { method: 'POST', body: b }),
}
