import { useState, useEffect } from 'react';
import { Folder, File, ArrowUp } from 'lucide-react';
import type { FileEntry } from '../../types/electron';

interface Props {
  type: 'local' | 'remote';
  path: string;
  onNavigate: (path: string) => void;
  sftpId?: string;
}

export function FileTree({ type, path, onNavigate, sftpId }: Props) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDirectory();
  }, [path, sftpId]);

  const loadDirectory = async () => {
    setLoading(true);
    try {
      if (type === 'remote' && sftpId) {
        const files = await window.electronAPI.sftp.readdir(sftpId, path);
        setEntries(files);
      }
      // Local file listing would use a separate IPC handler
    } catch (err) {
      console.error('Failed to load directory:', err);
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

  const formatSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  if (loading) {
    return <div style={{ padding: 8, color: 'var(--text-muted)', fontSize: 12 }}>Yükleniyor...</div>;
  }

  return (
    <div style={{ fontSize: 12 }}>
      <div
        className="session-item"
        style={{ padding: '3px 8px' }}
        onDoubleClick={navigateUp}
      >
        <ArrowUp size={13} />
        <span>..</span>
      </div>
      {sortedEntries.map((entry) => (
        <div
          key={entry.name}
          className="session-item"
          style={{ padding: '3px 8px' }}
          onDoubleClick={() => handleDoubleClick(entry)}
        >
          {entry.isDirectory ? <Folder size={13} color="var(--accent)" /> : <File size={13} />}
          <span style={{ flex: 1 }}>{entry.name}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            {!entry.isDirectory && formatSize(entry.attrs.size)}
          </span>
        </div>
      ))}
    </div>
  );
}
