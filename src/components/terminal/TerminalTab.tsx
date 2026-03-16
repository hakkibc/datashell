import type { Tab } from '../../store/useTabStore';
import { TerminalPane } from './TerminalPane';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useTabStore } from '../../store/useTabStore';

interface Props {
  tab: Tab;
}

export function TerminalTab({ tab }: Props) {
  const handleReconnect = () => {
    useTabStore.getState().updateTab(tab.id, { status: 'connecting', connectionId: undefined, errorMessage: undefined });
  };

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
    <div className="terminal-container">
      <TerminalPane tab={tab} />
    </div>
  );
}
