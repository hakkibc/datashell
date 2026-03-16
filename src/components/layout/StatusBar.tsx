import { useTabStore } from '../../store/useTabStore';
import { Lock } from 'lucide-react';

export function StatusBar() {
  const { tabs, activeTabId } = useTabStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="statusbar">
      {activeTab ? (
        <>
          <div className="statusbar__item">
            <div
              className={`statusbar__led ${
                activeTab.status === 'connected'
                  ? 'statusbar__led--connected'
                  : activeTab.status === 'connecting'
                  ? 'statusbar__led--connecting'
                  : ''
              }`}
            />
            {activeTab.status === 'connected'
              ? 'Bağlı'
              : activeTab.status === 'connecting'
              ? 'Bağlanıyor...'
              : activeTab.status === 'disconnected'
              ? 'Bağlantı kesildi'
              : 'Hata'}
          </div>
          <div className="statusbar__item">{activeTab.host}</div>
          <div className="statusbar__item">
            <Lock size={10} /> SSH
          </div>
        </>
      ) : (
        <div className="statusbar__item">Hazır</div>
      )}
      <div style={{ flex: 1 }} />
      <div className="statusbar__item">DataShell v1.0.0</div>
    </div>
  );
}
