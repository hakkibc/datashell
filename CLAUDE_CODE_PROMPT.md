# CLAUDE CODE PROMPT — Electron SSH Client (NexTerm)

## Proje Özeti

**NexTerm** adlı, Xshell'e benzer, cross-platform (öncelik Windows) bir masaüstü SSH istemcisi.
Stack: **Electron + React + Vite + TypeScript**

---

## Oturum 1 — Proje İskeleti ve Temel Yapı

### Prompt:

```
Bir Electron + React + Vite + TypeScript projesi oluştur. Proje adı "nexterm".

Klasör yapısı şu şekilde olsun:

nexterm/
├── electron/
│   ├── main.ts              # Electron main process
│   ├── preload.ts           # Context bridge / IPC API
│   └── ipc/
│       ├── ssh.ts           # SSH bağlantı yöneticisi (ipc handlers)
│       ├── sftp.ts          # SFTP işlemleri (ipc handlers)
│       └── sessions.ts      # Session CRUD (electron-store)
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── store/               # Zustand store
│   │   ├── useSessionStore.ts
│   │   ├── useTabStore.ts
│   │   └── useTransferStore.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TabBar.tsx
│   │   │   └── StatusBar.tsx
│   │   ├── terminal/
│   │   │   ├── TerminalTab.tsx
│   │   │   └── TerminalPane.tsx
│   │   ├── sftp/
│   │   │   ├── SftpPanel.tsx
│   │   │   ├── FileTree.tsx
│   │   │   └── TransferQueue.tsx
│   │   ├── sessions/
│   │   │   ├── SessionManager.tsx
│   │   │   ├── SessionForm.tsx
│   │   │   └── SessionGroup.tsx
│   │   └── tunnel/
│   │       ├── TunnelManager.tsx
│   │       └── TunnelForm.tsx
│   └── styles/
│       └── global.css
├── package.json
├── vite.config.ts
├── electron-builder.yml
└── tsconfig.json

Gerekli npm paketleri:

dependencies:
  - electron-store          # Session kalıcılığı
  - ssh2                    # SSH + SFTP protokolü
  - putty-key-parser        # .ppk dosyası desteği (veya alternatif: ssh2-streams)
  - node-forge              # PEM key işleme

devDependencies:
  - electron
  - electron-builder
  - vite-plugin-electron
  - react, react-dom
  - @types/react, @types/node
  - typescript
  - zustand                 # State management
  - @xterm/xterm            # Terminal emülatörü
  - @xterm/addon-fit        # Xterm fit addon
  - @xterm/addon-web-links  # Xterm link addon
  - lucide-react            # İkonlar

electron/main.ts içinde:
- BrowserWindow oluştur (frame: false, titleBarStyle: "hidden" Windows için)
- IPC handler dosyalarını import et
- Dev modda Vite dev server'a yükle, prod'da dist/index.html'e

electron/preload.ts içinde context bridge ile şu kanalları expose et:
- window.electronAPI.ssh.*
- window.electronAPI.sftp.*
- window.electronAPI.sessions.*
- window.electronAPI.tunnel.*

Bağımlılıkları yükle, projeyi başlat, npm run dev çalışır hale getir.
```

---

## Oturum 2 — Session Manager ve Veri Modeli

### Prompt:

```
Session veri modelini ve electron-store tabanlı kalıcılık katmanını implement et.

Session tipi (TypeScript):

interface AuthConfig {
  method: 'password' | 'privateKey' | 'agent';
  username: string;
  password?: string;
  privateKeyPath?: string;    // .pem veya .ppk dosya yolu
  privateKeyPassphrase?: string;
  useAgent?: boolean;
}

interface JumpHost {
  host: string;
  port: number;
  auth: AuthConfig;
}

interface TunnelConfig {
  type: 'local' | 'remote' | 'dynamic';
  localPort: number;
  remoteHost?: string;
  remotePort?: number;
  description?: string;
}

interface Session {
  id: string;               // uuid
  name: string;
  groupId?: string;
  host: string;
  port: number;             // default 22
  auth: AuthConfig;
  jumpHost?: JumpHost;
  tunnels?: TunnelConfig[];
  tags?: string[];
  lastConnected?: number;   // timestamp
  color?: string;           // tab rengi
  createdAt: number;
}

interface SessionGroup {
  id: string;
  name: string;
  parentId?: string;        // iç içe gruplar
  expanded?: boolean;
}

electron/ipc/sessions.ts içinde şu IPC handler'ları implement et:
- sessions:getAll         → { sessions: Session[], groups: SessionGroup[] }
- sessions:create         → Session
- sessions:update         → Session
- sessions:delete         → void
- sessions:createGroup    → SessionGroup
- sessions:deleteGroup    → void
- sessions:search         → Session[]  (name, host, tag arama)

src/components/sessions/SessionManager.tsx:
- Sol sidebar'da Xshell Session Manager gibi ağaç yapısı
- Grup altında session'lar, sürükle-bırak (opsiyonel)
- Üstte arama kutusu
- Session üzerine double-click → bağlan
- Sağ tık context menu: Connect, Edit, Duplicate, Delete, Move to Group
- Yeni session butonu → SessionForm aç

src/components/sessions/SessionForm.tsx:
- Tabs: General | Authentication | Jump Host | Tunnels | Appearance
- General: name, host, port, group seçimi
- Authentication: method radio (Password / Private Key / SSH Agent)
  - Password seçilince: username + password alanları
  - Private Key seçilince: username + dosya seçici (.pem, .ppk) + passphrase
  - Agent seçilince: username + bilgi notu
- Jump Host: enable checkbox + ayrı host/port/auth formu
- Tunnels: tablo + add tunnel butonu (TunnelForm modal)
- Appearance: tab rengi seçici, not alanı
```

---

## Oturum 3 — SSH Bağlantı Motoru (Main Process)

### Prompt:

```
electron/ipc/ssh.ts içinde tam SSH bağlantı motorunu implement et.

Gereksinimler:

1. BAĞLANTI HAVUZU
   - Map<connectionId, SSHConnection> tut
   - Her bağlantı şunları içerir: { client, shell, connectionId, sessionId }

2. PPK DÖNÜŞÜMÜ
   - .ppk dosyasını okuyup ssh2'nin anlayacağı privateKey formatına çevir
   - putty-key-parser veya manuel parse kullan
   - Passphrase korumalı key'leri destekle

3. JUMP HOST (BASTION)
   - Session'da jumpHost varsa:
     a) Önce jump host'a bağlan
     b) client.forwardOut() ile hedef host'a tünel aç
     c) Oluşan stream üzerinden 2. SSH client bağla
   - Her iki client'ı da bağlantı havuzunda sakla

4. IPC HANDLER'LAR

ssh:connect (sessionId) → connectionId
  - Session'ı electron-store'dan oku
  - Auth yöntemine göre ssh2 Client config oluştur
  - Jump host varsa tünel üzerinden bağlan
  - Bağlantı hatalarını anlamlı mesajlarla fırlat
  - Başarıda connectionId döndür

ssh:shell (connectionId) → void
  - client.shell() ile pty aç
  - cols/rows parametresi al
  - 'data' event'ini → ssh:data:{connectionId} IPC event'ine yönlendir
  - Renderer'dan gelen girişi ssh:input:{connectionId} ile al

ssh:resize (connectionId, cols, rows) → void
  - Mevcut shell'e resize gönder

ssh:disconnect (connectionId) → void
  - Shell ve client kapat, havuzdan sil

ssh:keepalive
  - 30 saniyelik interval ile tüm aktif bağlantılara keepalive gönder

5. HATA YÖNETİMİ
   - Bağlantı koparsa → ssh:disconnected:{connectionId} event'i fırlat
   - Auth hatası / host not found / timeout → anlamlı hata mesajı
   - Host key değişmişse → kullanıcıya sor (ssh:hostkey-changed event)

6. KNOWN HOSTS
   - electron-store'da known_hosts listesi tut
   - İlk bağlantıda: "Bu host'u güven listesine eklemek istiyor musun?" diyaloğu
   - Değişen key'de uyarı ver
```

---

## Oturum 4 — Terminal UI (xterm.js Entegrasyonu)

### Prompt:

```
src/components/terminal/TerminalPane.tsx implementasyonu:

1. XTERM KURULUM
   - @xterm/xterm Terminal instance oluştur
   - FitAddon, WebLinksAddon yükle
   - Koyu tema: VS Code Dark+ renk paletine benzer
     background: #1e1e1e, foreground: #d4d4d4
     cursor: #aeafad, selection: #264f78
   - font: 'Cascadia Code', 'Consolas', monospace; fontSize: 14
   - scrollback: 10000 satır

2. IPC KÖPRÜSÜ
   - window.electronAPI.ssh.onData(connectionId, (data) => terminal.write(data))
   - terminal.onData((input) => window.electronAPI.ssh.sendInput(connectionId, input))
   - ResizeObserver → fitAddon.fit() → ssh:resize IPC çağrısı

3. BAĞLANTI DÖNGÜSÜ
   useEffect:
     connectionId = await window.electronAPI.ssh.connect(sessionId)
     await window.electronAPI.ssh.openShell(connectionId, { cols, rows })
     onData listener kur
     disconnected listener kur (tab'ı "disconnected" state'e al)
   cleanup:
     listener'ları kaldır
     ssh:disconnect çağır

4. TAB STATE'LERİ
   - connecting: spinner + "Bağlanıyor..." overlay
   - connected: xterm görünür
   - disconnected: kırmızı banner + "Yeniden Bağlan" butonu
   - error: hata mesajı overlay

5. SAĞ KLİK CONTEXT MENU
   - Copy (seçili metin)
   - Paste
   - Clear scrollback
   - ─────────────
   - Open SFTP Panel
   - Port Forwarding...
   - ─────────────
   - Disconnect

src/components/layout/TabBar.tsx:
   - Her tab: renk göstergesi (sol kenar), ikon (SSH/SFTP), session adı, host, X butonu
   - Yeni tab butonu (+)
   - Tab'lar arasında Ctrl+Tab / Ctrl+Shift+Tab geçiş
   - Tab sağ tık: Rename, Duplicate Session, Close Others, Close All
   - Drag & drop tab sıralaması
```

---

## Oturum 5 — SFTP Dosya Yöneticisi

### Prompt:

```
electron/ipc/sftp.ts ve SFTP UI bileşenlerini implement et.

BACKEND (electron/ipc/sftp.ts):

Var olan connectionId üzerinden SFTP subsystem aç:
  client.sftp((err, sftp) => ...)

IPC HANDLER'LAR:
  sftp:open (connectionId) → sftpSessionId
  sftp:readdir (sftpSessionId, remotePath) → FileEntry[]
  sftp:stat (sftpSessionId, remotePath) → FileStats
  sftp:mkdir (sftpSessionId, remotePath) → void
  sftp:rename (sftpSessionId, oldPath, newPath) → void
  sftp:delete (sftpSessionId, remotePath, recursive?) → void
  sftp:chmod (sftpSessionId, remotePath, mode) → void

  sftp:upload (sftpSessionId, localPath, remotePath) → transferId
    - Progress: sftp:progress:{transferId} event (bytes, total, percentage)
    - Cancel: sftp:cancel:{transferId}
  
  sftp:download (sftpSessionId, remotePath, localPath) → transferId
    - Aynı progress/cancel mekanizması

FileEntry:
  { name, longname, attrs: { size, mode, mtime, atime, uid, gid } }
  isDirectory(), isSymlink() helper'ları

FRONTEND (src/components/sftp/):

SftpPanel.tsx — Split pane layout:
  ─────────────────────────────────────────
  [Local]  C:\Users\hakki\Desktop    [Remote]  /home/hakki
  ─────────────────────────────────────────
  📁 ..             📁 ..
  📁 Documents      📁 projects
  📄 file.txt       📄 server.log
  ─────────────────────────────────────────
  [Transfer Queue] ████████░░ 75%  file.tar.gz  ↑ 1.2 MB/s

  - Sol: yerel dosya sistemi (fs.readdir ile)
  - Sağ: uzak dosya sistemi (SFTP)
  - Üst: adres bar (elle yazılabilir), geri/ileri/yukarı butonları, yenile
  - F5: yenile, F6: taşı, F8: sil, Delete: sil, F2: yeniden adlandır
  - Sürükle-bırak: local→remote upload, remote→local download
  - Çift tık klasör: gir, çift tık dosya: indir (ve aç)

FileTree.tsx:
  - Sıralama: klasörler önce, sonra dosyalar (alfabetik)
  - Kolon başlıkları: Ad | Boyut | Değiştirilme | İzinler
  - Sağ tık: Download/Upload, Rename, Delete, Properties (chmod)
  - Çoklu seçim (Shift+Click, Ctrl+Click)
  - Gizli dosyalar: Ctrl+H toggle

TransferQueue.tsx:
  - Alt panel (toggle edililebilir)
  - Her transfer: dosya adı, yön (↑/↓), progress bar, hız, kalan süre
  - Duraklatma ve iptal butonları
  - Tamamlanan transferler listesi (kısa süre sonra solar)
```

---

## Oturum 6 — Port Forwarding / Tunneling

### Prompt:

```
electron/ipc/ssh.ts içine port forwarding handler'larını ekle.

TUNNEL TİPLERİ:

1. LOCAL FORWARD (ssh -L)
   - localPort → remoteHost:remotePort (SSH sunucu üzerinden)
   - client.forwardIn() DEĞİL, net.createServer + client.forwardOut()

2. REMOTE FORWARD (ssh -R)
   - Sunucu üzerindeki port → local host:port'a yönlendirilir
   - client.forwardIn(remoteHost, remotePort, callback)
   - Gelen bağlantılar accept edilir

3. DYNAMIC (SOCKS5 Proxy, ssh -D)
   - localPort'ta SOCKS5 sunucu aç (socks5-server veya manuel)
   - Her CONNECT isteği için client.forwardOut()

IPC HANDLER'LAR:
  tunnel:start (connectionId, tunnelConfig) → tunnelId
  tunnel:stop (tunnelId) → void
  tunnel:list () → ActiveTunnel[]
  tunnel:listForConnection (connectionId) → ActiveTunnel[]

ActiveTunnel:
  { tunnelId, connectionId, type, localPort, remoteHost, remotePort,
    status: 'active' | 'error', connectedClients: number, bytesIn, bytesOut }

FRONTEND (src/components/tunnel/TunnelManager.tsx):
  - Modal veya yan panel olarak açılır
  - Aktif tunnel'ların tablosu: Tip | Local Port | Remote | Status | Connections | Trafik
  - Yeni tunnel ekle butonu → TunnelForm modal
  - Her tunnel'a durdur butonu (kırmızı)
  - Session'a bağlı tunnel'lar session kapanınca otomatik durur

TunnelForm.tsx:
  - Type: Local / Remote / Dynamic (SOCKS5)
  - Local port alanı
  - Remote host + port (Dynamic seçilince gizlenir)
  - Açıklama alanı
  - "Bu session'a kaydet" checkbox (Session.tunnels[] günceller)
```

---

## Oturum 7 — UI Tasarımı ve Global Layout

### Prompt:

```
Uygulamanın genel UI layout'unu ve görsel tasarımını implement et.

RENK PALETİ (Dark Theme — varsayılan):
  --bg-primary:    #0d1117    (ana arkaplan)
  --bg-secondary:  #161b22    (sidebar, paneller)
  --bg-tertiary:   #21262d    (hover, seçili)
  --bg-elevated:   #2d333b    (modal, dialog)
  --border:        #30363d
  --text-primary:  #e6edf3
  --text-secondary:#8b949e
  --text-muted:    #6e7681
  --accent:        #388bfd    (mavi vurgu — aktif tab, seçim)
  --accent-hover:  #58a6ff
  --success:       #3fb950
  --warning:       #d29922
  --danger:        #f85149
  --tab-colors: ['#388bfd','#3fb950','#d29922','#f85149','#bc8cff','#39d353']

TİPOGRAFİ:
  UI: 'Inter var', 'Segoe UI', sans-serif; 13px
  Terminal: 'Cascadia Code', 'Consolas', monospace; 14px

LAYOUT:
  ┌──────────────────────────────────────────────┐
  │  Custom Title Bar  [_][□][X]    NexTerm      │  32px, draggable (-webkit-app-region: drag)
  ├────────┬─────────────────────────────────────┤
  │        │  [Tab1 ●] [Tab2] [Tab3] [+]         │  TabBar — 38px
  │Sidebar ├─────────────────────────────────────┤
  │        │                                     │
  │Session │   Terminal / SFTP / Tunnel Panel     │  flex-grow
  │Manager │                                     │
  │        │                                     │
  ├────────┴─────────────────────────────────────┤
  │  StatusBar: host | user | port | latency | 🔒│  24px
  └──────────────────────────────────────────────┘

SIDEBAR (240px, collapse edililebilir):
  - Üst: NexTerm logo + versiyon
  - Session ağacı (accordion gruplar)
  - Alt: Ayarlar ⚙, Temalar 🎨, GitHub

TITLE BAR (electron frame:false):
  - Sol: uygulama ikonu + menü (File | Sessions | View | Tools | Help)
  - Orta: aktif bağlantı bilgisi
  - Sağ: native window controls (custom, Windows-style)
  - -webkit-app-region: drag (butonlar hariç: no-drag)

ANIMASYONLAR:
  - Tab geçişi: 150ms fade
  - Sidebar collapse: 200ms ease slide
  - Modal açılış: 200ms scale(0.95→1) + fade
  - Bağlantı durumu LED: pulse animation (connected=yeşil, connecting=sarı)

KEYBOARD SHORTCUTS:
  Ctrl+T          → Yeni tab (Session Manager aç)
  Ctrl+W          → Aktif tab'ı kapat
  Ctrl+Tab        → Sonraki tab
  Ctrl+Shift+Tab  → Önceki tab
  Ctrl+1..9       → Tab seç
  Ctrl+Shift+F    → Global arama (session adı/host)
  F1              → SFTP panel toggle
  F2              → Tunnel Manager
  Ctrl+,          → Ayarlar

Light Theme için CSS variables alternatif seti de hazırla (class="theme-light" body'de).
Tema toggle: Ayarlar panelinde veya StatusBar'da.
```

---

## Oturum 8 — Ayarlar, Build ve Paketleme

### Prompt:

```
Ayarlar paneli ve Electron Builder konfigürasyonu ekle.

AYARLAR PANELİ (src/components/settings/):
  - Modal veya tam sayfa (Ctrl+, ile açılır)
  - Kategoriler: Appearance | Terminal | SSH | SFTP | Keyboard | About

  Appearance:
    - Tema: Dark / Light / System
    - Accent rengi seçici
    - Sidebar genişliği ayarı
    - Compakt mod

  Terminal:
    - Font family (yazılabilir, preview)
    - Font size (10–24)
    - Cursor style: block / bar / underline
    - Cursor blink: on/off
    - Scrollback buffer (1000–100000)
    - Bell: visual / audio / none
    - Copy on select: on/off

  SSH:
    - Default port (22)
    - Connection timeout (sn)
    - Keepalive interval (sn)
    - Host key policy: strict / warn / auto-accept
    - SSH agent socket path (Windows: pageant / OpenSSH)
    - Known hosts dosya konumu

  SFTP:
    - Varsayılan download klasörü
    - Upload conflict action: overwrite / rename / skip / ask
    - Transfer chunk size
    - Max concurrent transfers (1–10)

  Tüm ayarlar electron-store'a kayıt edilsin.
  Değişiklikler anlık yansısın (terminal ayarları açık terminal'lere de).

ELECTRON BUILDER (electron-builder.yml):

appId: com.nexterm.app
productName: NexTerm
directories:
  output: dist-electron
files:
  - dist/**
  - dist-electron/**
win:
  target:
    - target: nsis          # Installer
    - target: portable      # Tek exe
  icon: assets/icon.ico
  artifactName: NexTerm-Setup-${version}.${ext}
nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  installerLanguages: tr, en
mac:
  target: dmg
  icon: assets/icon.icns
linux:
  target: AppImage

BUILD SCRIPTS (package.json):
  "dev": "vite-plugin-electron dev modunda çalıştır"
  "build": "tsc + vite build + electron-builder"
  "build:win": "electron-builder --win"
  "preview": "electron dist/index.html"

README.md yaz:
  - Geliştirme ortamı kurulum (npm install, npm run dev)
  - Build adımları
  - Kısa özellik listesi
  - Kullanılan teknolojiler
```

---

## Mimari Özet

```
┌─────────────────────────────────────────────────┐
│                RENDERER PROCESS                 │
│  React + Vite + Zustand + xterm.js             │
│  - SessionManager (electron-store read/write)   │
│  - TabBar / TerminalPane (xterm.js)             │
│  - SftpPanel (dual pane)                        │
│  - TunnelManager                                │
└────────────────┬────────────────────────────────┘
                 │ contextBridge (IPC)
                 │ window.electronAPI.*
┌────────────────▼────────────────────────────────┐
│                MAIN PROCESS                     │
│  Electron + Node.js                             │
│  ├── ipc/sessions.ts  (electron-store)          │
│  ├── ipc/ssh.ts       (ssh2 client pool)        │
│  ├── ipc/sftp.ts      (ssh2 sftp + transfers)   │
│  └── ipc/tunnels.ts   (net.Server + forwardOut) │
└────────────────┬────────────────────────────────┘
                 │ TCP / SSH Protocol
┌────────────────▼────────────────────────────────┐
│           REMOTE SERVERS (Linux/CentOS)         │
│  - SSH daemon (sshd)                            │
│  - SFTP subsystem                               │
│  - Jump host (optional)                         │
└─────────────────────────────────────────────────┘
```

## Kritik Notlar

### PPK (PuTTY Key) Desteği
```typescript
// putty-key-parser ile .ppk → OpenSSH dönüşümü
import { parsePPKFile } from 'putty-key-parser';

async function resolvePrivateKey(keyPath: string, passphrase?: string) {
  const content = fs.readFileSync(keyPath, 'utf8');
  if (content.startsWith('PuTTY-User-Key-File')) {
    const parsed = parsePPKFile(content, passphrase);
    return parsed.privateKey; // OpenSSH PEM formatı
  }
  return content; // Zaten PEM
}
```

### Jump Host Bağlantısı
```typescript
// Jump host üzerinden tünel açma
async function connectViaJump(session: Session): Promise<ssh2.Client> {
  const jump = new ssh2.Client();
  await connectClient(jump, session.jumpHost);

  return new Promise((resolve, reject) => {
    jump.forwardOut('127.0.0.1', 0, session.host, session.port, (err, stream) => {
      if (err) return reject(err);
      const target = new ssh2.Client();
      target.connect({ sock: stream, ...buildAuthConfig(session.auth) });
      target.on('ready', () => resolve(target));
      target.on('error', reject);
    });
  });
}
```

### SSH Agent (Windows — OpenSSH)
```typescript
// Windows'ta OpenSSH agent socket
const agentSocket = process.env.SSH_AUTH_SOCK || '\\\\.\\pipe\\openssh-ssh-agent';
// Pageant (PuTTY) için: pageant npm paketi kullanılabilir
```

### Güvenlik
- Şifreler ve passphrase'ler RAM'de tutulur, diske yazılmaz
- Private key yolları saklanır, içerik değil
- electron-store şifrelemesi: `safeStorage` API (Electron 15+)
- Known hosts doğrulaması: `hostVerifier` callback

---

## Oturum 9 — Portable Build ve Zip Dağıtımı

### Hedef
`npm run dist:portable` komutu çalıştırıldığında:
1. Proje derlenir
2. `NexTerm-portable-win-x64/` klasörü oluşur — kurulum gerektirmez, sadece çalıştır
3. `NexTerm-portable-win-x64.zip` dosyası hazırlanır — başka PC'ye taşı, unzip et, `.exe`'ye çift tık

### Prompt:

```
Projeyi portable olarak build edip zip paketleyen tam bir dağıtım sistemi kur.

─────────────────────────────────────
1. ELECTRON-BUILDER KONFİGÜRASYONU
─────────────────────────────────────

electron-builder.yml dosyasını aşağıdaki gibi düzenle:

appId: com.nexterm.app
productName: NexTerm
copyright: "NexTerm"

directories:
  output: release
  buildResources: assets

files:
  - dist/**           # Vite renderer build çıktısı
  - dist-electron/**  # Electron main/preload build çıktısı
  - node_modules/**
  - package.json

# Native modülleri (ssh2) rebuild et
npmRebuild: true
buildDependenciesFromSource: false

win:
  icon: assets/icon.ico    # 256x256 ICO dosyası (aşağıda oluşturulacak)
  target:
    # ── Portable: kurulum yok, tek klasör ──
    - target: dir            # release/win-unpacked/ → sıkıştırılmamış klasör
    - target: portable       # release/NexTerm-portable.exe → tek exe (self-extracting)
    # ── Opsiyonel installer ──
    - target: nsis           # release/NexTerm-Setup-x.x.x.exe → kurulumlu versiyon

  artifactName: "NexTerm-${version}-${arch}.${ext}"
  requestedExecutionLevel: asInvoker  # UAC popup olmadan çalışır

nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true

# Portable exe konfigürasyonu
portable:
  artifactName: "NexTerm-portable-${version}.exe"

─────────────────────────────────────
2. PACKAGE.JSON SCRIPTS
─────────────────────────────────────

package.json scripts bölümünü güncelle:

{
  "scripts": {
    "dev":            "electron-vite dev",
    "build":          "electron-vite build",
    "build:electron": "tsc -p tsconfig.electron.json",

    // Sadece renderer + main derle (build et ama paketleme):
    "compile":        "npm run build",

    // Windows — Klasör çıktısı (unzip'e gerek yok, doğrudan çalışır):
    "dist:dir":       "npm run build && electron-builder --win dir",

    // Windows — Portable tek EXE (taşınabilir, kurulum yok):
    "dist:portable":  "npm run build && electron-builder --win portable",

    // Windows — NSIS Installer (kurulumlu):
    "dist:installer": "npm run build && electron-builder --win nsis",

    // Hepsini birden üret:
    "dist:all":       "npm run build && electron-builder --win dir portable nsis",

    // ZIP oluştur (dist:dir çıktısını zip'le):
    "dist:zip":       "npm run dist:dir && node scripts/make-zip.js"
  }
}

─────────────────────────────────────
3. ZIP PAKETLEME SCRİPTİ
─────────────────────────────────────

scripts/make-zip.js dosyasını oluştur:

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Çıktı klasörü: release/win-unpacked (electron-builder --win dir sonucu)
const srcDir  = path.join(__dirname, '..', 'release', 'win-unpacked');
const pkg     = require('../package.json');
const version = pkg.version;
const outZip  = path.join(__dirname, '..', 'release', `NexTerm-portable-win-x64-v${version}.zip`);

if (!fs.existsSync(srcDir)) {
  console.error('Önce "npm run dist:dir" çalıştır!');
  process.exit(1);
}

console.log(`📦 Zip oluşturuluyor: ${outZip}`);

// Windows'ta PowerShell Compress-Archive kullan (7-zip gerekmez)
const cmd = `powershell -Command "Compress-Archive -Path '${srcDir}\\*' -DestinationPath '${outZip}' -Force"`;
execSync(cmd, { stdio: 'inherit' });

console.log(`✅ Hazır: ${outZip}`);
console.log(`   → Başka PC'ye kopyala, unzip et, NexTerm.exe'yi çalıştır.`);

─────────────────────────────────────
4. ICON OLUŞTURMA
─────────────────────────────────────

assets/ klasöründe icon yoksa placeholder oluştur:

scripts/generate-icon.js:
- sharp veya jimp ile 256x256 PNG → ICO dönüşümü yap
- Basit bir terminal sembolü (>_) render et
- assets/icon.ico olarak kaydet

Alternatif (daha hızlı): png-to-ico paketi kullan:
  npx png-to-ico assets/icon.png > assets/icon.ico

─────────────────────────────────────
5. NATIVE MODÜL SORUNU (ssh2)
─────────────────────────────────────

ssh2 paketi native C++ addon içerir (cpu-features, sshcrypto).
Windows'ta build için Visual C++ Build Tools gerekir.

electron-rebuild adımını ekle:

package.json postinstall hook:
  "postinstall": "electron-rebuild -f -w ssh2"

Eğer CI/CD ortamında build alınacaksa:
  - Windows: "npm install --ignore-scripts" + manuel rebuild
  - VEYA: ssh2'nin pure-js fallback modunu zorla:
    process.env.NODE_SSH2_NO_NATIVE = '1';  (main.ts başında)
    Bu sayede Build Tools olmadan da çalışır, performans farkı minimumdur.

─────────────────────────────────────
6. BUILD SONRASI DOSYA YAPISI
─────────────────────────────────────

Başarılı build sonrası release/ klasörü:

release/
├── win-unpacked/                        ← BU KLASÖRÜ ZIP'LE
│   ├── NexTerm.exe                      ← Ana uygulama
│   ├── resources/
│   │   └── app.asar                     ← Tüm uygulama kodu (şifreli)
│   ├── locales/
│   ├── d3dcompiler_47.dll
│   └── ... (Chromium/Node runtime'ı)
│
├── NexTerm-portable-win-x64-v1.0.0.zip ← Taşınabilir paket (bu dosyayı gönder)
├── NexTerm-portable-1.0.0.exe          ← Self-extracting portable
└── NexTerm-Setup-1.0.0.exe             ← NSIS installer

─────────────────────────────────────
7. ÇALIŞMA TALIMATINI README'YE EKLE
─────────────────────────────────────

README.md'e şu bölümü ekle:

## Portable Kullanım (Kurulum Gerektirmez)

1. `NexTerm-portable-win-x64-vX.X.X.zip` dosyasını indir
2. İstediğin klasöre unzip et  
3. `NexTerm.exe`'ye çift tıkla — kurulum yok, registry yazılmaz
4. Ayarlar ve session'lar `%APPDATA%\nexterm\` altında saklanır
   (Taşırken bu klasörü de kopyalarsan tüm session'ların gelir)

## Geliştirici Build

Gereksinimler:
  - Node.js 18+
  - Windows Build Tools (native modüller için):
    npm install -g windows-build-tools
    VEYA: Visual Studio 2022 "C++ build tools" workload

Adımlar:
  git clone https://github.com/sen/nexterm
  cd nexterm
  npm install
  npm run dev          # Geliştirme modu

  npm run dist:zip     # → release/NexTerm-portable-win-x64-vX.X.X.zip
  npm run dist:all     # → dir + portable.exe + installer hepsini üretir
```

---

## Oturum Başlatma Talimatı

Her Claude Code oturumunda şunu söyle:

> "Bu proje NexTerm — Electron + React tabanlı SSH istemcisi.
> Önce CLAUDE_CODE_PROMPT.md dosyasını oku, ardından [Oturum X] üzerinde çalış.
> Kod yazarken TypeScript strict mode kullan.
> Her IPC handler için hata yakalama ekle.
> Bileşenler functional component + hooks olsun."
