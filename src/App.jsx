// src/App.jsx
import React, { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import AuthPage from './components/AuthPage'
import NightSky from './components/NightSky'
import './index.css'

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

export default function App() {
  const [user, setUser] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    initialize()
    // eslint-disable-next-line
  }, [])

  // new: drift position updater (runs in current user's tab)
useEffect(() => {
  if (!user) return
  const email = (user.email || '').toLowerCase()
  let lastSent = Date.now()

  const interval = setInterval(async () => {
    // find this user's record in memory
    const me = users.find(
      (u) => (u.email || '').toLowerCase() === email && u.is_online
    )
    if (!me) return

    // send current position every 4 seconds (slow network-friendly)
    if (Date.now() - lastSent > 4000) {
      lastSent = Date.now()
      const { error } = await supabase.rpc('update_user_position', {
        p_email: email,
        p_x: me.current_x,
        p_y: me.current_y,
      })
      if (error) console.warn('position update error', error)
    }
  }, 1000)

  return () => clearInterval(interval)
}, [user, users])


  async function initialize() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await markUserOnline(session.user)
      }
      setInitialized(true)
    } catch (e) {
      console.error('init error', e)
    } finally {
      setLoading(false)
    }
  }

  // Real-time subscription
  useEffect(() => {
    if (!initialized) return
    const channel = supabase
      .channel('user_positions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_positions' }, (payload) => {
        console.log('RT payload', payload)
        const row = payload.new ?? payload.record ?? payload.payload
        if (!row) return
        const email = (row.email || '').toLowerCase()
        if (payload.eventType === 'INSERT' || payload.event === 'INSERT') {
          setUsers(prev => {
            if (prev.some(p => (p.email || '').toLowerCase() === email)) {
              return prev.map(p => (p.email || '').toLowerCase() === email ? { ...p, ...row } : p)
            }
            return [...prev, row]
          })
        } else if (payload.eventType === 'UPDATE' || payload.event === 'UPDATE') {
          setUsers(prev => prev.map(p => (p.email || '').toLowerCase() === email ? { ...p, ...row } : p))
        } else if (payload.eventType === 'DELETE' || payload.event === 'DELETE') {
          const old = payload.old || {}
          setUsers(prev => prev.filter(p => (p.email || '').toLowerCase() !== (old.email || '').toLowerCase()))
        }
      })
      .subscribe(status => console.log('channel status', status))

    return () => supabase.removeChannel(channel)
  }, [initialized])

  // periodic fetch sync
  useEffect(() => {
    if (!initialized) return
    fetchAllUsers()
    const i = setInterval(fetchAllUsers, 10000)
    return () => clearInterval(i)
  }, [initialized])

  async function fetchAllUsers() {
    try {
      const { data, error } = await supabase.from('user_positions').select('*').order('created_at', { ascending: true })
      if (error) throw error
      if (data) setUsers(data)
    } catch (e) {
      console.error('fetchAllUsers error', e)
    }
  }

  async function markUserOnline(authUser) {
    try {
      const email = (authUser.email || '').toLowerCase()
      const { data, error } = await supabase.rpc('get_or_create_user_position', { p_user_id: authUser.id, p_email: email })
      if (error) throw error
      // rpc returns row object
      const row = Array.isArray(data) ? data[0] : data
      if (row) {
        setUsers(prev => {
          if (prev.some(p => (p.email || '').toLowerCase() === (row.email || '').toLowerCase())) {
            return prev.map(p => (p.email || '').toLowerCase() === (row.email || '').toLowerCase() ? { ...p, ...row } : p)
          }
          return [...prev, row]
        })
      }
      await fetchAllUsers()
    } catch (e) {
      console.error('markUserOnline error', e)
    }
  }

  async function markUserOffline(email) {
    try {
      const userEmail = (email || '').toLowerCase()
      const { error } = await supabase.rpc('mark_user_offline_by_email', { user_email: userEmail })
      if (error) throw error
      // optimistic local update
      setUsers(prev => prev.map(p => (p.email || '').toLowerCase() === userEmail ? { ...p, is_online: false, luminosity: 0.1 } : p))
    } catch (e) {
      console.error('markUserOffline error', e)
    }
  }

async function handleSignOut() {
  try {
    if (!user) return
    const email = (user.email || '').toLowerCase()
    console.log('🚪 Signing out:', email)

    // 1️⃣ mark offline first
    const { error } = await supabase.rpc('mark_user_offline_by_email', {
      user_email: email,
    })
    if (error) throw error
    console.log('✅ DB updated: offline')

    // 2️⃣ sign out from auth
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) throw signOutError

    // 3️⃣ clear local state
    setUser(null)
    setUsers([])
  } catch (e) {
    console.error('❌ sign-out error', e)
    alert('Sign-out failed; see console')
  }
}


  // auth listener
  useEffect(() => {
    if (!initialized) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setUsers([])
      } else if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        await markUserOnline(session.user)
      }
    })
    return () => subscription.unsubscribe()
  }, [initialized])

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  if (!user) return <AuthPage onSignIn={() => supabase.auth.signInWithOAuth({ provider: 'google' })} />

  return <NightSky user={user} users={users} setUsers={setUsers} onSignOut={handleSignOut} onResetPositions={async () => { await supabase.rpc('reset_user_positions'); fetchAllUsers(); }} />
}
