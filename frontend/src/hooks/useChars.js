import { useState, useEffect } from 'react'
import { api } from '../utils/api'

export function useChars() {
  const [chars, setChars] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getChars().then(data => {
      if (data) setChars(data)
      setLoading(false)
    })
  }, [])

  async function addChar(c) {
    const result = await api.createChar(c)
    if (result) setChars(prev => [...prev, c])
  }

  async function updateChar(id, data) {
    const result = await api.updateChar(id, data)
    if (result) setChars(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
  }

  async function deleteChar(id) {
    const result = await api.deleteChar(id)
    if (result) setChars(prev => prev.filter(c => c.id !== id))
  }

  async function upsertChar(c) {
    const exists = chars.find(x => x.id === c.id)
    if (exists) {
      const result = await api.updateChar(c.id, c)
      if (result) setChars(prev => prev.map(x => x.id === c.id ? c : x))
    } else {
      const result = await api.createChar(c)
      if (result) setChars(prev => [...prev, c])
    }
  }

  return { chars, setChars, loading, addChar, updateChar, deleteChar, upsertChar }
}
