import { useState } from 'react';
import { FileTree } from './FileTree';
import { TransferQueue } from './TransferQueue';
import { ArrowLeft, ArrowRight, ArrowUp, RefreshCw } from 'lucide-react';

interface Props {
  connectionId: string;
  sftpId: string;
}

export function SftpPanel({ connectionId, sftpId }: Props) {
  const [localPath, setLocalPath] = useState('C:\\Users');
  const [remotePath, setRemotePath] = useState('/home');
  const [showTransfers, setShowTransfers] = useState(true);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 4, padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
        <button className="btn--icon"><ArrowLeft size={14} /></button>
        <button className="btn--icon"><ArrowRight size={14} /></button>
        <button className="btn--icon"><ArrowUp size={14} /></button>
        <button className="btn--icon"><RefreshCw size={14} /></button>
      </div>

      {/* Split pane */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Local */}
        <div style={{ flex: 1, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
            Yerel: {localPath}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 4 }}>
            <FileTree type="local" path={localPath} onNavigate={setLocalPath} />
          </div>
        </div>

        {/* Remote */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
            Uzak: {remotePath}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 4 }}>
            <FileTree type="remote" path={remotePath} onNavigate={setRemotePath} sftpId={sftpId} />
          </div>
        </div>
      </div>

      {/* Transfer Queue */}
      {showTransfers && (
        <div style={{ borderTop: '1px solid var(--border)', maxHeight: 150 }}>
          <TransferQueue />
        </div>
      )}
    </div>
  );
}
