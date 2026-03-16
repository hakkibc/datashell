import { ChevronRight, ChevronDown, Folder } from 'lucide-react';
import type { SessionGroup as SessionGroupType } from '../../types/electron';

interface Props {
  group: SessionGroupType;
  count: number;
  onToggle: () => void;
  children?: React.ReactNode;
}

export function SessionGroup({ group, count, onToggle, children }: Props) {
  return (
    <div className="session-group">
      <div className="session-group__header" onClick={onToggle}>
        {group.expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Folder size={13} />
        {group.name}
        <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 'auto' }}>
          {count}
        </span>
      </div>
      {group.expanded && children}
    </div>
  );
}
