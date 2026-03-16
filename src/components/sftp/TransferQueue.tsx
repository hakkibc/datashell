import { useTransferStore } from '../../store/useTransferStore';
import { ArrowUp, ArrowDown, X, Trash2, CheckCircle } from 'lucide-react';

function formatSpeed(bytesPerSec: number) {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatTimeLeft(bytes: number, total: number, speed: number) {
  if (speed <= 0 || total <= 0) return '--';
  const remaining = total - bytes;
  const seconds = remaining / speed;
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

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
      <div className="sftp-transfer__header">
        <span>Ad</span>
        <span>Durum</span>
        <span>İlerleme</span>
        <span>Boyut</span>
        <span>Hız</span>
        <span>Kalan</span>
        <span style={{ width: 40, textAlign: 'center' }}>
          <button className="btn--icon" style={{ width: 18, height: 18 }} onClick={clearCompleted} title="Tamamlananları temizle">
            <Trash2 size={11} />
          </button>
        </span>
      </div>
      {transfers.map((t) => (
        <div key={t.id} className="sftp-transfer__row">
          <span className="sftp-transfer__name">
            {t.direction === 'upload' ? <ArrowUp size={11} color="var(--accent)" /> : <ArrowDown size={11} color="var(--success)" />}
            {t.fileName}
          </span>
          <span className="sftp-transfer__status">
            {t.status === 'completed' ? (
              <CheckCircle size={11} color="var(--success)" />
            ) : t.status === 'error' ? (
              <span style={{ color: 'var(--danger)' }}>Hata</span>
            ) : t.status === 'cancelled' ? (
              <span style={{ color: 'var(--text-muted)' }}>İptal</span>
            ) : (
              <span style={{ color: 'var(--accent)' }}>Aktarılıyor</span>
            )}
          </span>
          <span className="sftp-transfer__progress">
            <div className="sftp-progress-bar">
              <div
                className="sftp-progress-bar__fill"
                style={{
                  width: `${t.percentage}%`,
                  background: t.status === 'error' ? 'var(--danger)' : t.status === 'completed' ? 'var(--success)' : 'var(--accent)',
                }}
              />
            </div>
            <span>{t.percentage}%</span>
          </span>
          <span className="sftp-transfer__size">
            {formatSize(t.bytes)} / {formatSize(t.total)}
          </span>
          <span className="sftp-transfer__speed">
            {t.status === 'active' ? formatSpeed(t.speed) : '--'}
          </span>
          <span className="sftp-transfer__time">
            {t.status === 'active' ? formatTimeLeft(t.bytes, t.total, t.speed) : '--'}
          </span>
          <span style={{ width: 40, textAlign: 'center' }}>
            {t.status === 'active' && (
              <button className="btn--icon" style={{ width: 18, height: 18 }} onClick={() => cancelTransfer(t.id)}>
                <X size={11} />
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
