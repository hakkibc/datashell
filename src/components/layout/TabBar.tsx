import { useTabStore } from '../../store/useTabStore';
import { useSessionStore } from '../../store/useSessionStore';
import { X, Plus, Terminal, FolderOpen, Copy, Trash2, Eraser, Server } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import type { Tab } from '../../store/useTabStore';
import type { Session } from '../../types/electron';

interface ContextMenu {
  x: number;
  y: number;
  tabId: string;
}

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, removeTab, addTab, nextTab, prevTab } = useTabStore();
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const plusBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          prevTab();
        } else {
          nextTab();
        }
      }
      if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (tabs[idx]) setActiveTab(tabs[idx].id);
      }
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        if (activeTabId) removeTab(activeTabId);
      }
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        if (plusBtnRef.current) {
          const rect = plusBtnRef.current.getBoundingClientRect();
          setPickerPos({ top: rect.bottom + 4, left: rect.left });
        }
        setShowSessionPicker(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTabId, nextTab, prevTab, setActiveTab, removeTab]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  // Close session picker on outside click
  useEffect(() => {
    if (!showSessionPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
          plusBtnRef.current && !plusBtnRef.current.contains(e.target as Node)) {
        setShowSessionPicker(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [showSessionPicker]);

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    const tab = tabs.find((t) => t.id === tabId);
    if (tab?.connectionId) {
      window.electronAPI?.ssh.disconnect(tab.connectionId);
    }
    removeTab(tabId);
  };

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  };

  const handleDuplicate = () => {
    if (!contextMenu) return;
    const tab = tabs.find((t) => t.id === contextMenu.tabId);
    if (!tab) return;
    const newTabId = Math.random().toString(36).substring(2, 15);
    addTab({
      id: newTabId,
      sessionId: tab.sessionId,
      sessionName: tab.sessionName,
      host: tab.host,
      type: 'terminal',
      status: 'connecting',
      color: tab.color,
    });
    setContextMenu(null);
  };

  const handleClose = () => {
    if (!contextMenu) return;
    const tab = tabs.find((t) => t.id === contextMenu.tabId);
    if (tab?.connectionId) {
      window.electronAPI?.ssh.disconnect(tab.connectionId);
    }
    removeTab(contextMenu.tabId);
    setContextMenu(null);
  };

  const handleClear = () => {
    if (!contextMenu) return;
    const tab = tabs.find((t) => t.id === contextMenu.tabId);
    if (tab?.connectionId) {
      window.electronAPI?.ssh.sendInput(tab.connectionId, 'clear\n');
    }
    setContextMenu(null);
  };

  // Calculate picker position from button rect
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const handleTogglePicker = () => {
    if (!showSessionPicker && plusBtnRef.current) {
      const rect = plusBtnRef.current.getBoundingClientRect();
      setPickerPos({ top: rect.bottom + 4, left: rect.left });
    }
    setShowSessionPicker((v) => !v);
  };

  const handleSelectSession = (session: Session) => {
    const tabId = Math.random().toString(36).substring(2, 15);
    addTab({
      id: tabId,
      sessionId: session.id,
      sessionName: session.name,
      host: session.host,
      type: 'terminal',
      status: 'connecting',
      color: session.color,
    });
    setShowSessionPicker(false);
  };

  return (
    <div className="tabbar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? 'tab--active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
          onContextMenu={(e) => handleContextMenu(e, tab.id)}
        >
          {tab.color && (
            <div className="tab__indicator" style={{ background: tab.color }} />
          )}
          {tab.type === 'terminal' ? <Terminal size={13} /> : <FolderOpen size={13} />}
          <span>{tab.sessionName}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{tab.host}</span>
          <button className="tab__close" onClick={(e) => handleCloseTab(e, tab.id)}>
            <X size={12} />
          </button>
        </div>
      ))}
      <button
        ref={plusBtnRef}
        className="tab-new"
        title="Yeni Tab (Ctrl+T)"
        onClick={handleTogglePicker}
      >
        <Plus size={16} />
      </button>
      {showSessionPicker && <SessionPicker ref={pickerRef} style={{ top: pickerPos.top, left: pickerPos.left }} onSelect={handleSelectSession} onNewSession={() => { setShowSessionPicker(false); window.dispatchEvent(new CustomEvent('datashell:new-session')); }} />}

      {contextMenu && (
        <div
          className="tab-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button className="tab-context-menu__item" onClick={handleDuplicate}>
            <Copy size={13} /> Duplicate
          </button>
          <button className="tab-context-menu__item" onClick={handleClear}>
            <Eraser size={13} /> Clear
          </button>
          <div className="tab-context-menu__separator" />
          <button className="tab-context-menu__item tab-context-menu__item--danger" onClick={handleClose}>
            <Trash2 size={13} /> Close
          </button>
        </div>
      )}
    </div>
  );
}

import { forwardRef } from 'react';

interface SessionPickerProps {
  onSelect: (session: Session) => void;
  onNewSession: () => void;
  style?: React.CSSProperties;
}

const SessionPicker = forwardRef<HTMLDivElement, SessionPickerProps>(({ onSelect, onNewSession, style }, ref) => {
  const { sessions, groups } = useSessionStore();

  const groupedSessions = (groupId: string) => sessions.filter((s) => s.groupId === groupId);
  const ungrouped = sessions.filter((s) => !s.groupId);

  return (
    <div className="session-picker" ref={ref} style={style}>
      <div className="session-picker__list">
        {groups.map((group) => {
          const items = groupedSessions(group.id);
          if (items.length === 0) return null;
          return (
            <div key={group.id}>
              <div className="session-picker__group">{group.name}</div>
              {items.map((session) => (
                <button key={session.id} className="session-picker__item" onClick={() => onSelect(session)}>
                  {session.color && <div className="session-item__color" style={{ background: session.color }} />}
                  <Server size={13} />
                  <span className="session-picker__name">{session.name}</span>
                  <span className="session-picker__host">{session.host}</span>
                </button>
              ))}
            </div>
          );
        })}
        {ungrouped.map((session) => (
          <button key={session.id} className="session-picker__item" onClick={() => onSelect(session)}>
            {session.color && <div className="session-item__color" style={{ background: session.color }} />}
            <Server size={13} />
            <span className="session-picker__name">{session.name}</span>
            <span className="session-picker__host">{session.host}</span>
          </button>
        ))}
        {sessions.length === 0 && (
          <div style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            Kayitli session yok
          </div>
        )}
      </div>
      <button className="session-picker__new" onClick={onNewSession}>
        <Plus size={13} /> Yeni Session Olustur
      </button>
    </div>
  );
});
