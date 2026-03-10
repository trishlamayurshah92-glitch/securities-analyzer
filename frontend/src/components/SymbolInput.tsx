import { useState } from 'react'

interface Props {
  onSubmit: (symbol: string) => void
  placeholder?: string
  buttonText?: string
}

export default function SymbolInput({
  onSubmit,
  placeholder = 'AAPL',
  buttonText = 'Add',
}: Props) {
  const [value, setValue] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const symbol = value.trim().toUpperCase()
    if (symbol) {
      onSubmit(symbol)
      setValue('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        placeholder={placeholder}
        className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 outline-none focus:border-emerald-500"
      />
      <button
        type="submit"
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition"
      >
        {buttonText}
      </button>
    </form>
  )
}
