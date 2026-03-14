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
    <div className="flex min-h-screen flex-col bg-[#F8F9FA] text-[#172B4D]">
      <nav className="border-b border-[#DFE1E6] bg-white">
        <div className="flex items-center gap-8 px-6 py-3">
          <span className="text-lg font-bold text-[#0052CC]">Stockwatch</span>
          <div className="flex gap-4">
            {links.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `rounded px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-[#DEEBFF] text-[#0052CC]'
                      : 'text-[#5E6C84] hover:text-[#172B4D]'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
          <button
            onClick={signOut}
            className="ml-auto text-sm text-[#5E6C84] hover:text-[#172B4D] transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>
      <main className="w-full flex-1 px-6 py-6">{children}</main>
      <Disclaimer />
    </div>
  )
}
