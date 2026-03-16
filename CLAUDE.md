# DataShell — Geliştirici Rehberi (Claude Agent İçin)

## Proje Nedir?
DataShell, **Xshell benzeri portable bir SSH istemcisidir**.
Stack: **Electron 28 + React 18 + Vite 5 + TypeScript (strict) + Zustand**

## Mevcut Durum (v1.0.0)

### Tamamlanan Oturumlar
- [x] **Oturum 1** — Proje iskeleti, klasör yapısı, tüm bağımlılıklar, dev/build çalışır durumda
- [x] **Oturum 2** — Session veri modeli, electron-store CRUD, SessionManager/SessionForm UI
- [x] **Oturum 3** — SSH bağlantı motoru (ssh2), bağlantı havuzu, PPK desteği, Jump Host, keepalive
- [x] **Oturum 4** — Terminal UI (xterm.js), FitAddon, tab state'leri, TabBar klavye kısayolları
- [x] **Oturum 5** — SFTP dosya yöneticisi (dual-pane), FileTree, TransferQueue
- [x] **Oturum 6** — Port forwarding / tunneling (local, remote, dynamic SOCKS5) — backend + UI
- [x] **Oturum 7** — UI tasarımı, dark/light theme CSS variables, layout, animasyonlar
- [x] **Oturum 9** — Portable build sistemi, zip dağıtımı

### Henüz Yapılmamış
- [ ] **Oturum 8** — Ayarlar paneli (Appearance, Terminal, SSH, SFTP, Keyboard, About)
- [ ] Sağ tık context menu (şu an prompt/confirm ile geçici çözüm var)
- [ ] Sürükle-bırak (tab sıralaması, SFTP dosya transferi)
- [ ] Yerel dosya sistemi listeleme (SFTP sol panel — şu an sadece remote çalışıyor)
- [ ] SFTP'de dosya düzenleme (remote dosyayı indir, düzenle, geri yükle)
- [ ] Uygulama ikonu (şu an Electron varsayılan ikonu kullanılıyor)

---

## Mimari

```
Renderer (React + Vite)          Main Process (Electron + Node.js)
─────────────────────────         ─────────────────────────────────
App.tsx                           electron/main.ts
├── Sidebar.tsx                   electron/preload.ts (contextBridge)
│   └── SessionManager.tsx        electron/ipc/
│       └── SessionForm.tsx         ├── sessions.ts  (electron-store)
├── TabBar.tsx                      ├── ssh.ts       (ssh2 client pool)
├── TerminalTab.tsx                 └── sftp.ts      (ssh2 sftp)
│   └── TerminalPane.tsx
├── SftpPanel.tsx
│   ├── FileTree.tsx
│   └── TransferQueue.tsx
├── TunnelManager.tsx
│   └── TunnelForm.tsx
└── StatusBar.tsx

State: Zustand
├── useSessionStore.ts    (session CRUD + gruplar)
├── useTabStore.ts        (tab yönetimi)
└── useTransferStore.ts   (dosya transfer kuyruğu)
```

## Önemli Tasarım Kararları

### Portable Mod
- `electron-store` verileri `%APPDATA%` yerine **exe'nin yanındaki `data/` klasörüne** yazılır
- `app.setPath('userData', ...)` ile `electron/main.ts` içinde ayarlanır
- Tüm store'lar `cwd: app.getPath('userData')` parametresi kullanır
- Admin yetkisi gerekmez (`requestedExecutionLevel: asInvoker`)
- Code signing devre dışı (`signAndEditExecutable: false`)

### IPC Kanalları
Renderer ↔ Main iletişimi `window.electronAPI` üzerinden:
- `sessions:*` — CRUD + arama
- `ssh:connect`, `ssh:shell`, `ssh:input`, `ssh:resize`, `ssh:disconnect`
- `ssh:data:{connectionId}` — terminal verisi (main → renderer)
- `ssh:disconnected:{connectionId}` — bağlantı kopması
- `sftp:*` — dosya işlemleri + upload/download + progress
- `tunnel:*` — port forwarding yönetimi
- `window:*` — minimize/maximize/close (custom titlebar)

### Tip Tanımları
- Backend tipleri: `electron/ipc/sessions.ts` içinde tanımlı ve export ediliyor
- Frontend tipleri: `src/types/electron.d.ts` — `window.electronAPI` arayüzü dahil

## Komutlar

```bash
npm run dev          # Geliştirme (Vite + Electron hot reload)
npm run build        # TypeScript + Vite derle
npm run dist         # Build + electron-builder (dir) + zip oluştur
```

Build çıktıları:
- `release/win-unpacked/DataShell.exe` — doğrudan çalıştırılabilir
- `release/DataShell-portable-win-x64-v1.0.0.zip` — taşınabilir paket

## Kodlama Kuralları
- TypeScript strict mode
- Functional component + hooks (class component yok)
- Her IPC handler'da try/catch hata yakalama
- Şifreler RAM'de tutulur, diske sadece key dosya yolları yazılır
- Bileşen isimleri PascalCase, dosya isimleri de PascalCase
- Store'lar `use*Store` convention'ı ile isimlendirilir

## Detaylı Prompt Dökümanı
Tüm oturum prompt'ları ve detaylı gereksinimler için: `CLAUDE_CODE_PROMPT.md`

## GitHub
Repo: https://github.com/hakkibc/datashell
