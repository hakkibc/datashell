import { useTabStore } from '../../store/useTabStore';
import { X, Plus, Terminal, FolderOpen } from 'lucide-react';
import { useEffect } from 'react';

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, removeTab, addTab, nextTab, prevTab } = useTabStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          prevTab();
        } else {
          nextTab();
        }
      }
      // Ctrl+1..9 tab select
      if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (tabs[idx]) setActiveTab(tabs[idx].id);
      }
      // Ctrl+W close tab
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        if (activeTabId) removeTab(activeTabId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTabId, nextTab, prevTab, setActiveTab, removeTab]);

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    // Disconnect SSH when closing
    const tab = tabs.find((t) => t.id === tabId);
    if (tab?.connectionId) {
      window.electronAPI?.ssh.disconnect(tab.connectionId);
    }
    removeTab(tabId);
  };

  return (
    <div className="tabbar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? 'tab--active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.color && (
            <div className="tab__indicator" style={{ background: tab.color }} />
          )}
          {tab.type === 'terminal' ? <Terminal size={13} /> : <FolderOpen size={13} />}
          <span>{tab.sessionName}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{tab.host}</span>
          <button className="tab__close" onClick={(e) => handleCloseTab(e, tab.id)}>
            <X size={12} />
          </button>
        </div>
      ))}
      <button className="tab-new" title="Yeni Tab (Ctrl+T)">
        <Plus size={16} />
      </button>
    </div>
  );
}
