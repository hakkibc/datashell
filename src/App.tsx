import { useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { TabBar } from './components/layout/TabBar';
import { StatusBar } from './components/layout/StatusBar';
import { TerminalTab } from './components/terminal/TerminalTab';
import { useTabStore } from './store/useTabStore';
import { useSettingsStore, appThemeClass } from './store/useSettingsStore';
import { Minus, Square, X, Terminal } from 'lucide-react';

function TitleBar() {
  return (
    <div className="titlebar">
      <div className="titlebar__left">
        <Terminal size={16} color="var(--accent)" />
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>DataShell</span>
      </div>
      <div className="titlebar__center">
        SSH Client
      </div>
      <div className="titlebar__controls">
        <button className="titlebar__btn" onClick={() => window.electronAPI?.window.minimize()}>
          <Minus size={14} />
        </button>
        <button className="titlebar__btn" onClick={() => window.electronAPI?.window.maximize()}>
          <Square size={12} />
        </button>
        <button className="titlebar__btn titlebar__btn--close" onClick={() => window.electronAPI?.window.close()}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function App() {
  const { tabs, activeTabId } = useTabStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    // Remove all theme classes
    root.classList.remove('theme-light', 'theme-monokai', 'theme-solarized', 'theme-nord');
    // Add the active theme class (dark has no class)
    const cls = appThemeClass[theme];
    if (cls) root.classList.add(cls);
  }, [theme]);

  return (
    <div className="app-container">
      <TitleBar />
      <div className="main-content">
        <Sidebar />
        <div className="content-panel">
          <TabBar />
          {activeTab ? (
            <TerminalTab key={activeTab.id} tab={activeTab} />
          ) : (
            <div className="empty-state">
              <Terminal size={48} className="empty-state__icon" />
              <div className="empty-state__text">
                Yeni bir oturum başlatmak için sol panelden bir session seçin
              </div>
              <div className="empty-state__text" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                veya Ctrl+T ile yeni bir bağlantı oluşturun
              </div>
            </div>
          )}
        </div>
      </div>
      <StatusBar />
    </div>
  );
}

export default App;
