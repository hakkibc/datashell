import { useState, useCallback } from 'react';
import { FileTree } from './FileTree';
import { TransferQueue } from './TransferQueue';
import { ArrowUp, RefreshCw, Upload, Download, FolderPlus, Trash2, Home } from 'lucide-react';
import { useTransferStore } from '../../store/useTransferStore';

interface Props {
  connectionId: string;
  sftpId: string;
}

export function SftpPanel({ connectionId, sftpId }: Props) {
  const [localPath, setLocalPath] = useState('C:\\Users');
  const [remotePath, setRemotePath] = useState('/root');
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const [remoteSelected, setRemoteSelected] = useState<string | null>(null);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [remoteRefreshKey, setRemoteRefreshKey] = useState(0);

  const refreshLocal = () => setLocalRefreshKey((k) => k + 1);
  const refreshRemote = () => setRemoteRefreshKey((k) => k + 1);

  const handleUpload = useCallback(async () => {
    // Upload selected local file to remote
    const files = await window.electronAPI.local.selectFile();
    if (!files || files.length === 0) return;

    for (const localFile of files) {
      const fileName = localFile.split('\\').pop() || localFile.split('/').pop() || 'file';
      const remoteDest = remotePath.endsWith('/') ? remotePath + fileName : remotePath + '/' + fileName;

      const transferId = await window.electronAPI.sftp.upload(sftpId, localFile, remoteDest);

      useTransferStore.getState().addTransfer({
        id: transferId,
        fileName,
        direction: 'upload',
        bytes: 0,
        total: 0,
        percentage: 0,
        speed: 0,
        status: 'active',
        startedAt: Date.now(),
      });

      const removeProgress = window.electronAPI.sftp.onProgress(transferId, (progress) => {
        const store = useTransferStore.getState();
        const transfer = store.transfers.find((t) => t.id === transferId);
        if (transfer) {
          const elapsed = (Date.now() - transfer.startedAt) / 1000;
          store.updateTransfer(transferId, {
            bytes: progress.bytes,
            total: progress.total,
            percentage: progress.percentage,
            speed: elapsed > 0 ? progress.bytes / elapsed : 0,
            status: progress.percentage >= 100 ? 'completed' : 'active',
          });
          if (progress.percentage >= 100) {
            removeProgress();
            refreshRemote();
          }
        }
      });
    }
  }, [sftpId, remotePath]);

  const handleDownload = useCallback(async () => {
    if (!remoteSelected) return;

    const remoteSrc = remotePath.endsWith('/') ? remotePath + remoteSelected : remotePath + '/' + remoteSelected;
    const savePath = await window.electronAPI.local.selectSavePath(remoteSelected);
    if (!savePath) return;

    const transferId = await window.electronAPI.sftp.download(sftpId, remoteSrc, savePath);

    useTransferStore.getState().addTransfer({
      id: transferId,
      fileName: remoteSelected,
      direction: 'download',
      bytes: 0,
      total: 0,
      percentage: 0,
      speed: 0,
      status: 'active',
      startedAt: Date.now(),
    });

    const removeProgress = window.electronAPI.sftp.onProgress(transferId, (progress) => {
      const store = useTransferStore.getState();
      const transfer = store.transfers.find((t) => t.id === transferId);
      if (transfer) {
        const elapsed = (Date.now() - transfer.startedAt) / 1000;
        store.updateTransfer(transferId, {
          bytes: progress.bytes,
          total: progress.total,
          percentage: progress.percentage,
          speed: elapsed > 0 ? progress.bytes / elapsed : 0,
          status: progress.percentage >= 100 ? 'completed' : 'active',
        });
        if (progress.percentage >= 100) {
          removeProgress();
          refreshLocal();
        }
      }
    });
  }, [sftpId, remotePath, remoteSelected]);

  const handleRemoteDelete = useCallback(async () => {
    if (!remoteSelected) return;
    if (!confirm(`"${remoteSelected}" silinsin mi?`)) return;
    const target = remotePath.endsWith('/') ? remotePath + remoteSelected : remotePath + '/' + remoteSelected;
    try {
      await window.electronAPI.sftp.delete(sftpId, target, true);
      refreshRemote();
    } catch (err) {
      alert('Silme hatası: ' + (err as Error).message);
    }
  }, [sftpId, remotePath, remoteSelected]);

  const handleRemoteMkdir = useCallback(async () => {
    const name = prompt('Yeni klasör adı:');
    if (!name) return;
    const target = remotePath.endsWith('/') ? remotePath + name : remotePath + '/' + name;
    try {
      await window.electronAPI.sftp.mkdir(sftpId, target);
      refreshRemote();
    } catch (err) {
      alert('Klasör oluşturma hatası: ' + (err as Error).message);
    }
  }, [sftpId, remotePath]);

  const localNavigateUp = () => {
    const parts = localPath.split('\\').filter(Boolean);
    parts.pop();
    setLocalPath(parts.join('\\') || 'C:\\');
  };

  const remoteNavigateUp = () => {
    const parts = remotePath.split('/').filter(Boolean);
    parts.pop();
    setRemotePath('/' + parts.join('/'));
  };

  return (
    <div className="sftp-panel">
      {/* Dual pane */}
      <div className="sftp-panes">
        {/* Local pane */}
        <div className="sftp-pane">
          <div className="sftp-pane__toolbar">
            <span className="sftp-pane__label">Yerel</span>
            <div style={{ flex: 1 }} />
            <button className="btn--icon" onClick={localNavigateUp} title="Üst klasör">
              <ArrowUp size={13} />
            </button>
            <button className="btn--icon" onClick={() => setLocalPath('C:\\')} title="Ana dizin">
              <Home size={13} />
            </button>
            <button className="btn--icon" onClick={refreshLocal} title="Yenile">
              <RefreshCw size={13} />
            </button>
          </div>
          <div className="sftp-pane__path">
            <input
              className="form-input"
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && refreshLocal()}
              style={{ fontSize: 11, padding: '3px 6px' }}
            />
          </div>
          <div className="sftp-pane__content">
            <FileTree
              key={`local-${localRefreshKey}`}
              type="local"
              path={localPath}
              onNavigate={setLocalPath}
              selectedFile={localSelected}
              onSelect={setLocalSelected}
            />
          </div>
        </div>

        {/* Action buttons (center) */}
        <div className="sftp-actions">
          <button className="btn--icon" onClick={handleUpload} title="Yükle (Upload)">
            <Upload size={14} color="var(--accent)" />
          </button>
          <button className="btn--icon" onClick={handleDownload} title="İndir (Download)" disabled={!remoteSelected}>
            <Download size={14} color="var(--success)" />
          </button>
        </div>

        {/* Remote pane */}
        <div className="sftp-pane">
          <div className="sftp-pane__toolbar">
            <span className="sftp-pane__label">Uzak ({connectionId.substring(0, 8)})</span>
            <div style={{ flex: 1 }} />
            <button className="btn--icon" onClick={handleRemoteMkdir} title="Yeni klasör">
              <FolderPlus size={13} />
            </button>
            <button className="btn--icon" onClick={handleRemoteDelete} title="Sil" disabled={!remoteSelected}>
              <Trash2 size={13} />
            </button>
            <button className="btn--icon" onClick={remoteNavigateUp} title="Üst klasör">
              <ArrowUp size={13} />
            </button>
            <button className="btn--icon" onClick={refreshRemote} title="Yenile">
              <RefreshCw size={13} />
            </button>
          </div>
          <div className="sftp-pane__path">
            <input
              className="form-input"
              value={remotePath}
              onChange={(e) => setRemotePath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && refreshRemote()}
              style={{ fontSize: 11, padding: '3px 6px' }}
            />
          </div>
          <div className="sftp-pane__content">
            <FileTree
              key={`remote-${remoteRefreshKey}`}
              type="remote"
              path={remotePath}
              onNavigate={setRemotePath}
              sftpId={sftpId}
              selectedFile={remoteSelected}
              onSelect={setRemoteSelected}
            />
          </div>
        </div>
      </div>

      {/* Transfer queue at bottom */}
      <div className="sftp-transfers">
        <TransferQueue />
      </div>
    </div>
  );
}
