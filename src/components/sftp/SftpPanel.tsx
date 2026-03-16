import { useState, useCallback, useEffect } from 'react';
import { FileTree } from './FileTree';
import { TransferQueue } from './TransferQueue';
import { ArrowUp, RefreshCw, ArrowRight, ArrowLeft, FolderPlus, Trash2, Home } from 'lucide-react';
import { useTransferStore } from '../../store/useTransferStore';

interface Props {
  connectionId: string;
  sftpId: string;
}

function startProgressListener(transferId: string, refreshFn: () => void) {
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
        refreshFn();
      }
    }
  });
}

export function SftpPanel({ connectionId, sftpId }: Props) {
  const [localPath, setLocalPath] = useState('');
  const [remotePath, setRemotePath] = useState('/root');

  // Get user's home directory as default local path
  useEffect(() => {
    window.electronAPI.local.homedir().then((dir) => {
      setLocalPath(dir);
    });
  }, []);
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const [remoteSelected, setRemoteSelected] = useState<string | null>(null);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [remoteRefreshKey, setRemoteRefreshKey] = useState(0);

  const refreshLocal = () => setLocalRefreshKey((k) => k + 1);
  const refreshRemote = () => setRemoteRefreshKey((k) => k + 1);

  // Check if remote file exists, returns 'file' | 'directory' | false
  const checkRemoteExists = async (remoteDest: string): Promise<'file' | 'directory' | false> => {
    try {
      const stats = await window.electronAPI.sftp.stat(sftpId, remoteDest) as { mode: number };
      const isDir = (stats.mode & 0o40000) !== 0;
      return isDir ? 'directory' : 'file';
    } catch {
      return false;
    }
  };

  // Check if local file exists
  const checkLocalExists = async (localDest: string): Promise<boolean> => {
    try {
      const dir = localDest.substring(0, localDest.lastIndexOf('\\'));
      const name = localDest.substring(localDest.lastIndexOf('\\') + 1);
      const entries = await window.electronAPI.local.readdir(dir);
      return entries.some((e) => e.name === name);
    } catch {
      return false;
    }
  };

  // Upload a file (with overwrite check)
  const doUpload = useCallback(async (fileName: string, srcLocalPath: string) => {
    const sep = srcLocalPath.endsWith('\\') ? '' : '\\';
    const localFile = srcLocalPath + sep + fileName;
    const remoteDest = (remotePath.endsWith('/') ? remotePath : remotePath + '/') + fileName;

    // Overwrite check
    const exists = await checkRemoteExists(remoteDest);
    if (exists === 'directory') {
      alert(`"${fileName}" sunucuda bir klasör olarak mevcut. Üzerine yazılamaz.`);
      return;
    }
    if (exists === 'file') {
      if (!confirm(`"${fileName}" sunucuda zaten mevcut. Üzerine yazılsın mı?`)) return;
    }

    try {
      const transferId = await window.electronAPI.sftp.upload(sftpId, localFile, remoteDest);
      useTransferStore.getState().addTransfer({
        id: transferId, fileName, direction: 'upload',
        bytes: 0, total: 0, percentage: 0, speed: 0,
        status: 'active', startedAt: Date.now(),
      });
      startProgressListener(transferId, refreshRemote);
    } catch (err) {
      alert('Yükleme hatası: ' + (err as Error).message);
    }
  }, [sftpId, remotePath]);

  // Download a file (with overwrite check)
  const doDownload = useCallback(async (fileName: string, srcRemotePath: string) => {
    const remoteSrc = (srcRemotePath.endsWith('/') ? srcRemotePath : srcRemotePath + '/') + fileName;
    const sep = localPath.endsWith('\\') ? '' : '\\';
    const localDest = localPath + sep + fileName;

    if (!localPath) { alert('Yerel dizin henüz yüklenmedi.'); return; }

    // Overwrite check
    const exists = await checkLocalExists(localDest);
    if (exists) {
      if (!confirm(`"${fileName}" yerelde zaten mevcut. Üzerine yazılsın mı?`)) return;
    }

    try {
      const transferId = await window.electronAPI.sftp.download(sftpId, remoteSrc, localDest);
      useTransferStore.getState().addTransfer({
        id: transferId, fileName, direction: 'download',
        bytes: 0, total: 0, percentage: 0, speed: 0,
        status: 'active', startedAt: Date.now(),
      });
      startProgressListener(transferId, refreshLocal);
    } catch (err) {
      alert('İndirme hatası: ' + (err as Error).message);
    }
  }, [sftpId, localPath]);

  // Button handlers
  const handleUpload = useCallback(() => {
    if (!localSelected) { alert('Önce sol panelden bir dosya seçin.'); return; }
    doUpload(localSelected, localPath);
  }, [localSelected, localPath, doUpload]);

  const handleDownload = useCallback(() => {
    if (!remoteSelected) { alert('Önce sağ panelden bir dosya seçin.'); return; }
    doDownload(remoteSelected, remotePath);
  }, [remoteSelected, remotePath, doDownload]);

  // Drag & drop handler
  const handleLocalDrop = useCallback((fileName: string, sourcePath: string, sourceType: 'local' | 'remote') => {
    if (sourceType === 'remote') {
      doDownload(fileName, sourcePath);
    }
  }, [doDownload]);

  const handleRemoteDrop = useCallback((fileName: string, sourcePath: string, sourceType: 'local' | 'remote') => {
    if (sourceType === 'local') {
      doUpload(fileName, sourcePath);
    }
  }, [doUpload]);

  const handleRemoteDelete = useCallback(async () => {
    if (!remoteSelected) return;
    if (!confirm(`"${remoteSelected}" silinsin mi?`)) return;
    const target = (remotePath.endsWith('/') ? remotePath : remotePath + '/') + remoteSelected;
    try {
      await window.electronAPI.sftp.delete(sftpId, target, true);
      setRemoteSelected(null);
      refreshRemote();
    } catch (err) {
      alert('Silme hatası: ' + (err as Error).message);
    }
  }, [sftpId, remotePath, remoteSelected]);

  const handleRemoteMkdir = useCallback(async () => {
    const name = prompt('Yeni klasör adı:');
    if (!name) return;
    const target = (remotePath.endsWith('/') ? remotePath : remotePath + '/') + name;
    try {
      await window.electronAPI.sftp.mkdir(sftpId, target);
      refreshRemote();
    } catch (err) {
      alert('Klasör oluşturma hatası: ' + (err as Error).message);
    }
  }, [sftpId, remotePath]);

  return (
    <div className="sftp-panel">
      {/* Dual pane */}
      <div className="sftp-panes">
        {/* Local pane */}
        <div className="sftp-pane">
          <div className="sftp-pane__toolbar">
            <span className="sftp-pane__label">Yerel</span>
            <div style={{ flex: 1 }} />
            <button className="btn--icon" onClick={() => {
              const parts = localPath.split('\\').filter(Boolean);
              parts.pop();
              setLocalPath(parts.join('\\') || 'C:\\');
            }} title="Üst klasör"><ArrowUp size={13} /></button>
            <button className="btn--icon" onClick={() => setLocalPath('C:\\')} title="Ana dizin"><Home size={13} /></button>
            <button className="btn--icon" onClick={refreshLocal} title="Yenile"><RefreshCw size={13} /></button>
          </div>
          <div className="sftp-pane__path">
            <input className="form-input" value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && refreshLocal()}
              style={{ fontSize: 11, padding: '3px 6px' }} />
          </div>
          <div className="sftp-pane__content">
            <FileTree key={`local-${localRefreshKey}`} type="local" path={localPath}
              onNavigate={setLocalPath} selectedFile={localSelected}
              onSelect={setLocalSelected} onDropFile={handleLocalDrop} />
          </div>
        </div>

        {/* Action buttons (center) */}
        <div className="sftp-actions">
          <button className="sftp-actions__btn" onClick={handleUpload} disabled={!localSelected}
            title={localSelected ? `"${localSelected}" → Sunucu` : 'Soldan dosya seçin'}>
            <ArrowRight size={16} />
          </button>
          <button className="sftp-actions__btn" onClick={handleDownload} disabled={!remoteSelected}
            title={remoteSelected ? `"${remoteSelected}" → Bilgisayar` : 'Sağdan dosya seçin'}>
            <ArrowLeft size={16} />
          </button>
        </div>

        {/* Remote pane */}
        <div className="sftp-pane">
          <div className="sftp-pane__toolbar">
            <span className="sftp-pane__label">Uzak ({connectionId.substring(0, 8)})</span>
            <div style={{ flex: 1 }} />
            <button className="btn--icon" onClick={handleRemoteMkdir} title="Yeni klasör"><FolderPlus size={13} /></button>
            <button className="btn--icon" onClick={handleRemoteDelete} title="Sil" disabled={!remoteSelected}><Trash2 size={13} /></button>
            <button className="btn--icon" onClick={() => {
              const parts = remotePath.split('/').filter(Boolean);
              parts.pop();
              setRemotePath('/' + parts.join('/'));
            }} title="Üst klasör"><ArrowUp size={13} /></button>
            <button className="btn--icon" onClick={refreshRemote} title="Yenile"><RefreshCw size={13} /></button>
          </div>
          <div className="sftp-pane__path">
            <input className="form-input" value={remotePath}
              onChange={(e) => setRemotePath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && refreshRemote()}
              style={{ fontSize: 11, padding: '3px 6px' }} />
          </div>
          <div className="sftp-pane__content">
            <FileTree key={`remote-${remoteRefreshKey}`} type="remote" path={remotePath}
              onNavigate={setRemotePath} sftpId={sftpId} selectedFile={remoteSelected}
              onSelect={setRemoteSelected} onDropFile={handleRemoteDrop} />
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
