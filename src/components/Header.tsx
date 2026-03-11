import React from 'react';
import { MapPin } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center">
            <svg viewBox="0 0 220 60" className="h-9" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g fill="#FF0033">
                <ellipse cx="65" cy="28" rx="60" ry="28" />
                <polygon points="15,55 35,45 20,35" />
              </g>
              <text x="65" y="38" fill="white" fontSize="34" fontWeight="900" fontStyle="italic" textAnchor="middle" fontFamily="Arial, sans-serif" letterSpacing="-1">itel</text>
              <text x="130" y="38" fill="#FF0033" fontSize="34" fontWeight="900" fontStyle="italic" fontFamily="Arial, sans-serif" letterSpacing="-1">Home</text>
            </svg>
          </div>
          <div className="border-l-2 border-gray-200 pl-4 py-1">
            <p className="text-sm text-gray-500 font-bold tracking-wide uppercase">空间实景渲染</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full">
          <MapPin size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">尼日利亚市场</span>
        </div>
      </div>
    </header>
  );
}
