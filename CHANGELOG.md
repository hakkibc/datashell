# Changelog

Tüm önemli değişiklikler bu dosyada belgelenir.

---

## [1.4.0] — 2026-03-17

### Eklenenler
- **Tab sağ tık context menu** — Tab üzerinde sağ tıklayarak Kapat, Diğerlerini Kapat, Sağdakileri Kapat, Soldakileri Kapat, Yeniden Bağlan seçenekleri
- **Session picker dropdown** — TabBar'daki + butonundan mevcut session'lar arasından seçerek hızlıca yeni tab açma
- **SFTP kapatma butonu** — SFTP panelinin sağ üst köşesinde X butonu ile panel kapatma
- **SFTP otomatik bağlantı** — Sidebar'dan SFTP butonuna basıldığında aktif SSH yoksa önce SSH bağlantısı kurup ardından SFTP açma (`autoSftp` flag)
- **Scrollbar görünürlük iyileştirmesi** — Tab bar ve sidebar scrollbar'larının görünür ve tema uyumlu olması

### Düzeltilenler
- **Tab değiştirirken yarım shell prompt** — ResizeObserver'ın tab görünür olduğunda gereksiz `ssh.resize` göndermesi düzeltildi (`wasHidden` flag + `lastSentCols`/`lastSentRows` takibi)
- **+ butonu çalışmıyor** — TabBar'ın `overflow-x: auto` özelliğinin session picker'ı kırpması düzeltildi (picker `position: fixed` yapıldı, `getBoundingClientRect()` ile konum hesaplama)
- **Tab değiştirirken SSH yeniden bağlanma** — Display-based rendering'e geçilerek tab switch'te unmount/remount engellendi, SSH bağlantıları korundu
- **Tab'a dönüldüğünde boş terminal** — Tüm tab'lar DOM'da tutularak (`display: none/flex`) xterm buffer kaybı önlendi
- **Tab değişiminde clear-like davranış** — Single-tab rendering yerine display-based rendering ile çözüldü
- **Çoklu tab açma sorunu** — Birden fazla tab açıldığında state yönetimi düzeltildi

### Değişenler
- **Tab rendering mimarisi** — Tek aktif tab yerine tüm tab'lar eş zamanlı render edilip `display` ile gizleniyor (buffer ve bağlantı koruması için)
- **ResizeObserver akıllı resize** — 150ms debounce, `wasHidden` flag ile hidden→visible geçişlerinde gereksiz SSH resize engelleniyor
- **Session'lardan yeşil durum noktaları kaldırıldı** — Gereksiz bulunarak UI'dan çıkarıldı

---

## [1.3.0] — 2026-03

### Eklenenler
- **Port forwarding / Tunneling** — Local, Remote ve Dynamic (SOCKS5) tunnel desteği
- **Tunnel yönetim UI** — Sidebar'da Tunnels tab'ı, kayıtlı tunnel listesi, başlat/durdur/düzenle/sil
- **SavedTunnelForm** — Yeni tunnel oluşturma ve düzenleme formu
- **SavedTunnel store** — `useSavedTunnelStore` ile tunnel CRUD işlemleri
- **Tunnel IPC kanalları** — `tunnel:start`, `tunnel:stop`, `tunnel:list` backend desteği

---

## [1.2.0] — 2026-03

### Eklenenler
- **UI tasarımı** — Dark/light tema desteği, CSS variables sistemi
- **Tema seçenekleri** — Monokai, Solarized, Nord, Solarized Light, GitHub Light, Catppuccin Latte, Rosé Pine Dawn
- **Layout animasyonları** — Geçiş efektleri ve hover animasyonları
- **Custom titlebar** — Electron frameless window ile özel başlık çubuğu (minimize/maximize/close)
- **Sidebar resize** — Sürükle-bırak ile sidebar genişliği ayarlama

---

## [1.1.0] — 2026-03

### Eklenenler
- **SFTP dosya yöneticisi** — Dual-pane dosya gezgini
- **FileTree bileşeni** — Uzak dosya sistemi ağaç görünümü
- **TransferQueue** — Dosya transfer kuyruğu ve ilerleme takibi
- **SFTP IPC kanalları** — `sftp:open`, `sftp:readdir`, `sftp:upload`, `sftp:download`, `sftp:progress`

---

## [1.0.0] — 2026-03

### Eklenenler
- **Proje iskeleti** — Electron 28 + React 18 + Vite 5 + TypeScript (strict) + Zustand
- **Session yönetimi** — electron-store ile CRUD, gruplandırma, arama
- **SessionManager / SessionForm** — Session listesi ve oluşturma/düzenleme formu
- **SSH bağlantı motoru** — ssh2 kütüphanesi, bağlantı havuzu, PPK desteği, Jump Host, keepalive
- **Terminal UI** — xterm.js + FitAddon, tam terminal emülasyonu
- **Tab yönetimi** — TabBar, çoklu tab desteği, klavye kısayolları (Ctrl+T, Ctrl+W, Ctrl+Tab)
- **Zustand store'ları** — `useSessionStore`, `useTabStore`, `useTransferStore`
- **Portable mod** — exe yanında `data/` klasörüne veri yazma, admin yetkisi gerektirmez
- **Portable build** — `npm run dist` ile zip dağıtımı oluşturma
- **StatusBar** — Bağlantı durumu göstergesi
- **IPC altyapısı** — `sessions:*`, `ssh:*`, `window:*` kanalları, contextBridge ile güvenli iletişim

### Mimari Kararlar
- Renderer ↔ Main iletişimi `window.electronAPI` üzerinden (contextBridge)
- Şifreler RAM'de tutulur, diske sadece key dosya yolları yazılır
- Functional component + hooks (class component yok)
- TypeScript strict mode
- PascalCase bileşen ve dosya isimlendirmesi
