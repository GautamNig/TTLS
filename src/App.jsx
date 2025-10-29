import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import './index.css'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])

  useEffect(() => {
    checkUser()
    setupRealtimeSubscription()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await markUserOnline(session.user)
      }
      setLoading(false)
    } catch (error) {
      console.error('Error checking user:', error)
      setLoading(false)
    }
  }

  const markUserOnline = async (user) => {
    try {
      // Generate random position for this user
      const randomX = Math.random() * 0.9 + 0.05
      const randomY = Math.random() * 0.9 + 0.05
      
      const { error } = await supabase
        .from('user_positions')
        .upsert({
          user_id: user.id,
          email: user.email,
          relative_x: randomX,
          relative_y: randomY,
          luminosity: 1.0,
          is_online: true,
          last_seen: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (error) throw error
    } catch (error) {
      console.error('Error marking user online:', error)
    }
  }

  const markUserOffline = async (userId) => {
    try {
      const { error } = await supabase
        .from('user_positions')
        .update({
          is_online: false,
          luminosity: 0.1,
          last_seen: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) throw error
    } catch (error) {
      console.error('Error marking user offline:', error)
    }
  }

  const setupRealtimeSubscription = () => {
    const subscription = supabase
      .channel('user_positions_channel')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'user_positions' 
        }, 
        () => {
          fetchAllUsers()
        }
      )
      .subscribe()

    fetchAllUsers()

    return () => {
      subscription.unsubscribe()
    }
  }

  const fetchAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_positions')
        .select('*')
        .order('created_at', { ascending: true })

      if (!error && data) {
        console.log('📊 Users and their positions:')
        data.forEach(user => {
          console.log(`User: ${user.email}, X: ${user.relative_x}, Y: ${user.relative_y}, Online: ${user.is_online}`)
        })
        setUsers(data)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      })
      if (error) throw error
    } catch (error) {
      alert('Error signing in. Please try again.')
    }
  }

  const signOut = async () => {
    if (user) {
      await markUserOffline(user.id)
    }
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      console.error('Error signing out')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-night-sky flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="w-4 h-4 bg-white rounded-full mx-auto mb-3 shadow-lg shadow-white/50"></div>
            <p className="text-white text-sm">Loading universe...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthPage onSignIn={signInWithGoogle} />
  }

  return <NightSky user={user} users={users} onSignOut={signOut} />
}

function AuthPage({ onSignIn }) {
  return (
    <div className="min-h-screen bg-night-sky flex items-center justify-center relative overflow-hidden">
      <div className="bg-black/70 backdrop-blur-sm p-8 rounded-2xl border border-white/30 w-96 relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">✨ TTLS</h1>
          <p className="text-white/80 text-lg">Join the Night Sky</p>
        </div>
        
        <div className="space-y-4">
          <button
            onClick={onSignIn}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 rounded-lg px-6 py-3 font-semibold text-gray-800 transition-all duration-300 transform hover:scale-105 shadow-lg"
          >
            <GoogleIcon />
            Sign in with Google
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-white/70 text-sm">
            Become a glowing pixel in our digital universe
          </p>
        </div>
      </div>
    </div>
  )
}

function NightSky({ user, users, onSignOut }) {
  const onlineUsers = users.filter(u => u.is_online)
  const currentUserData = users.find(u => u.user_id === user.id)

  return (
    <div className="min-h-screen bg-night-sky relative overflow-hidden" style={{ height: '100vh', width: '100vw' }}>
      {/* Simple background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20"></div>

      {/* User glowing pixels */}
      {users.map((userData, index) => (
        <GlowingPixel 
          key={userData.user_id} 
          userData={userData} 
          isCurrentUser={userData.user_id === user.id}
          userNumber={index + 1}
        />
      ))}

      {/* Controls */}
      <div className="absolute top-4 right-4 z-50">
        <div className="bg-black/90 backdrop-blur-sm rounded-lg p-4 border border-white/20">
          <div className="flex items-center gap-4">
            <div className="text-white">
              <p className="text-sm font-semibold truncate max-w-[150px]">{user.email}</p>
              <p className="text-xs text-white/80">
                Online: <span className="text-green-400 font-bold">{onlineUsers.length}</span> / {users.length}
              </p>
            </div>
            <button
              onClick={onSignOut}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Debug panel - shows positions */}
      <div className="absolute bottom-4 left-4 z-50">
        <div className="bg-black/90 backdrop-blur-sm rounded-lg p-4 border border-white/20 max-w-xs">
          <h3 className="text-white font-semibold mb-2 text-sm">🌌 Debug Info</h3>
          <div className="text-white/80 text-xs space-y-1">
            <p>Total users: {users.length}</p>
            <p>Online users: {onlineUsers.length}</p>
            <p>Screen: {window.innerWidth} × {window.innerHeight}</p>
            {users.slice(0, 3).map((user, i) => (
              <p key={user.user_id}>
                User {i+1}: X:{user.relative_x?.toFixed(2)} Y:{user.relative_y?.toFixed(2)}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function GlowingPixel({ userData, isCurrentUser, userNumber }) {
  const [luminosity, setLuminosity] = useState(userData.luminosity || 0.1)

  useEffect(() => {
    if (isCurrentUser && userData.is_online) {
      setLuminosity(1.0)
      const timer = setTimeout(() => {
        setLuminosity(0.7)
      }, 3000)
      return () => clearTimeout(timer)
    } else if (!userData.is_online) {
      setLuminosity(0.1)
    } else {
      setLuminosity(0.7)
    }
  }, [userData.is_online, userData.luminosity, isCurrentUser])

  // Convert relative coordinates (0-1) to absolute pixels
  const x = (userData.relative_x || 0.5) * 100
  const y = (userData.relative_y || 0.5) * 100

  const pulse = userData.is_online ? 1 + Math.sin(Date.now() * 0.003) * 0.3 : 1
  const glowColor = userData.is_online ? '#ffffff' : '#ff4444'

  return (
    <div
      className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        position: 'absolute',
      }}
    >
      {/* Simple glowing dot */}
      <div
        className="rounded-full"
        style={{
          width: '12px',
          height: '12px',
          backgroundColor: glowColor,
          boxShadow: `0 0 20px 10px ${glowColor}${userData.is_online ? '80' : '40'}`,
          transform: `scale(${pulse})`,
          opacity: luminosity,
        }}
      />
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

export default App