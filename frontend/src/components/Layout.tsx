import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import Disclaimer from './Disclaimer'
import { useAuth } from '../contexts/AuthContext'

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/history', label: 'History' },
  { to: '/chat', label: 'Chat' },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth()
  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-gray-100">
      <nav className="border-b border-gray-800 bg-gray-900">
        <div className="mx-auto flex max-w-5xl items-center gap-8 px-4 py-3">
          <span className="text-lg font-bold text-emerald-400">Stockwatch</span>
          <div className="flex gap-4">
            {links.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `rounded px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
          <button
            onClick={signOut}
            className="ml-auto text-sm text-gray-400 hover:text-gray-100 transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      <Disclaimer />
    </div>
  )
}
