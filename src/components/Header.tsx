import React from 'react';
import { MapPin, ChevronDown, Calculator, ExternalLink, Languages, ShieldCheck } from 'lucide-react';
import { Location, LOCATIONS } from '../App';
import { TRANSLATIONS, Language } from '../constants/translations';
import { Logo } from './Logo';

interface HeaderProps {
  selectedLocation: Location;
  onLocationChange: (location: Location) => void;
  selectedCity: string;
  onCityChange: (city: string) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  hasApiKey: boolean | null;
  onOpenKeySelect: () => void;
  currentTab: 'store' | 'bom' | 'brand_lab';
  onTabChange: (tab: 'store' | 'bom' | 'brand_lab') => void;
  isAdmin?: boolean;
}

export function Header({ 
  selectedLocation, 
  onLocationChange, 
  selectedCity,
  onCityChange,
  language, 
  onLanguageChange, 
  hasApiKey, 
  onOpenKeySelect,
  currentTab,
  onTabChange,
  isAdmin = false
}: HeaderProps) {
  const t = TRANSLATIONS[language];

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* First Row: Logo and Actions */}
        <div className="py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-shrink-0">
              <Logo className="h-6 sm:h-10 w-auto" />
            </div>
            <div className="border-l border-gray-200 pl-2 py-1 hidden xs:block truncate">
              <p className="text-[10px] sm:text-xs text-gray-500 font-bold tracking-wide uppercase truncate max-w-[80px] sm:max-w-none">{t.title}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            {/* API Key Status - Compact on Mobile */}
            <button
              onClick={onOpenKeySelect}
              className={`flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-full border transition-all text-[10px] sm:text-xs font-bold whitespace-nowrap ${
                hasApiKey 
                  ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' 
                  : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
              }`}
            >
              <ShieldCheck size={14} className="flex-shrink-0" />
              <span className="hidden sm:inline">
                {hasApiKey 
                  ? (language === 'zh' ? 'AI 引擎已激活' : 'AI Engine Activated') 
                  : (language === 'zh' ? '激活 AI 引擎' : 'Activate AI Engine')}
              </span>
              <span className="sm:hidden">
                {hasApiKey ? (language === 'zh' ? '已激活' : 'Active') : (language === 'zh' ? '激活' : 'Activate')}
              </span>
            </button>

            {/* Language Toggle */}
            <button
              onClick={() => onLanguageChange(language === 'zh' ? 'en' : 'zh')}
              className="flex items-center gap-1 bg-gray-50 hover:bg-gray-100 px-2 py-1.5 sm:px-3 sm:py-2 rounded-full border border-gray-200 transition-all text-gray-600 hover:text-red-600"
              title={language === 'zh' ? 'Switch to English' : '切换至中文'}
            >
              <Languages size={14} className="flex-shrink-0" />
              <span className="text-[10px] sm:text-xs font-bold uppercase">{language === 'zh' ? 'EN' : '中文'}</span>
            </button>

            {/* Location Selection */}
            <div className="relative group">
              <div className="flex items-center gap-1 bg-gray-100 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full cursor-pointer hover:bg-gray-200 transition-colors max-w-[70px] sm:max-w-none">
                <MapPin size={14} className="text-red-500 flex-shrink-0" />
                <span className="text-[10px] sm:text-sm font-medium text-gray-700 truncate">{selectedLocation.label}</span>
                <ChevronDown size={12} className="text-gray-400 flex-shrink-0" />
              </div>
              
              <div className="absolute right-0 mt-2 w-40 sm:w-48 bg-white border border-gray-200 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-40 overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-[8px] sm:text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                  {t.locationLabelHeader}
                </div>
                <div className="max-h-64 sm:max-h-80 overflow-y-auto no-scrollbar">
                  {LOCATIONS.map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => {
                        onLocationChange(loc);
                        onCityChange(loc.cities[0]);
                      }}
                      className={`w-full text-left px-4 py-2 sm:py-3 text-xs sm:text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${
                        selectedLocation.id === loc.id ? 'text-red-600 bg-red-50 font-semibold' : 'text-gray-700'
                      }`}
                    >
                      {loc.label}
                      {selectedLocation.id === loc.id && <div className="w-1.5 h-1.5 rounded-full bg-red-600" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Second Row: Navigation Tabs - Dropdown on Mobile, Pills on Desktop */}
        <div className="flex items-center justify-between py-2 border-t border-gray-50">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth w-full">
            <button
              onClick={() => onTabChange('store')}
              className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                currentTab === 'store' 
                  ? 'bg-red-600 text-white shadow-md' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <ShieldCheck size={14} className={currentTab === 'store' ? 'text-white' : 'text-gray-400'} />
              <span>{language === 'zh' ? '门店空间' : 'Store'}</span>
            </button>
            <button
              onClick={() => onTabChange('bom')}
              className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                currentTab === 'bom' 
                  ? 'bg-red-600 text-white shadow-md' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Calculator size={14} className={currentTab === 'bom' ? 'text-white' : 'text-gray-400'} />
              <span>{t.bomCalculator}</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => onTabChange('brand_lab')}
                className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  currentTab === 'brand_lab' 
                    ? 'bg-red-600 text-white shadow-md' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <ShieldCheck size={14} className={currentTab === 'brand_lab' ? 'text-white' : 'text-gray-400'} />
                <span>{t.brandLab}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
