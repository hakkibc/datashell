import { useEffect, useState, useCallback } from 'react';
import { useSessionStore } from '../../store/useSessionStore';
import { useSavedTunnelStore } from '../../store/useSavedTunnelStore';
import { useTabStore } from '../../store/useTabStore';
import { SessionManager } from '../sessions/SessionManager';
import { SessionForm } from '../sessions/SessionForm';
import { SavedTunnelForm } from '../tunnel/SavedTunnelForm';
import { SettingsPanel } from '../settings/SettingsPanel';
import { Search, Plus, Settings, ChevronLeft, Menu, Network, Play, Square, Trash2, Edit2 } from 'lucide-react';
import type { Session, SavedTunnel } from '../../types/electron';

interface SidebarProps {
  style?: React.CSSProperties;
}

export function Sidebar({ style }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTunnelForm, setShowTunnelForm] = useState(false);
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [editTunnel, setEditTunnel] = useState<SavedTunnel | null>(null);
  const [activeTab, setActiveTab] = useState<'sessions' | 'tunnels'>('sessions');
  const { searchQuery, setSearchQuery, fetchAll, sessions } = useSessionStore();
  const { tunnels: savedTunnels, fetchAll: fetchTunnels, deleteTunnel, createTunnel, updateTunnel } = useSavedTunnelStore();
  // Track active tunnels from backend
  const [activeTunnels, setActiveTunnels] = useState<Array<{ tunnelId: string; savedTunnelId?: string; connectionId: string; status: string }>>([]);

  const refreshActiveTunnels = useCallback(async () => {
    try {
      const list = await window.electronAPI.tunnel.list();
      setActiveTunnels(list as Array<{ tunnelId: string; savedTunnelId?: string; connectionId: string; status: string }>);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchAll();
    fetchTunnels();
    refreshActiveTunnels();
  }, [fetchAll, fetchTunnels, refreshActiveTunnels]);

  // Poll active tunnels every 3 seconds (pause while forms are open)
  useEffect(() => {
    if (showTunnelForm || showForm || showSettings) return;
    const interval = setInterval(refreshActiveTunnels, 3000);
    return () => clearInterval(interval);
  }, [refreshActiveTunnels, showTunnelForm, showForm, showSettings]);

  // Check if a saved tunnel is currently running
  const getActiveTunnelId = (savedTunnelId: string) => {
    const active = activeTunnels.find((t) => t.savedTunnelId === savedTunnelId);
    return active?.tunnelId || null;
  };

  // Listen for new-session event from TabBar + button
  useEffect(() => {
    const handler = () => {
      setEditSession(null);
      setShowForm(true);
      if (collapsed) setCollapsed(false);
    };
    window.addEventListener('datashell:new-session', handler);
    return () => window.removeEventListener('datashell:new-session', handler);
  }, [collapsed]);

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

  const handleSftp = (session: Session) => {
    const { tabs: allTabs, setActiveTab, addTab } = useTabStore.getState();
    // If there's already a connected tab for this session, switch to it and toggle SFTP
    const sessionTab = allTabs.find((t) => t.sessionId === session.id && t.connectionId && t.status === 'connected');
    if (sessionTab) {
      setActiveTab(sessionTab.id);
      window.dispatchEvent(new CustomEvent('datashell:toggle-sftp', { detail: { tabId: sessionTab.id } }));
    } else {
      // No connected tab — create a new tab with autoSftp flag
      const tabId = Math.random().toString(36).substring(2, 15);
      addTab({
        id: tabId,
        sessionId: session.id,
        sessionName: session.name,
        host: session.host,
        type: 'terminal',
        status: 'connecting',
        color: session.color,
        autoSftp: true,
      });
    }
  };

  const handleNewTunnel = () => {
    setEditTunnel(null);
    setShowTunnelForm(true);
  };

  const handleEditTunnel = (tunnel: SavedTunnel) => {
    setEditTunnel(tunnel);
    setShowTunnelForm(true);
  };

  const handleSaveTunnel = async (data: Omit<SavedTunnel, 'id' | 'createdAt'>) => {
    if (editTunnel) {
      await updateTunnel(editTunnel.id, data);
    } else {
      await createTunnel(data);
    }
    setShowTunnelForm(false);
  };

  const handleDeleteTunnel = async (id: string) => {
    if (!confirm('Bu tunnel silinsin mi?')) return;
    await deleteTunnel(id);
  };

  const handleStartTunnel = async (tunnel: SavedTunnel) => {
    // Find the session to connect
    const session = sessions.find((s) => s.id === tunnel.sessionId);
    if (!session) {
      alert('Bu tunnel\'a bağlı session bulunamadı.');
      return;
    }

    try {
      // First connect SSH
      const connectionId = await window.electronAPI.ssh.connect(session.id);

      // Then start the tunnel
      await window.electronAPI.tunnel.start(connectionId, {
        type: tunnel.type,
        localPort: tunnel.localPort,
        remoteHost: tunnel.remoteHost,
        remotePort: tunnel.remotePort,
        savedTunnelId: tunnel.id,
      });

      await refreshActiveTunnels();
      alert(`Tunnel "${tunnel.name}" başlatıldı! (Port ${tunnel.localPort})`);
    } catch (err) {
      alert('Tunnel başlatılamadı: ' + (err as Error).message);
    }
  };

  const handleStopTunnel = async (savedTunnelId: string) => {
    const tunnelId = getActiveTunnelId(savedTunnelId);
    if (!tunnelId) return;
    try {
      await window.electronAPI.tunnel.stop(tunnelId);
      await refreshActiveTunnels();
    } catch (err) {
      alert('Tunnel durdurulamadı: ' + (err as Error).message);
    }
  };

  const getSessionName = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    return session ? session.name : 'Bilinmeyen';
  };

  return (
    <>
      <div className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`} style={collapsed ? undefined : style}>
        <div className="sidebar__header">
          <span className="sidebar__logo">DataShell</span>
          <span className="sidebar__version">v1.4.0</span>
          <div style={{ flex: 1 }} />
          <button className="btn--icon" onClick={() => setCollapsed(true)}>
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* Tab switcher: Sessions / Tunnels */}
        <div className="sidebar__tabs">
          <button
            className={`sidebar__tab ${activeTab === 'sessions' ? 'sidebar__tab--active' : ''}`}
            onClick={() => setActiveTab('sessions')}
          >
            Sessions
          </button>
          <button
            className={`sidebar__tab ${activeTab === 'tunnels' ? 'sidebar__tab--active' : ''}`}
            onClick={() => setActiveTab('tunnels')}
          >
            <Network size={12} /> Tunnels
          </button>
        </div>

        {activeTab === 'sessions' && (
          <>
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
              <SessionManager onConnect={handleConnect} onEdit={handleEdit} onSftp={handleSftp} />
            </div>

            <div className="sidebar__footer">
              <button className="btn btn--primary" style={{ flex: 1 }} onClick={handleNewSession}>
                <Plus size={14} /> Yeni Session
              </button>
              <button className="btn--icon" onClick={() => setShowSettings(true)}>
                <Settings size={16} />
              </button>
            </div>
          </>
        )}

        {activeTab === 'tunnels' && (
          <>
            <div className="sidebar__content">
              {savedTunnels.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  Kayıtlı tunnel yok
                </div>
              ) : (
                <div className="tunnel-list">
                  {savedTunnels.map((tunnel) => {
                    const isRunning = !!getActiveTunnelId(tunnel.id);
                    return (
                      <div key={tunnel.id} className="tunnel-list__item">
                        <div className={`status-dot ${isRunning ? 'status-dot--running' : 'status-dot--stopped'}`} title={isRunning ? 'Çalışıyor' : 'Durduruldu'} />
                        <div className="tunnel-list__info">
                          <div className="tunnel-list__name">
                            <span className={`tunnel-list__badge tunnel-list__badge--${tunnel.type}`}>
                              {tunnel.type === 'local' ? 'L' : tunnel.type === 'remote' ? 'R' : 'D'}
                            </span>
                            {tunnel.name}
                          </div>
                          <div className="tunnel-list__detail">
                            {tunnel.localPort}
                            {tunnel.type !== 'dynamic' && ` → ${tunnel.remoteHost}:${tunnel.remotePort}`}
                            {' · '}{getSessionName(tunnel.sessionId)}
                          </div>
                        </div>
                        <div className="tunnel-list__actions">
                          {isRunning ? (
                            <button className="btn--icon btn--icon-danger" onClick={() => handleStopTunnel(tunnel.id)} title="Durdur">
                              <Square size={12} />
                            </button>
                          ) : (
                            <button className="btn--icon" onClick={() => handleStartTunnel(tunnel)} title="Başlat">
                              <Play size={12} />
                            </button>
                          )}
                          <button className="btn--icon" onClick={() => handleEditTunnel(tunnel)} title="Düzenle">
                            <Edit2 size={12} />
                          </button>
                          <button className="btn--icon" onClick={() => handleDeleteTunnel(tunnel.id)} title="Sil">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="sidebar__footer">
              <button className="btn btn--primary" style={{ flex: 1 }} onClick={handleNewTunnel}>
                <Plus size={14} /> Yeni Tunnel
              </button>
              <button className="btn--icon" onClick={() => setShowSettings(true)}>
                <Settings size={16} />
              </button>
            </div>
          </>
        )}
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

      {showTunnelForm && (
        <SavedTunnelForm
          tunnel={editTunnel}
          onSubmit={handleSaveTunnel}
          onClose={() => setShowTunnelForm(false)}
        />
      )}

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </>
  );
}
