import { useState } from 'react';
import { X } from 'lucide-react';
import type { TunnelConfig } from '../../types/electron';

interface Props {
  onSubmit: (config: TunnelConfig) => void;
  onClose: () => void;
}

export function TunnelForm({ onSubmit, onClose }: Props) {
  const [type, setType] = useState<TunnelConfig['type']>('local');
  const [localPort, setLocalPort] = useState(8080);
  const [remoteHost, setRemoteHost] = useState('127.0.0.1');
  const [remotePort, setRemotePort] = useState(80);
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    onSubmit({
      type,
      localPort,
      ...(type !== 'dynamic' && { remoteHost, remotePort }),
      description: description || undefined,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ minWidth: 360 }}>
        <div className="modal__header">
          <div className="modal__title">Yeni Tunnel</div>
          <button className="btn--icon" onClick={onClose}><X size={18} /></button>
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
          <input className="form-input" type="number" value={localPort} onChange={(e) => setLocalPort(Number(e.target.value))} />
        </div>

        {type !== 'dynamic' && (
          <>
            <div className="form-group">
              <label className="form-label">Uzak Host</label>
              <input className="form-input" value={remoteHost} onChange={(e) => setRemoteHost(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Uzak Port</label>
              <input className="form-input" type="number" value={remotePort} onChange={(e) => setRemotePort(Number(e.target.value))} />
            </div>
          </>
        )}

        <div className="form-group">
          <label className="form-label">Açıklama (opsiyonel)</label>
          <input className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Web server tunnel" />
        </div>

        <div className="modal__footer">
          <button className="btn" onClick={onClose}>İptal</button>
          <button className="btn btn--primary" onClick={handleSubmit}>Başlat</button>
        </div>
      </div>
    </div>
  );
}
