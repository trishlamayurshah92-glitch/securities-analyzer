import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client'

interface Props {
  onSubmit: (symbol: string) => void
  placeholder?: string
  buttonText?: string
}

interface Suggestion {
  symbol: string
  description: string
}

export default function SymbolInput({
  onSubmit,
  placeholder = 'Search ticker…',
  buttonText = 'Add',
}: Props) {
  const [value, setValue] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Suggestion | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = value.trim()
    if (!trimmed || selected?.symbol === trimmed) {
      setSuggestions([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const results = await api.searchSymbols(trimmed)
        setSuggestions(results)
        setOpen(results.length > 0)
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [value, selected])

  const handleSelect = (s: Suggestion) => {
    setSelected(s)
    setValue(s.symbol)
    setSuggestions([])
    setOpen(false)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim().toUpperCase()
    if (!trimmed) return

    // If user typed manually without selecting, validate via search
    if (!selected || selected.symbol !== trimmed) {
      setLoading(true)
      try {
        const results = await api.searchSymbols(trimmed)
        const exact = results.find((r) => r.symbol === trimmed)
        if (!exact) {
          setError(`"${trimmed}" is not a recognized ticker symbol.`)
          setLoading(false)
          return
        }
      } catch {
        setError('Could not validate symbol. Please try again.')
        setLoading(false)
        return
      }
      setLoading(false)
    }

    setError(null)
    setSelected(null)
    setValue('')
    onSubmit(trimmed)
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-1">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value.toUpperCase())
              setSelected(null)
              setError(null)
            }}
            placeholder={placeholder}
            autoComplete="off"
            className={`rounded-lg border px-3 py-2 text-sm text-[#172B4D] placeholder-[#8993A4] outline-none focus:border-[#0052CC] bg-white w-52 ${
              error ? 'border-red-400' : 'border-[#C1C7D0]'
            }`}
          />

          {open && (
            <ul className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-[#DFE1E6] bg-white shadow-lg">
              {suggestions.map((s) => (
                <li
                  key={s.symbol}
                  onMouseDown={() => handleSelect(s)}
                  className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-[#F0F2F5]"
                >
                  <span className="font-semibold text-sm text-[#0052CC]">{s.symbol}</span>
                  <span className="ml-3 truncate text-xs text-[#5E6C84]">{s.description}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[#0052CC] px-4 py-2 text-sm font-medium text-white hover:bg-[#0065FF] disabled:opacity-50 transition"
        >
          {loading ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : buttonText}
        </button>
      </form>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
