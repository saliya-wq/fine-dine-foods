import { useState } from 'react'
import { useStaff } from '../staffSession.jsx'
import ManagerConsole from './ManagerConsole.jsx'
import RiderPortal from './RiderPortal.jsx'

export default function Staff() {
  const { staff, signIn, signOut } = useStaff()

  if (!staff) return <StaffLogin onSignIn={signIn} />

  // sysadmin and admin see the manager console too — it's the superset view.
  if (staff.role === 'rider') {
    return (
      <Shell staff={staff} onSignOut={signOut}>
        <RiderPortal />
      </Shell>
    )
  }

  return (
    <Shell staff={staff} onSignOut={signOut}>
      <ManagerConsole />
    </Shell>
  )
}

function Shell({ staff, onSignOut, children }) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-calista-gold">{staff.role}</p>
          <h1 className="font-display text-3xl">{staff.name}</h1>
        </div>
        <button
          onClick={onSignOut}
          className="text-sm px-4 py-2 border border-calista-ink/20 rounded-full hover:border-calista-gold"
        >
          Sign out
        </button>
      </div>
      {children}
    </div>
  )
}

function StaffLogin({ onSignIn }) {
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSignIn(key.trim())
    } catch (err) {
      setError(err.message || 'That key was not recognised.')
      setBusy(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-20">
      <h1 className="font-display text-3xl mb-2 text-center">Staff sign in</h1>
      <p className="text-calista-ink/60 text-sm mb-6 text-center">Enter your access key.</p>
      <form onSubmit={submit} className="space-y-3">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="XXX-XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck="false"
          className="w-full px-4 py-3 border border-calista-ink/20 rounded-lg text-center tracking-widest font-mono uppercase focus:outline-none focus:border-calista-gold"
        />
        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        <button
          type="submit"
          disabled={busy || !key.trim()}
          className="w-full bg-calista-ink text-calista-cream py-3 rounded-full font-semibold disabled:opacity-40"
        >
          {busy ? 'Checking…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
