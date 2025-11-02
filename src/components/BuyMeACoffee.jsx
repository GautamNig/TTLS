// src/components/BuyMeACoffee.jsx
export default function BuyMeACoffee() {
  const handleClick = () => {
    window.open('https://buymeacoffee.com/nessm', '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      onClick={handleClick}
      className="group relative flex items-center gap-2 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 hover:from-amber-500 hover:via-orange-600 hover:to-red-600 text-white px-6 py-3 rounded-2xl font-bold transition-all duration-300 shadow-2xl hover:shadow-amber-500/25 hover:scale-105 border-0 cursor-pointer overflow-hidden"
    >
      {/* Animated background shine */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
      
      <span className="text-lg">☕</span>
      <span className="relative z-10 bg-gradient-to-b from-white to-amber-100 bg-clip-text text-transparent">
        Buy me a coffee
      </span>
      
      {/* Pulse animation */}
      <div className="absolute inset-0 rounded-2xl border-2 border-amber-300/50 animate-pulse group-hover:animate-none" />
    </button>
  );
}