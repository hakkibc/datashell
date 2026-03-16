import { useState, useRef, useCallback, useEffect } from 'react';
import type { Tab } from '../../store/useTabStore';
import { TerminalPane } from './TerminalPane';
import { SftpPanel } from '../sftp/SftpPanel';
import { Loader2, AlertCircle, RefreshCw, X } from 'lucide-react';
import { useTabStore } from '../../store/useTabStore';

interface Props {
  tab: Tab;
}

export function TerminalTab({ tab }: Props) {
  const [showSftp, setShowSftp] = useState(false);
  const [sftpId, setSftpId] = useState<string | null>(null);
  const [sftpLoading, setSftpLoading] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.4); // terminal gets 40% when SFTP open
  const dragging = useRef(false);
  const splitRef = useRef<HTMLDivElement>(null);

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

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current || !splitRef.current) return;
      const rect = splitRef.current.getBoundingClientRect();
      const ratio = (ev.clientY - rect.top) / rect.height;
      setSplitRatio(Math.max(0.15, Math.min(0.85, ratio)));
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

  const isConnected = tab.status === 'connected' && !!tab.connectionId;

  // Listen for SFTP toggle from sidebar
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.tabId === tab.id) {
        handleToggleSftp();
      }
    };
    window.addEventListener('datashell:toggle-sftp', handler);
    return () => window.removeEventListener('datashell:toggle-sftp', handler);
  }, [tab.id, sftpId, showSftp, tab.connectionId]);

  // Auto-open SFTP when tab has autoSftp flag and becomes connected
  const autoSftpTriggered = useRef(false);
  useEffect(() => {
    if (tab.autoSftp && tab.status === 'connected' && tab.connectionId && !autoSftpTriggered.current) {
      autoSftpTriggered.current = true;
      // Clear the flag from store
      useTabStore.getState().updateTab(tab.id, { autoSftp: false });
      handleToggleSftp();
    }
  }, [tab.autoSftp, tab.status, tab.connectionId]);

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
    <div className="terminal-split" ref={splitRef}>
      {/* Terminal */}
      <div className="terminal-container" style={showSftp ? { flex: `0 0 ${splitRatio * 100}%`, minHeight: 80 } : { flex: 1 }}>
        <TerminalPane tab={tab} />
      </div>

      {/* Resize handle */}
      {showSftp && (
        <div className="resize-handle resize-handle--horizontal" onMouseDown={handleMouseDown} />
      )}

      {/* Bottom Panel — SFTP */}
      {showSftp && sftpId && tab.connectionId && (
        <div className="terminal-bottom-panel">
          <button
            className="sftp-close-btn"
            onClick={() => setShowSftp(false)}
            title="SFTP Kapat"
          >
            <X size={14} />
          </button>
          <SftpPanel connectionId={tab.connectionId} sftpId={sftpId} />
        </div>
      )}
    </div>
  );
}
