import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import AuthPage from './components/AuthPage'
import NightSky from './components/NightSky'
import './index.css'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    console.log('🚀 App starting...')
    initializeApp()
  }, [])

  const initializeApp = async () => {
    try {
      console.log('🔄 Initializing app...')
      
      // Check for existing session
      const { data: { session } } = await supabase.auth.getSession()
      console.log('🔐 Session check:', session ? `User: ${session.user.email} (ID: ${session.user.id})` : 'No user')
      
      if (session?.user) {
        console.log('✅ Setting user from session')
        setUser(session.user)
        await markUserOnline(session.user)
      }
      
      setInitialized(true)
      setLoading(false)
      
    } catch (error) {
      console.error('❌ Initialization error:', error)
      setInitialized(true)
      setLoading(false)
    }
  }

  // Real-time subscription for live updates
  useEffect(() => {
    if (!initialized) return;

    console.log('🔔 Setting up real-time subscription...');

    const channel = supabase
      .channel('user_positions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_positions',
        },
        (payload) => {
          console.log('🔔 Real-time update received:', payload.eventType, payload.new?.email, 'Online:', payload.new?.is_online)
          
          // Immediately update the users list when we get real-time updates
          if (payload.eventType === 'INSERT') {
            console.log('🆕 New user added via real-time:', payload.new.email)
            setUsers(prev => {
              const exists = prev.find(u => u.user_id === payload.new.user_id)
              if (!exists) {
                return [...prev, payload.new]
              }
              return prev
            })
          } 
          else if (payload.eventType === 'UPDATE') {
            console.log('📝 User updated via real-time:', payload.new.email, 'Online:', payload.new.is_online)
            setUsers(prev => prev.map(u => 
              u.user_id === payload.new.user_id ? { ...u, ...payload.new } : u
            ))
          }
          else if (payload.eventType === 'DELETE') {
            console.log('🗑️ User deleted via real-time:', payload.old.user_id)
            setUsers(prev => prev.filter(u => u.user_id !== payload.old.user_id))
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 Real-time subscription status:', status)
      })

    return () => {
      console.log('🔔 Cleaning up real-time subscription')
      supabase.removeChannel(channel)
    }
  }, [initialized])

  // Also fetch all users periodically as backup
  useEffect(() => {
    if (!initialized) return

    console.log('🔄 Starting backup polling every 10 seconds...')
    fetchAllUsers() // Initial fetch
    
    const interval = setInterval(() => {
      fetchAllUsers()
    }, 10000)

    return () => clearInterval(interval)
  }, [initialized])

  const markUserOnline = async (user) => {
    try {
      console.log('📍 Marking user online:', user.email, 'ID:', user.id)
      
      // First check if this user already exists in our positions table
      const { data: existingUser, error: fetchError } = await supabase
        .from('user_positions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (fetchError) {
        console.error('❌ Error checking existing user:', fetchError)
      }

      let updateData = {
        user_id: user.id,
        email: user.email,
        is_online: true,
        luminosity: 1.0,
        last_seen: new Date().toISOString()
      }

      if (existingUser) {
        // User exists - keep their initial position, update current position to initial
        console.log('📍 Existing user found, keeping position:', existingUser.initial_x.toFixed(2), existingUser.initial_y.toFixed(2))
        updateData.current_x = existingUser.initial_x
        updateData.current_y = existingUser.initial_y
        // Don't update initial_x and initial_y - keep them permanent
      } else {
        // New user - generate permanent random position
        const randomX = Math.random() * 0.8 + 0.1 // 10% to 90%
        const randomY = Math.random() * 0.8 + 0.1 // 10% to 90%
        console.log('📍 New user, assigning permanent position:', randomX.toFixed(2), randomY.toFixed(2))
        updateData.initial_x = randomX
        updateData.initial_y = randomY
        updateData.current_x = randomX
        updateData.current_y = randomY
      }
      
      const { data, error } = await supabase
        .from('user_positions')
        .upsert(updateData, {
          onConflict: 'user_id'
        })
        .select()

      if (error) {
        console.error('❌ Error marking user online:', error)
        console.error('❌ Error details:', error.message)
        return
      }
      
      console.log('✅ User marked online:', data?.[0]?.email, 'Online:', data?.[0]?.is_online)
      
    } catch (error) {
      console.error('❌ Error in markUserOnline:', error)
    }
  }

  const markUserOffline = async (userId) => {
    try {
      console.log('📍 Marking user offline in database:', userId)
      
      // Use direct database update
      const { data, error } = await supabase
        .from('user_positions')
        .update({
          is_online: false,
          luminosity: 0.1,
          last_seen: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()

      if (error) {
        console.error('❌ Database error marking user offline:', error)
        console.error('❌ Error details:', error.message)
        throw error
      }
      
      if (data && data.length > 0) {
        console.log('✅ User successfully marked offline:', data[0].email)
        console.log('✅ is_online set to:', data[0].is_online)
      } else {
        console.log('⚠️ No user found to mark offline')
      }
      
    } catch (error) {
      console.error('❌ Error marking user offline:', error)
      throw error
    }
  }

  const fetchAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_positions')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) {
        console.error('❌ Error fetching users:', error)
        return
      }

      if (data) {
        console.log('📊 Users fetched via API:', data.length)
        setUsers(data)
      }
    } catch (error) {
      console.error('❌ Error in fetchAllUsers:', error)
    }
  }

  const signInWithGoogle = async () => {
    try {
      console.log('🔐 Starting Google sign in...')
      
      // IMPORTANT: Use a specific redirect URL and skip nonce check for development
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          skipBrowserRedirect: false,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        },
      })
      
      if (error) throw error
    } catch (error) {
      console.error('❌ Sign in error:', error)
      alert('Error signing in. Please try again.')
    }
  }

  const handleSignOut = async () => {
    try {
      console.log('🚪 Signing out process started...')
      
      if (user) {
        console.log('📍 Step 1: Marking user offline in database')
        await markUserOffline(user.id)
        console.log('✅ Database update completed')
      }
      
      console.log('🔐 Step 2: Calling Supabase auth signOut')
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('❌ Sign out auth error:', error)
        throw error
      }
      
      console.log('✅ Step 3: Auth sign out successful')
      
      // Clear local state immediately
      setUser(null)
      setUsers([])
      console.log('✅ Step 4: Local state cleared')
      
    } catch (error) {
      console.error('❌ Sign out error:', error)
      alert('Error signing out. Please try again.')
    }
  }

  const resetAllPositions = async () => {
    try {
      console.log('🔄 Resetting all positions to initial...')
      const { error } = await supabase.rpc('reset_user_positions')
      if (error) throw error
      console.log('✅ Positions reset')
    } catch (error) {
      console.error('❌ Error resetting positions:', error)
    }
  }

  // Auth state listener
  useEffect(() => {
    if (!initialized) return
    
    console.log('👂 Setting up auth listener...')
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth state changed:', event, session?.user?.email, 'ID:', session?.user?.id)
      
      if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out - clearing state')
        setUser(null)
        setUsers([])
      } else if (event === 'SIGNED_IN' && session?.user) {
        console.log('👋 User signed in:', session.user.email, 'ID:', session.user.id)
        
        // Check if this is the same user as before
        if (user && user.id === session.user.id) {
          console.log('🔄 Same user re-logged in')
        } else {
          console.log('🆕 New/different user logged in')
        }
        
        setUser(session.user)
        await markUserOnline(session.user)
      } else if (event === 'USER_UPDATED' && session?.user) {
        console.log('👤 User updated:', session.user.email)
        setUser(session.user)
      }
    })

    return () => {
      console.log('👂 Cleaning up auth listener')
      subscription?.unsubscribe()
    }
  }, [initialized, user])

  if (loading) {
    return (
      <div className="min-h-screen bg-night-sky flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="w-8 h-8 bg-white rounded-full mx-auto mb-4 shadow-lg shadow-white/50"></div>
            <p className="text-white text-lg">Initializing TTLS...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthPage onSignIn={signInWithGoogle} />
  }

  return (
    <NightSky 
      user={user} 
      users={users} 
      onSignOut={handleSignOut}
      onResetPositions={resetAllPositions}
    />
  )
}

export default App