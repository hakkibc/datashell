import { useState, useEffect } from 'react';
import { TunnelForm } from './TunnelForm';
import { Plus, Square, Wifi } from 'lucide-react';
import type { ActiveTunnel, TunnelConfig } from '../../types/electron';

interface Props {
  connectionId: string;
}

export function TunnelManager({ connectionId }: Props) {
  const [tunnels, setTunnels] = useState<ActiveTunnel[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadTunnels();
  }, [connectionId]);

  const loadTunnels = async () => {
    try {
      const list = await window.electronAPI.tunnel.listForConnection(connectionId);
      setTunnels(list);
    } catch (err) {
      console.error('Failed to load tunnels:', err);
    }
  };

  const handleStart = async (config: TunnelConfig) => {
    await window.electronAPI.tunnel.start(connectionId, config);
    loadTunnels();
    setShowForm(false);
  };

  const handleStop = async (tunnelId: string) => {
    await window.electronAPI.tunnel.stop(tunnelId);
    loadTunnels();
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Port Forwarding</div>
        <button className="btn btn--primary" onClick={() => setShowForm(true)}>
          <Plus size={14} /> Yeni Tunnel
        </button>
      </div>

      {tunnels.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 12 }}>
          Aktif tunnel yok
        </div>
      ) : (
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Tip</th>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Yerel Port</th>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Uzak</th>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Durum</th>
              <th style={{ padding: '6px 8px' }}></th>
            </tr>
          </thead>
          <tbody>
            {tunnels.map((t) => (
              <tr key={t.tunnelId} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 8px' }}>
                  <span style={{
                    padding: '2px 6px', borderRadius: 4, fontSize: 10,
                    background: t.type === 'local' ? 'var(--accent)' : t.type === 'remote' ? 'var(--success)' : 'var(--warning)',
                    color: 'white',
                  }}>
                    {t.type.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '6px 8px' }}>{t.localPort}</td>
                <td style={{ padding: '6px 8px' }}>{t.remoteHost}:{t.remotePort}</td>
                <td style={{ padding: '6px 8px' }}>
                  <Wifi size={12} color={t.status === 'active' ? 'var(--success)' : 'var(--danger)'} />
                  {' '}{t.status === 'active' ? 'Aktif' : 'Hata'}
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <button className="btn--icon" onClick={() => handleStop(t.tunnelId)} title="Durdur">
                    <Square size={12} color="var(--danger)" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && <TunnelForm onSubmit={handleStart} onClose={() => setShowForm(false)} />}
    </div>
  );
}
