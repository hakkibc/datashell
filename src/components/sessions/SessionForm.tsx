import { useState } from 'react';
import { useSessionStore } from '../../store/useSessionStore';
import { X } from 'lucide-react';
import type { Session, AuthConfig } from '../../types/electron';

interface Props {
  session?: Session | null;
  onClose: () => void;
}

const TAB_COLORS = ['#388bfd', '#3fb950', '#d29922', '#f85149', '#bc8cff', '#39d353'];

type FormTab = 'general' | 'auth' | 'jumphost' | 'tunnels' | 'appearance';

export function SessionForm({ session, onClose }: Props) {
  const { createSession, updateSession, groups } = useSessionStore();
  const isEdit = !!session;

  const [activeFormTab, setActiveFormTab] = useState<FormTab>('general');
  const [name, setName] = useState(session?.name || '');
  const [host, setHost] = useState(session?.host || '');
  const [port, setPort] = useState(session?.port || 22);
  const [groupId, setGroupId] = useState(session?.groupId || '');
  const [color, setColor] = useState(session?.color || '');

  // Auth
  const [authMethod, setAuthMethod] = useState<AuthConfig['method']>(session?.auth.method || 'password');
  const [username, setUsername] = useState(session?.auth.username || '');
  const [password, setPassword] = useState(session?.auth.password || '');
  const [privateKeyPath, setPrivateKeyPath] = useState(session?.auth.privateKeyPath || '');
  const [passphrase, setPassphrase] = useState(session?.auth.privateKeyPassphrase || '');

  // Jump Host
  const [useJumpHost, setUseJumpHost] = useState(!!session?.jumpHost);
  const [jumpHost, setJumpHost] = useState(session?.jumpHost?.host || '');
  const [jumpPort, setJumpPort] = useState(session?.jumpHost?.port || 22);
  const [jumpUsername, setJumpUsername] = useState(session?.jumpHost?.auth.username || '');
  const [jumpPassword, setJumpPassword] = useState(session?.jumpHost?.auth.password || '');

  const handleSave = async () => {
    const auth: AuthConfig = {
      method: authMethod,
      username,
      ...(authMethod === 'password' && { password }),
      ...(authMethod === 'privateKey' && { privateKeyPath, privateKeyPassphrase: passphrase }),
      ...(authMethod === 'agent' && { useAgent: true }),
    };

    const data = {
      name: name || host,
      host,
      port,
      auth,
      groupId: groupId || undefined,
      color: color || undefined,
      ...(useJumpHost && {
        jumpHost: {
          host: jumpHost,
          port: jumpPort,
          auth: {
            method: 'password' as const,
            username: jumpUsername,
            password: jumpPassword,
          },
        },
      }),
    };

    if (isEdit && session) {
      await updateSession(session.id, data);
    } else {
      await createSession(data);
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div className="modal__title">{isEdit ? 'Session Düzenle' : 'Yeni Session'}</div>
          <button className="btn--icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="form-tabs">
          {(['general', 'auth', 'jumphost', 'tunnels', 'appearance'] as FormTab[]).map((t) => (
            <button
              key={t}
              className={`form-tab ${activeFormTab === t ? 'form-tab--active' : ''}`}
              onClick={() => setActiveFormTab(t)}
            >
              {t === 'general' && 'Genel'}
              {t === 'auth' && 'Kimlik Doğrulama'}
              {t === 'jumphost' && 'Jump Host'}
              {t === 'tunnels' && 'Tunnel\'lar'}
              {t === 'appearance' && 'Görünüm'}
            </button>
          ))}
        </div>

        {activeFormTab === 'general' && (
          <>
            <div className="form-group">
              <label className="form-label">Session Adı</label>
              <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Server" />
            </div>
            <div className="form-group">
              <label className="form-label">Host</label>
              <input className="form-input" value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.1.1" />
            </div>
            <div className="form-group">
              <label className="form-label">Port</label>
              <input className="form-input" type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">Grup</label>
              <select className="form-select" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">Grupsuz</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {activeFormTab === 'auth' && (
          <>
            <div className="form-group">
              <label className="form-label">Kimlik Doğrulama Yöntemi</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['password', 'privateKey', 'agent'] as const).map((m) => (
                  <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12 }}>
                    <input type="radio" checked={authMethod === m} onChange={() => setAuthMethod(m)} />
                    {m === 'password' && 'Şifre'}
                    {m === 'privateKey' && 'Private Key'}
                    {m === 'agent' && 'SSH Agent'}
                  </label>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Kullanıcı Adı</label>
              <input className="form-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="root" />
            </div>
            {authMethod === 'password' && (
              <div className="form-group">
                <label className="form-label">Şifre</label>
                <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            {authMethod === 'privateKey' && (
              <>
                <div className="form-group">
                  <label className="form-label">Private Key Dosyası (.pem, .ppk)</label>
                  <input className="form-input" value={privateKeyPath} onChange={(e) => setPrivateKeyPath(e.target.value)} placeholder="C:\Users\...\.ssh\id_rsa" />
                </div>
                <div className="form-group">
                  <label className="form-label">Passphrase (opsiyonel)</label>
                  <input className="form-input" type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
                </div>
              </>
            )}
            {authMethod === 'agent' && (
              <div style={{ padding: 8, background: 'var(--bg-primary)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                SSH Agent kullanılacak. Windows'ta OpenSSH Agent veya Pageant gereklidir.
              </div>
            )}
          </>
        )}

        {activeFormTab === 'jumphost' && (
          <>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={useJumpHost} onChange={(e) => setUseJumpHost(e.target.checked)} />
                Jump Host Kullan (Bastion)
              </label>
            </div>
            {useJumpHost && (
              <>
                <div className="form-group">
                  <label className="form-label">Jump Host</label>
                  <input className="form-input" value={jumpHost} onChange={(e) => setJumpHost(e.target.value)} placeholder="bastion.example.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Port</label>
                  <input className="form-input" type="number" value={jumpPort} onChange={(e) => setJumpPort(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Kullanıcı Adı</label>
                  <input className="form-input" value={jumpUsername} onChange={(e) => setJumpUsername(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Şifre</label>
                  <input className="form-input" type="password" value={jumpPassword} onChange={(e) => setJumpPassword(e.target.value)} />
                </div>
              </>
            )}
          </>
        )}

        {activeFormTab === 'tunnels' && (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            Tunnel yönetimi bağlantı kurulduktan sonra kullanılabilir.
          </div>
        )}

        {activeFormTab === 'appearance' && (
          <div className="form-group">
            <label className="form-label">Tab Rengi</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div
                style={{
                  width: 24, height: 24, borderRadius: 4, border: !color ? '2px solid var(--accent)' : '2px solid transparent',
                  background: 'var(--bg-tertiary)', cursor: 'pointer',
                }}
                onClick={() => setColor('')}
              />
              {TAB_COLORS.map((c) => (
                <div
                  key={c}
                  style={{
                    width: 24, height: 24, borderRadius: 4, background: c, cursor: 'pointer',
                    border: color === c ? '2px solid white' : '2px solid transparent',
                  }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="modal__footer">
          <button className="btn" onClick={onClose}>İptal</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={!host}>
            {isEdit ? 'Kaydet' : 'Oluştur'}
          </button>
        </div>
      </div>
    </div>
  );
}
