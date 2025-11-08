// src/components/ModernHeader.jsx
import React, { memo } from "react";
import BuyMeACoffee from "./BuyMeACoffee";

const ModernHeader = memo(({ user, onSignOut, onTwinkle }) => {
  return (
    <header className="absolute top-6 left-6 right-6 flex justify-between items-center z-30">
      {/* User Info */}
      <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-lg border border-white/10 rounded-2xl px-6 py-3 shadow-2xl">
        <div className="text-white font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
          {user.email}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 items-center">
        <BuyMeACoffee />
        
        {/* Twinkle Button */}
        <button
          onClick={onTwinkle}
          className="group relative flex items-center gap-2 bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 hover:from-yellow-500 hover:via-amber-600 hover:to-orange-600 text-gray-900 px-6 py-3 rounded-2xl font-bold transition-all duration-300 shadow-2xl hover:shadow-yellow-400/30 hover:scale-105 border-0 cursor-pointer overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-200/40 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          <span className="text-lg">✨</span>
          <span className="relative z-10">Twinkle</span>
        </button>

        {/* Sign Out Button */}
        <button
          onClick={onSignOut}
          className="group relative flex items-center gap-2 bg-gradient-to-br from-rose-500 via-red-500 to-pink-600 hover:from-rose-600 hover:via-red-600 hover:to-pink-700 text-white px-6 py-3 rounded-2xl font-bold transition-all duration-300 shadow-2xl hover:shadow-rose-500/25 hover:scale-105 border-0 cursor-pointer overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          <span className="text-lg">🚪</span>
          <span className="relative z-10">Sign Out</span>
        </button>
      </div>
    </header>
  );
});

export default ModernHeader;