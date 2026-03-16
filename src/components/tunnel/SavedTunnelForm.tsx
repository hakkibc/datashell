import { useState, memo } from 'react';
import { X } from 'lucide-react';
import { useSessionStore } from '../../store/useSessionStore';
import type { SavedTunnel } from '../../types/electron';

interface Props {
  tunnel?: SavedTunnel | null;
  onSubmit: (data: Omit<SavedTunnel, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}

export const SavedTunnelForm = memo(function SavedTunnelForm({ tunnel, onSubmit, onClose }: Props) {
  const sessions = useSessionStore((s) => s.sessions);
  const [name, setName] = useState(tunnel?.name || '');
  const [sessionId, setSessionId] = useState(tunnel?.sessionId || (sessions[0]?.id || ''));
  const [type, setType] = useState<'local' | 'remote' | 'dynamic'>(tunnel?.type || 'local');
  const [localPort, setLocalPort] = useState(tunnel?.localPort || 8080);
  const [remoteHost, setRemoteHost] = useState(tunnel?.remoteHost || '127.0.0.1');
  const [remotePort, setRemotePort] = useState(tunnel?.remotePort || 80);

  const handleSubmit = () => {
    if (!name.trim()) { alert('Tunnel adı gerekli.'); return; }
    if (!sessionId) { alert('Bir session seçin.'); return; }
    onSubmit({
      name: name.trim(),
      sessionId,
      type,
      localPort,
      ...(type !== 'dynamic' && { remoteHost, remotePort }),
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ minWidth: 380 }}>
        <div className="modal__header">
          <div className="modal__title">{tunnel ? 'Tunnel Düzenle' : 'Yeni Tunnel'}</div>
          <button className="btn--icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="form-group">
          <label className="form-label">Tunnel Adı</label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Web Server Tunnel" />
        </div>

        <div className="form-group">
          <label className="form-label">SSH Session</label>
          <select className="form-input" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            {sessions.length === 0 && <option value="">Session yok</option>}
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.host})</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Tunnel Tipi</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['local', 'remote', 'dynamic'] as const).map((t) => (
              <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12 }}>
                <input type="radio" checked={type === t} onChange={() => setType(t)} />
                {t === 'local' && 'Local (-L)'}
                {t === 'remote' && 'Remote (-R)'}
                {t === 'dynamic' && 'Dynamic (-D)'}
              </label>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Yerel Port</label>
          <input className="form-input" type="number" value={localPort}
            onChange={(e) => setLocalPort(Number(e.target.value))} />
        </div>

        {type !== 'dynamic' && (
          <>
            <div className="form-group">
              <label className="form-label">Uzak Host</label>
              <input className="form-input" value={remoteHost}
                onChange={(e) => setRemoteHost(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Uzak Port</label>
              <input className="form-input" type="number" value={remotePort}
                onChange={(e) => setRemotePort(Number(e.target.value))} />
            </div>
          </>
        )}

        <div className="modal__footer">
          <button className="btn" onClick={onClose}>İptal</button>
          <button className="btn btn--primary" onClick={handleSubmit}>Kaydet</button>
        </div>
      </div>
    </div>
  );
});
