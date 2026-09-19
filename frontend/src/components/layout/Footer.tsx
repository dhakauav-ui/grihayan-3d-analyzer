import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="h-7 bg-slate-950 border-t border-slate-800/80 px-6 flex items-center justify-between flex-shrink-0 z-30 select-none text-[11px]">
      {/* Left: Local Engine Active Status */}
      <div className="flex items-center space-x-2 text-emerald-400 font-semibold font-mono">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-[11px] tracking-wide">Local Engine Active</span>
      </div>

      {/* Middle: Developer Credit */}
      <div className="text-[11px] text-slate-300 font-medium tracking-wide">
        Developed by <span className="text-blue-400 font-semibold">Shagar Saha</span>
      </div>

      {/* Right: Copyright Notice */}
      <div className="text-[11px] text-slate-400 font-sans">
        Copyright © 2026 Grihayan Limited. All rights reserved.
      </div>
    </footer>
  );
};
