import { X, Palette, Terminal, Info } from 'lucide-react';
import { useState } from 'react';
import {
  useSettingsStore,
  themeLabels,
  terminalThemes,
  type ThemeName,
} from '../../store/useSettingsStore';

interface Props {
  onClose: () => void;
}

type SettingsTab = 'appearance' | 'terminal' | 'about';

export function SettingsPanel({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'appearance', label: 'Gorunum', icon: <Palette size={14} /> },
    { id: 'terminal', label: 'Terminal', icon: <Terminal size={14} /> },
    { id: 'about', label: 'Hakkinda', icon: <Info size={14} /> },
  ];

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ minWidth: 520, maxWidth: 600 }}>
        <div className="modal__header">
          <div className="modal__title">Ayarlar</div>
          <button className="btn--icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="form-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`form-tab ${activeTab === tab.id ? 'form-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {tab.icon} {tab.label}
              </span>
            </button>
          ))}
        </div>

        {activeTab === 'appearance' && <AppearanceSettings />}
        {activeTab === 'terminal' && <TerminalSettings />}
        {activeTab === 'about' && <AboutSection />}
      </div>
    </div>
  );
}

function AppearanceSettings() {
  const { theme, setTheme } = useSettingsStore();

  return (
    <div>
      <div className="form-group">
        <label className="form-label">Tema</label>
        <div className="settings__theme-grid">
          {(Object.keys(themeLabels) as ThemeName[]).map((t) => {
            const colors = terminalThemes[t];
            return (
              <button
                key={t}
                className={`settings__theme-card ${theme === t ? 'settings__theme-card--active' : ''}`}
                onClick={() => setTheme(t)}
              >
                <div
                  className="settings__theme-preview"
                  style={{ background: colors.background }}
                >
                  <span style={{ color: colors.green }}>$</span>
                  <span style={{ color: colors.foreground }}> ssh </span>
                  <span style={{ color: colors.blue }}>user@host</span>
                </div>
                <div className="settings__theme-name">{themeLabels[t]}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TerminalSettings() {
  const { copyOnSelect, setCopyOnSelect, fontSize, setFontSize, fontFamily, setFontFamily } =
    useSettingsStore();

  return (
    <div>
      <div className="form-group">
        <label className="form-label">Font Boyutu</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="range"
            min={10}
            max={24}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 30 }}>
            {fontSize}px
          </span>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Font Ailesi</label>
        <select
          className="form-select"
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
          style={{ width: '100%' }}
        >
          <option value="'Cascadia Code', 'Consolas', monospace">Cascadia Code</option>
          <option value="'Consolas', monospace">Consolas</option>
          <option value="'Courier New', monospace">Courier New</option>
          <option value="'Fira Code', monospace">Fira Code</option>
          <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
          <option value="monospace">Monospace (Sistem)</option>
        </select>
      </div>

      <div className="form-group">
        <label className="settings__toggle">
          <input
            type="checkbox"
            checked={copyOnSelect}
            onChange={(e) => setCopyOnSelect(e.target.checked)}
          />
          <span className="settings__toggle-label">
            <span>Secimle Kopyala</span>
            <span className="settings__toggle-desc">
              Terminal'de metin secildiginde otomatik olarak panoya kopyalar
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

function AboutSection() {
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
        DataShell
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>v1.0.0</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Portable SSH istemcisi
        <br />
        Electron + React + TypeScript
      </div>
      <div style={{ marginTop: 24, fontSize: 11, color: 'var(--text-muted)' }}>
        github.com/hakkibc/datashell
      </div>
    </div>
  );
}
