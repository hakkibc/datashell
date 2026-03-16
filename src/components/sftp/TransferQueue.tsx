import { useTransferStore } from '../../store/useTransferStore';
import { ArrowUp, ArrowDown, X, Trash2 } from 'lucide-react';

export function TransferQueue() {
  const { transfers, cancelTransfer, clearCompleted } = useTransferStore();

  if (transfers.length === 0) {
    return (
      <div style={{ padding: 8, textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
        Transfer kuyruğu boş
      </div>
    );
  }

  return (
    <div style={{ fontSize: 11 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Transferler ({transfers.length})</span>
        <button className="btn--icon" style={{ width: 18, height: 18 }} onClick={clearCompleted} title="Tamamlananları temizle">
          <Trash2 size={11} />
        </button>
      </div>
      {transfers.map((t) => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px' }}>
          {t.direction === 'upload' ? <ArrowUp size={11} color="var(--accent)" /> : <ArrowDown size={11} color="var(--success)" />}
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.fileName}</span>
          <div style={{ width: 80, height: 4, background: 'var(--bg-tertiary)', borderRadius: 2 }}>
            <div
              style={{
                width: `${t.percentage}%`,
                height: '100%',
                background: t.status === 'error' ? 'var(--danger)' : 'var(--accent)',
                borderRadius: 2,
                transition: 'width 0.3s',
              }}
            />
          </div>
          <span style={{ color: 'var(--text-muted)', minWidth: 32 }}>{t.percentage}%</span>
          {t.status === 'active' && (
            <button className="btn--icon" style={{ width: 16, height: 16 }} onClick={() => cancelTransfer(t.id)}>
              <X size={10} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
