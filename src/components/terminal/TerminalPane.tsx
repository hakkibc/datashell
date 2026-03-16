import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import type { Tab } from '../../store/useTabStore';
import { useTabStore } from '../../store/useTabStore';
import { useSettingsStore, terminalThemes } from '../../store/useSettingsStore';

interface Props {
  tab: Tab;
}

export function TerminalPane({ tab }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const { theme, fontSize, fontFamily } = useSettingsStore.getState();

    const terminal = new Terminal({
      theme: terminalThemes[theme],
      fontFamily,
      fontSize,
      scrollback: 10000,
      cursorBlink: true,
      cursorStyle: 'block',
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(containerRef.current);
    fitAddon.fit();
    terminal.focus();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Copy on select
    const selectionDisposable = terminal.onSelectionChange(() => {
      const { copyOnSelect: copyEnabled } = useSettingsStore.getState();
      if (copyEnabled) {
        const selection = terminal.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection).catch(() => {});
        }
      }
    });

    // Paste handler (reads clipboard and sends to SSH)
    const doPaste = () => {
      navigator.clipboard.readText().then((text) => {
        if (text) {
          const currentTab = useTabStore.getState().tabs.find((t) => t.id === tab.id);
          const connId = currentTab?.connectionId;
          if (connId) {
            window.electronAPI?.ssh.sendInput(connId, text);
          }
        }
      }).catch(() => {});
    };

    // Right-click paste
    const handleContextMenu = (e: MouseEvent) => {
      const { pasteMethod } = useSettingsStore.getState();
      if (pasteMethod === 'right-click') {
        e.preventDefault();
        doPaste();
      }
    };
    containerRef.current.addEventListener('contextmenu', handleContextMenu);

    // Middle-click paste
    const handleMouseDown = (e: MouseEvent) => {
      const { pasteMethod } = useSettingsStore.getState();
      if (pasteMethod === 'middle-click' && e.button === 1) {
        e.preventDefault();
        doPaste();
      }
    };
    containerRef.current.addEventListener('mousedown', handleMouseDown);

    // Ctrl+V paste
    const handleKeyDown = (e: KeyboardEvent) => {
      const { pasteMethod } = useSettingsStore.getState();
      if (pasteMethod === 'ctrl-v' && e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        doPaste();
      }
    };
    containerRef.current.addEventListener('keydown', handleKeyDown);

    // Resize observer — debounced
    // Track last SENT cols/rows to SSH to avoid redundant resize signals
    let lastSentCols = terminal.cols;
    let lastSentRows = terminal.rows;
    let wasHidden = false;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      const { width, height } = entry.contentRect;

      // Container hidden (display: none) — just mark it and skip
      if (width === 0 || height === 0) {
        wasHidden = true;
        return;
      }

      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        try {
          fitAddon.fit();

          // If becoming visible after being hidden, only fit the terminal UI
          // Do NOT send ssh.resize — the SSH session size hasn't changed
          if (wasHidden) {
            wasHidden = false;
            // Only send resize if dimensions actually differ from what SSH knows
            if (terminal.cols !== lastSentCols || terminal.rows !== lastSentRows) {
              lastSentCols = terminal.cols;
              lastSentRows = terminal.rows;
              const currentTab = useTabStore.getState().tabs.find((t) => t.id === tab.id);
              if (currentTab?.connectionId) {
                window.electronAPI?.ssh.resize(currentTab.connectionId, terminal.cols, terminal.rows);
              }
            }
            return;
          }

          // Real resize (user dragged window/sidebar) — always notify SSH
          if (terminal.cols !== lastSentCols || terminal.rows !== lastSentRows) {
            lastSentCols = terminal.cols;
            lastSentRows = terminal.rows;
            const currentTab = useTabStore.getState().tabs.find((t) => t.id === tab.id);
            if (currentTab?.connectionId) {
              window.electronAPI?.ssh.resize(currentTab.connectionId, terminal.cols, terminal.rows);
            }
          }
        } catch {
          // Ignore resize errors during cleanup
        }
      }, 150);
    });
    resizeObserver.observe(containerRef.current);

    // Connect SSH
    const connect = async () => {
      if (connectedRef.current) return;
      connectedRef.current = true;

      try {
        const connectionId = await window.electronAPI.ssh.connect(tab.sessionId);
        useTabStore.getState().updateTab(tab.id, { connectionId, status: 'connected' });

        await window.electronAPI.ssh.openShell(connectionId, {
          cols: terminal.cols,
          rows: terminal.rows,
        });

        lastSentCols = terminal.cols;
        lastSentRows = terminal.rows;

        // Data from SSH → terminal
        const removeDataListener = window.electronAPI.ssh.onData(connectionId, (data) => {
          terminal.write(data);
        });

        // Terminal input → SSH
        const inputDisposable = terminal.onData((input) => {
          window.electronAPI.ssh.sendInput(connectionId, input);
        });

        // Disconnected event
        const removeDisconnectListener = window.electronAPI.ssh.onDisconnected(
          connectionId,
          (reason) => {
            useTabStore.getState().updateTab(tab.id, {
              status: 'disconnected',
              errorMessage: reason,
            });
          }
        );

        // Cleanup on unmount
        return () => {
          removeDataListener();
          removeDisconnectListener();
          inputDisposable.dispose();
        };
      } catch (err) {
        const error = err as Error;
        useTabStore.getState().updateTab(tab.id, {
          status: 'error',
          errorMessage: error.message,
        });
      }
    };

    let cleanupConnection: (() => void) | undefined;
    connect().then((cleanup) => {
      cleanupConnection = cleanup;
    });

    // Listen for settings changes (theme, font, etc.)
    const unsubSettings = useSettingsStore.subscribe((state) => {
      terminal.options.theme = terminalThemes[state.theme];
      terminal.options.fontSize = state.fontSize;
      terminal.options.fontFamily = state.fontFamily;
      try { fitAddon.fit(); } catch { /* ignore */ }
    });

    const containerEl = containerRef.current;
    return () => {
      containerEl?.removeEventListener('contextmenu', handleContextMenu);
      containerEl?.removeEventListener('mousedown', handleMouseDown);
      containerEl?.removeEventListener('keydown', handleKeyDown);
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      selectionDisposable.dispose();
      unsubSettings();
      cleanupConnection?.();
      terminal.dispose();
      // Do NOT disconnect SSH — tab close handlers in TabBar handle that
    };
  }, [tab.sessionId, tab.id]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
