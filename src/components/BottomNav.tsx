import React from 'react';
import { LayoutDashboard, ClipboardEdit, FileText, Sparkles, User } from 'lucide-react';

export type ActiveTab = 'dashboard' | 'rekapan' | 'laporan' | 'analisis' | 'profil';

interface NavProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
}

const TABS = [
  { id: 'dashboard' as ActiveTab, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'rekapan' as ActiveTab, label: 'Rekapan', icon: ClipboardEdit },
  { id: 'laporan' as ActiveTab, label: 'Laporan', icon: FileText },
  { id: 'analisis' as ActiveTab, label: 'Analisis AI', icon: Sparkles },
  { id: 'profil' as ActiveTab, label: 'Profil', icon: User },
];

/**
 * Mobile Fixed Bottom Navigation Bar (5 menu tabs)
 */
export const MobileBottomNav: React.FC<NavProps> = ({ activeTab, onChangeTab }) => {
  return (
    <nav
      aria-label="Navigasi Utama HP"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl pb-safe"
    >
      <div className="grid grid-cols-5 items-center h-16 max-w-lg mx-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors relative ${
                isActive ? 'text-emerald-800 font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isActive && (
                <span className="absolute top-1 w-6 h-1 bg-emerald-700 rounded-full" />
              )}
              <Icon
                className={`w-5 h-5 transition-transform ${
                  isActive ? 'scale-110 text-emerald-800' : 'text-slate-600'
                }`}
              />
              <span className="text-[10px] mt-1 tracking-tight leading-none whitespace-nowrap">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

/**
 * Desktop Sub-Nav Bar (rendered under Header at top of desktop screen)
 */
export const DesktopSubNav: React.FC<NavProps> = ({ activeTab, onChangeTab }) => {
  return (
    <div className="hidden md:block bg-white border-b border-slate-200 shadow-xs sticky top-[60px] z-20">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onChangeTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-emerald-700 text-emerald-800 bg-emerald-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-700' : 'text-slate-600'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="text-xs text-slate-600 font-medium">
          Sistem Rekapan Kasir Teh Kota
        </div>
      </div>
    </div>
  );
};

export const BottomNav: React.FC<NavProps> = (props) => {
  return <MobileBottomNav {...props} />;
};
