import { useState, useEffect } from 'react';
import { Folder, File, ArrowUp } from 'lucide-react';
import type { FileEntry } from '../../types/electron';

interface Props {
  type: 'local' | 'remote';
  path: string;
  onNavigate: (path: string) => void;
  sftpId?: string;
  selectedFile: string | null;
  onSelect: (name: string | null) => void;
  onDropFile?: (fileName: string, sourcePath: string, sourceType: 'local' | 'remote') => void;
}

export function FileTree({ type, path, onNavigate, sftpId, selectedFile, onSelect, onDropFile }: Props) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    loadDirectory();
  }, [path, sftpId]);

  const loadDirectory = async () => {
    setLoading(true);
    onSelect(null);
    try {
      if (type === 'remote' && sftpId) {
        const files = await window.electronAPI.sftp.readdir(sftpId, path);
        setEntries(files);
      } else if (type === 'local') {
        const files = await window.electronAPI.local.readdir(path);
        setEntries(files);
      }
    } catch (err) {
      console.error('Failed to load directory:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const sortedEntries = [...entries].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  const navigateUp = () => {
    const sep = type === 'local' ? '\\' : '/';
    const parts = path.split(sep).filter(Boolean);
    parts.pop();
    onNavigate(type === 'local' ? parts.join(sep) || 'C:\\' : '/' + parts.join('/'));
  };

  const handleDoubleClick = (entry: FileEntry) => {
    if (entry.isDirectory) {
      const sep = type === 'local' ? '\\' : '/';
      onNavigate(path.endsWith(sep) ? path + entry.name : path + sep + entry.name);
    }
  };

  const handleDragStart = (e: React.DragEvent, entry: FileEntry) => {
    if (entry.isDirectory) return;
    e.dataTransfer.setData('application/json', JSON.stringify({
      fileName: entry.name,
      sourcePath: path,
      sourceType: type,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.sourceType !== type && onDropFile) {
        onDropFile(data.fileName, data.sourcePath, data.sourceType);
      }
    } catch { /* ignore */ }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  };

  const formatSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp * 1000);
    return d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return <div style={{ padding: 8, color: 'var(--text-muted)', fontSize: 12 }}>Yükleniyor...</div>;
  }

  return (
    <div
      style={{ fontSize: 12, minHeight: '100%' }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      className={dragOver ? 'sftp-drop-target' : ''}
    >
      {/* Column headers */}
      <div className="sftp-row sftp-row--header">
        <span style={{ flex: 1 }}>Ad</span>
        <span style={{ width: 80, textAlign: 'right' }}>Boyut</span>
        <span style={{ width: 120, textAlign: 'right' }}>Değiştirilme</span>
      </div>
      <div className="sftp-row" onDoubleClick={navigateUp}>
        <ArrowUp size={13} />
        <span style={{ flex: 1 }}>..</span>
        <span style={{ width: 80 }} />
        <span style={{ width: 120 }} />
      </div>
      {sortedEntries.map((entry) => (
        <div
          key={entry.name}
          className={`sftp-row ${selectedFile === entry.name ? 'sftp-row--selected' : ''}`}
          onClick={() => onSelect(entry.name)}
          onDoubleClick={() => handleDoubleClick(entry)}
          draggable={!entry.isDirectory}
          onDragStart={(e) => handleDragStart(e, entry)}
        >
          {entry.isDirectory ? <Folder size={13} color="var(--accent)" /> : <File size={13} />}
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
          <span style={{ width: 80, textAlign: 'right', color: 'var(--text-muted)' }}>
            {!entry.isDirectory && formatSize(entry.attrs.size)}
          </span>
          <span style={{ width: 120, textAlign: 'right', color: 'var(--text-muted)' }}>
            {formatDate(entry.attrs.mtime)}
          </span>
        </div>
      ))}
    </div>
  );
}
