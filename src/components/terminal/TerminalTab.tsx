import { useState } from 'react';
import type { Tab } from '../../store/useTabStore';
import { TerminalPane } from './TerminalPane';
import { SftpPanel } from '../sftp/SftpPanel';
import { Loader2, AlertCircle, RefreshCw, FolderOpen } from 'lucide-react';
import { useTabStore } from '../../store/useTabStore';

interface Props {
  tab: Tab;
}

export function TerminalTab({ tab }: Props) {
  const [showSftp, setShowSftp] = useState(false);
  const [sftpId, setSftpId] = useState<string | null>(null);
  const [sftpLoading, setSftpLoading] = useState(false);

  const handleReconnect = () => {
    useTabStore.getState().updateTab(tab.id, { status: 'connecting', connectionId: undefined, errorMessage: undefined });
  };

  const handleToggleSftp = async () => {
    if (showSftp) {
      setShowSftp(false);
      return;
    }
    if (sftpId) {
      setShowSftp(true);
      return;
    }
    if (!tab.connectionId) return;

    setSftpLoading(true);
    try {
      const id = await window.electronAPI.sftp.open(tab.connectionId);
      setSftpId(id);
      setShowSftp(true);
    } catch (err) {
      alert('SFTP açılamadı: ' + (err as Error).message);
    } finally {
      setSftpLoading(false);
    }
  };

  const isConnected = tab.status === 'connected' && !!tab.connectionId;

  if (tab.status === 'connecting' && !tab.connectionId) {
    return (
      <div className="terminal-container">
        <TerminalPane tab={tab} />
        <div className="terminal-overlay">
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
          <div className="terminal-overlay__text">Bağlanıyor... {tab.host}</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    );
  }

  if (tab.status === 'error') {
    return (
      <div className="terminal-container">
        <div className="terminal-overlay">
          <AlertCircle size={32} color="var(--danger)" />
          <div className="terminal-overlay__text terminal-overlay--error">
            {tab.errorMessage || 'Bağlantı hatası'}
          </div>
          <button className="terminal-overlay__reconnect" onClick={handleReconnect}>
            <RefreshCw size={14} style={{ marginRight: 6 }} />
            Yeniden Bağlan
          </button>
        </div>
      </div>
    );
  }

  if (tab.status === 'disconnected') {
    return (
      <div className="terminal-container">
        <TerminalPane tab={tab} />
        <div className="terminal-overlay">
          <AlertCircle size={32} color="var(--warning)" />
          <div className="terminal-overlay__text">Bağlantı kesildi</div>
          <button className="terminal-overlay__reconnect" onClick={handleReconnect}>
            <RefreshCw size={14} style={{ marginRight: 6 }} />
            Yeniden Bağlan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* SFTP toolbar */}
      {isConnected && (
        <div className="terminal-toolbar">
          <button
            className={`terminal-toolbar__btn ${showSftp ? 'terminal-toolbar__btn--active' : ''}`}
            onClick={handleToggleSftp}
            disabled={sftpLoading}
            title="SFTP Dosya Yöneticisi"
          >
            <FolderOpen size={14} />
            <span>{sftpLoading ? 'Açılıyor...' : 'SFTP'}</span>
          </button>
        </div>
      )}

      {/* Terminal */}
      <div className="terminal-container" style={showSftp ? { flex: '0 0 40%' } : { flex: 1 }}>
        <TerminalPane tab={tab} />
      </div>

      {/* SFTP Panel */}
      {showSftp && sftpId && tab.connectionId && (
        <div style={{ flex: 1, borderTop: '2px solid var(--border)', overflow: 'hidden' }}>
          <SftpPanel connectionId={tab.connectionId} sftpId={sftpId} />
        </div>
      )}
    </div>
  );
}
