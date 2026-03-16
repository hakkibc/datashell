import { useEffect, useState } from 'react';
import { useSessionStore } from '../../store/useSessionStore';
import { useTabStore } from '../../store/useTabStore';
import { SessionManager } from '../sessions/SessionManager';
import { SessionForm } from '../sessions/SessionForm';
import { SettingsPanel } from '../settings/SettingsPanel';
import { Search, Plus, Settings, ChevronLeft, Menu } from 'lucide-react';
import type { Session } from '../../types/electron';

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editSession, setEditSession] = useState<Session | null>(null);
  const { searchQuery, setSearchQuery, fetchAll } = useSessionStore();

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleNewSession = () => {
    setEditSession(null);
    setShowForm(true);
  };

  const handleEdit = (session: Session) => {
    setEditSession(session);
    setShowForm(true);
  };

  const handleConnect = (session: Session) => {
    const { addTab } = useTabStore.getState();
    const tabId = Math.random().toString(36).substring(2, 15);
    addTab({
      id: tabId,
      sessionId: session.id,
      sessionName: session.name,
      host: session.host,
      type: 'terminal',
      status: 'connecting',
      color: session.color,
    });
  };

  return (
    <>
      <div className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
        <div className="sidebar__header">
          <span className="sidebar__logo">DataShell</span>
          <span className="sidebar__version">v1.1.0</span>
          <div style={{ flex: 1 }} />
          <button className="btn--icon" onClick={() => setCollapsed(true)}>
            <ChevronLeft size={16} />
          </button>
        </div>

        <div className="sidebar__search">
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 8, top: 7, color: 'var(--text-muted)' }} />
            <input
              placeholder="Session ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 28 }}
            />
          </div>
        </div>

        <div className="sidebar__content">
          <SessionManager onConnect={handleConnect} onEdit={handleEdit} />
        </div>

        <div className="sidebar__footer">
          <button className="btn btn--primary" style={{ flex: 1 }} onClick={handleNewSession}>
            <Plus size={14} /> Yeni Session
          </button>
          <button className="btn--icon" onClick={() => setShowSettings(true)}>
            <Settings size={16} />
          </button>
        </div>
      </div>

      {collapsed && (
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(false)}
          title="Menüyü aç"
        >
          <Menu size={18} />
        </button>
      )}

      {showForm && (
        <SessionForm
          session={editSession}
          onClose={() => setShowForm(false)}
        />
      )}

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </>
  );
}
