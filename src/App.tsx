import { useEffect, useState, useRef, useCallback } from 'react';
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
  const theme = useSettingsStore((s) => s.theme);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const dragging = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-monokai', 'theme-solarized', 'theme-nord', 'theme-solarized-light', 'theme-github-light', 'theme-catppuccin-latte', 'theme-rose-pine-dawn');
    const cls = appThemeClass[theme];
    if (cls) root.classList.add(cls);
  }, [theme]);

  const handleSidebarResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setSidebarWidth(Math.max(160, Math.min(480, ev.clientX)));
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  return (
    <div className="app-container">
      <TitleBar />
      <div className="main-content">
        <Sidebar style={{ width: sidebarWidth }} />
        <div className="resize-handle resize-handle--vertical" onMouseDown={handleSidebarResize} />
        <div className="content-panel">
          <TabBar />
          {tabs.length === 0 && (
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
          {tabs.map((tab) => (
            <div
              key={tab.id}
              style={{ display: tab.id === activeTabId ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}
            >
              <TerminalTab tab={tab} />
            </div>
          ))}
        </div>
      </div>
      <StatusBar />
    </div>
  );
}

export default App;
