import React from 'react'
import GoogleIcon from './GoogleIcon'

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
            Each user becomes a permanent star in the universe
          </p>
        </div>
      </div>
    </div>
  )
}

export default AuthPage