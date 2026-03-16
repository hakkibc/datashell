import { useSessionStore } from '../../store/useSessionStore';
import { SessionGroup } from './SessionGroup';
import { ChevronRight, ChevronDown, Server, Folder } from 'lucide-react';
import type { Session } from '../../types/electron';

interface Props {
  onConnect: (session: Session) => void;
  onEdit: (session: Session) => void;
}

export function SessionManager({ onConnect, onEdit }: Props) {
  const { sessions, groups, searchQuery, toggleGroupExpand, deleteSession } = useSessionStore();

  const filteredSessions = searchQuery
    ? sessions.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : sessions;

  const ungroupedSessions = filteredSessions.filter((s) => !s.groupId);
  const groupedSessions = (groupId: string) =>
    filteredSessions.filter((s) => s.groupId === groupId);

  const handleContextMenu = (e: React.MouseEvent, session: Session) => {
    e.preventDefault();
    // Simple context menu via confirm/prompt for now
    const action = prompt(
      `${session.name}\n\n1: Bağlan\n2: Düzenle\n3: Sil\n\nSeçim:`
    );
    if (action === '1') onConnect(session);
    if (action === '2') onEdit(session);
    if (action === '3') {
      if (confirm(`"${session.name}" silinsin mi?`)) {
        deleteSession(session.id);
      }
    }
  };

  return (
    <div>
      {groups.map((group) => (
        <div key={group.id} className="session-group">
          <div
            className="session-group__header"
            onClick={() => toggleGroupExpand(group.id)}
          >
            {group.expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Folder size={13} />
            {group.name}
            <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 'auto' }}>
              {groupedSessions(group.id).length}
            </span>
          </div>
          {group.expanded &&
            groupedSessions(group.id).map((session) => (
              <div
                key={session.id}
                className="session-item"
                onDoubleClick={() => onConnect(session)}
                onContextMenu={(e) => handleContextMenu(e, session)}
              >
                {session.color && (
                  <div className="session-item__color" style={{ background: session.color }} />
                )}
                <Server size={14} />
                <span className="session-item__name">{session.name}</span>
                <span className="session-item__host">{session.host}</span>
              </div>
            ))}
        </div>
      ))}

      {ungroupedSessions.length > 0 && (
        <div className="session-group">
          {groups.length > 0 && (
            <div className="session-group__header" style={{ color: 'var(--text-muted)' }}>
              Gruplandırılmamış
            </div>
          )}
          {ungroupedSessions.map((session) => (
            <div
              key={session.id}
              className="session-item"
              onDoubleClick={() => onConnect(session)}
              onContextMenu={(e) => handleContextMenu(e, session)}
            >
              {session.color && (
                <div className="session-item__color" style={{ background: session.color }} />
              )}
              <Server size={14} />
              <span className="session-item__name">{session.name}</span>
              <span className="session-item__host">{session.host}</span>
            </div>
          ))}
        </div>
      )}

      {filteredSessions.length === 0 && (
        <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
          {searchQuery ? 'Sonuç bulunamadı' : 'Henüz session yok'}
        </div>
      )}
    </div>
  );
}
