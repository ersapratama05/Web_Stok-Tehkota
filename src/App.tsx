import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { BottomNav, DesktopSubNav, ActiveTab } from './components/BottomNav';
import { DashboardView } from './views/DashboardView';
import { RekapanFormView } from './views/RekapanFormView';
import { LaporanView } from './views/LaporanView';
import { AiAnalysisView } from './views/AiAnalysisView';
import { ProfileView } from './views/ProfileView';
import { LoginView } from './views/LoginView';
import { HistoryDetailModal } from './views/HistoryDetailModal';
import { RekapRecord } from './types';
import { WifiOff } from 'lucide-react';

function AppContent() {
  const { user, isOnline, setActiveBranch } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<RekapRecord | null>(null);
  const [rekapFormTargetDate, setRekapFormTargetDate] = useState<string | undefined>(undefined);
  const [rekapFormTargetRecordId, setRekapFormTargetRecordId] = useState<string | undefined>(undefined);

  // If user is not logged in, show real Login Screen
  if (!user) {
    return <LoginView onLoginSuccess={() => setActiveTab('dashboard')} />;
  }

  // Navigation handlers
  const handleNavigateToRekap = (date?: string) => {
    setRekapFormTargetDate(date);
    setRekapFormTargetRecordId(undefined);
    setActiveTab('rekapan');
  };

  const handleEditRecord = (record: RekapRecord) => {
    if (user.role === 'admin' || user.branch === record.branch) {
      setActiveBranch(record.branch);
    }
    setRekapFormTargetDate(record.date);
    setRekapFormTargetRecordId(record.id);
    setActiveTab('rekapan');
  };

  const handleTabChange = (tab: ActiveTab) => {
    if (tab === 'rekapan') {
      setRekapFormTargetDate(undefined);
      setRekapFormTargetRecordId(undefined);
    }
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      {/* Top Header */}
      <Header onOpenProfile={() => setActiveTab('profil')} />

      {/* Desktop Sub Navigation (top-pinned) */}
      <DesktopSubNav activeTab={activeTab} onChangeTab={handleTabChange} />

      {/* Main Responsive Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3.5 sm:p-6">
        {/* Offline Warning Banner if connection drops */}
        {!isOnline && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <strong>Mode Offline Aktif.</strong> Anda tetap dapat mengisi rekapan stok dan pengeluaran. Seluruh draf disimpan secara lokal dan akan disinkronkan otomatis saat terhubung kembali ke internet.
            </div>
          </div>
        )}

        {/* Tab Views */}
        {activeTab === 'dashboard' && (
          <DashboardView
            onNavigateToRekap={handleNavigateToRekap}
            onNavigateToLaporan={() => setActiveTab('laporan')}
            onNavigateToAi={() => setActiveTab('analisis')}
            onViewRecordDetail={(rec) => setSelectedRecordForDetail(rec)}
          />
        )}

        {activeTab === 'rekapan' && (
          <RekapanFormView
            initialDate={rekapFormTargetDate}
            initialRecordId={rekapFormTargetRecordId}
            onSavedSuccess={() => {
              // optional callback or stay on form
            }}
          />
        )}

        {activeTab === 'laporan' && (
          <LaporanView
            onOpenRecordDetail={(rec) => setSelectedRecordForDetail(rec)}
            onNavigateToRekap={handleNavigateToRekap}
          />
        )}

        {activeTab === 'analisis' && <AiAnalysisView />}

        {activeTab === 'profil' && (
          <ProfileView onLogout={() => setActiveTab('dashboard')} />
        )}
      </main>

      {/* Fixed Bottom Navigation (Mobile) */}
      <BottomNav activeTab={activeTab} onChangeTab={handleTabChange} />

      {/* History Detail Modal */}
      {selectedRecordForDetail && (
        <HistoryDetailModal
          record={selectedRecordForDetail}
          onClose={() => setSelectedRecordForDetail(null)}
          onEdit={handleEditRecord}
          onDeleteSuccess={() => {
            // Closes modal
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
