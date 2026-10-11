# PROMPTS-GAME-ENGINE.md

> Paket prompt + peta agent untuk membangun Game Engine di NexPlay/NexConsole.
> Paket ini dirancang untuk dijalankan **berurutan per tahap**, setiap agent
> menulis output ke kontrak file yang jelas. Tanpa Amoeba Swarm.

---

## Model Free Paling Powerful untuk Game Engine

| Model | Konteks / Output | Kekuatan | Status |
|---|---|---|---|
| `google/gemini-3.5-flash` | 1M (via key Anda) | Otak utama — reasoning, JS/TS, arsitektur | jalan |
| `opencode/longcat-2.5-preview-free` | 1M / 128K | Penulis besar — baca seluruh repo, tulis engine multi-file | teruji |
| `opencode/space-bunny-free` | 1M / 512K output | Bulk generator — batch komponen UI/aset | teruji |
| `opencode/step-5-preview-free` | 1M / 64K | Aksi berat — logika rumit (routing, auth, data) | teruji |
| `opencode/ling-3.1-flash-free` | 262K / 32K | Cepat & hemat — QA berulang, edit kecil | teruji |
| `ollama/qwen3:8b` | lokal | Backup offline — biasa dipakai semua agent | jalan |

> **Warning:** `opencode/*-free` (kecuali `exo-free` yang sudah deprecated)
> semua bertipe **preview** — bisa diganti/deprecate sewaktu-waktu.
> Selalu pakai rantai fallback.

---

## Paket Prompt per Tahap

### TAHAP 0 — Fondasi & Database Unik (rilis-berbasis-waktu)

**Agent:** programmer → **Model:** `google/gemini-3.5-flash`

Buat migrasi Supabase `supabase/migrations/0002_games_schema.sql` dengan 3 tabel RLS-enabled:

1. **`games`** — `id uuid pk`, `creator_id`, `game_key text UNIQUE` (format `{slug}-{YYYYMMDD-HHMM}` dari `released_at`), `title`, `description`, `gameplay jsonb` (setting yang bisa creator atur), `assets jsonb`, `version int`, `released_at timestamptz`.
2. **`player_progress`** — `UNIQUE(game_id, player_id)`, `data jsonb`, `updated_at` (agar pemain tidak kehilangan progress).
3. **`scores`** (sudah ada di 0001) + policy: anon baca, creator hanya tulis/ubah game miliknya (`auth.uid() = creator_id`).

Keunikan dihitung dari `(creator_id, game_key, released_at)` — game sama boleh rilis ulang sebagai versi baru tanpa bentrokan. Tulis skema + policy + contoh INSERT uji.

---

### TAHAP 1 — Core Game Engine (runtime embeddable)

**Agent:** programmer → **Model:** `opencode/longcat-2.5-preview-free` (inti rumit bolak-balik ke `gemini-3.5-flash`)

Bangun inti engine di `src/engine/`:

- **(a) `gameLoader.ts`** — muat satu "game package" berbentuk JSON `{gameplay, assets, scripts}` dari Supabase.
- **(b) runtime render + loop main** di atas PlayCanvas (pakai pola dari proyek gamejam).
- **(c) `eventBus.ts`** — emit `score`, `levelChange`, `autoSave`.
- **(d) API `engine.submitScore()`**.

Kontrak I/O: input = JSON package, output = fungsi `mountGame(canvas, package)` + event listener. Jangan campur logika UI creator ke dalam engine — engine harus mandiri dan bisa di-iframe.

---

### TAHAP 2 — Persistensi Pemain (tidak kehilangan game)

**Agent:** programmer → **Model:** `google/gemini-3.5-flash`

Implement `src/lib/saveGame.ts`:

- Autosave state engine ke `localStorage` (key `nexplay:{gameKey}:{playerId}`) setiap 5 detik + saat `beforeunload`.
- Sinkronkan ke tabel `player_progress` via `supabase.upsert` saat online.
- Saat muat ulang halaman, engine resume dari state tersimpan (fallback: local dulu, lalu cloud).

Tangani kasus:
- Offline → muat dari local, koneksi pulih → push ke cloud.
- Skor hanya dikirim sekali per game-over (anti duplikat).
- Konsol log ringkas `[save] ...` untuk debugging.

---

### TAHAP 3 — Creator UI (tab terpisah untuk bikin game)

**Agent:** designer + programmer → **Model:** `opencode/space-bunny-free` (batch UI) + `gemini-3.5-flash` (state/logika)

Buat halaman `/creator` di NexConsole dengan tab terpisah:

| Tab | Isi |
|---|---|
| **Dashboard** | Statistik game saya + total pemain/skor |
| **Buat Game** | Form: judul, deskripsi, gameplay config editor JSON/drag-drop, pratinjau canvas langsung |
| **Game Saya** | Daftar game + versi rilis |
| **Data & Skor** | Tabel skor per game |
| **Publikasi** | Klik "Rilis" → set `released_at`, buat `game_key`, naikkan `version` |

Gunakan React Router, komponen reusables di `src/components/creator/*`, dan binding Supabase `getSupabase()`. Layout responsif; setelah "Rilis" muncul tombol link ke `/play/{game_key}`.

---

### TAHAP 4 — Integrasi Halaman Site NexConsole

**Agent:** programmer → **Model:** `opencode/step-5-preview-free`

Sambungkan creator page ke seluruh routing site:

- Tambah rute `/creator`, `/play/:gameKey`, dan `/game/:gameKey`.
- Bagian header/site-nav menampilkan tab "Creator" (hanya jika login).
- Context auth satu sumber di `src/lib/auth.tsx`.
- Halaman `/play/:gameKey` memuat game package → `mountGame()` → autosave → `submitScore`.
- Pastikan deep-link langsung ke `/play/...` tetap jalan (hydration/router mode).
- Halaman game terisolasi agar tidak merusak timing site.

---

### TAHAP 5 — QA & Deploy Otomatis

**Agent:** reviewer → **Model:** `opencode/ling-3.1-flash-free` (loop cepat), final review `gemini-3.5-flash`

Jalankan siklus uji:

1. Create game
2. Play 30 detik
3. Reload → pastikan progress kembali
4. Game over → skor masuk ke `scores`
5. Cek RLS anon & creator

Tulis hasilnya ke `TESTLOG.md` (status per item). Lalu build `npm run build` & `typecheck`; jika hijau, deploy `vercel --prod`. Laporkan: daftar bug terbuka, saran prioritas, dan pratinjau URL.

---

## Cara Menggabungkan Semua Agent (Automation, Tanpa Jebakan Swarm)

> **Jangan gunakan Amoeba Swarm** (itu penyebab error kemarin — kunci dengan `revision>0`).

Sebagai gantinya, **producer agent** membaca satu file `BRIEF.md` dan memanggil agent lain **berurutan**, tiap agent menulis output ke kontrak file:

```
producer   → BRIEF.md          (satu brief per tahap)
programmer → src/engine/*, src/lib/*
designer   → src/components/creator/*, gameplay-config spec
artist     → src/engine/assets-procedural.ts (aset via kode)
reviewer   → TESTLOG.md
```

### Rantai Model per Agent

| Agent | Default | Cadangan |
|---|---|---|
| producer / reviewer (akhir) | `google/gemini-3.5-flash` | `opencode/step-5-preview-free` |
| programmer (core/DB) | `google/gemini-3.5-flash` | `opencode/longcat-2.5-preview-free` |
| programmer (tulis banyak file) | `opencode/longcat-2.5-preview-free` | `opencode/space-bunny-free` |
| designer / artist | `opencode/space-bunny-free` | `opencode/mimo-v2.6-flash-free` |
| reviewer (QA cepat) | `opencode/ling-3.1-flash-free` | `ollama/qwen3:8b` |
| semua (offline) | `ollama/qwen3:8b` | `llamacpp/qwen3-8b` |

---

## Kontrak File Ringkas

```
/
├── PROMPTS-GAME-ENGINE.md          ← file ini
├── BRIEF.md                        ← producer: brief per tahap
├── supabase/migrations/
│   └── 0002_games_schema.sql       ← Tahap 0
├── src/
│   ├── engine/
│   │   ├── gameLoader.ts           ← Tahap 1a
│   │   ├── runtime.ts              ← Tahap 1b (PlayCanvas loop)
│   │   ├── eventBus.ts             ← Tahap 1c
│   │   ├── submitScore.ts          ← Tahap 1d
│   │   └── assets-procedural.ts    ← Tahap 3 (artist)
│   ├── lib/
│   │   ├── saveGame.ts             ← Tahap 2
│   │   └── auth.tsx                ← Tahap 4
│   ├── components/creator/        ← Tahap 3
│   └── pages/
│       ├── Creator.tsx             ← Tahap 3
│       └── Play.tsx                ← Tahap 4
└── TESTLOG.md                      ← Tahap 5
```

---

## Catatan Penting

- **Tanpa Swarm:** kunci file dengan `revision>0` di Amoeba Swarm menyebabkan error.
  Gunakan rantai agent berurutan via producer.
- **Preview models:** semua `*-free` adalah preview — selalu siapkan fallback.
- **Kontrak I/O engine:** `mountGame(canvas, package)` — engine mandiri, bisa di-iframe.
- **Skor anti-duplikat:** hanya dikirim sekali per game-over.
- **Deep-link:** `/play/:gameKey` harus langsung jalan tanpa client-side redirect.
