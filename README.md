# NYCU 姊妹校交換 — 互動式儀表板（期中習作）

陽明交大姊妹校交換資訊儀表板：地圖、瀏覽學校、收藏、討論區、獎學金等。

---

## 線上 Demo（免安裝）

**評分／展示請直接開啟：** https://next-dashboard-mauve-gamma.vercel.app

| 分頁 | 網址 |
|------|------|
| 首頁 | `/` |
| 地圖 | `/map` |
| 瀏覽學校 | `/school-browser` |
| 收藏 | `/wishlist` |
| 討論區 | `/social` |
| 獎學金 | `/scholarships` |

---

## Vercel 部署

### 一次性設定

1. 將 repo push 至 GitHub（須包含 `data/` 內 JSON，或由 `prebuild` 在本機驗證後一併 commit）
2. 登入 [vercel.com](https://vercel.com)（建議用 GitHub 帳號）
3. **Add New Project** → 選擇本 repository
4. **Root Directory** 留空（專案根目錄即 Next.js app）
5. Framework：Next.js（自動偵測）
6. Build Command：`npm run build`（會自動執行 `prebuild` 驗證資料）
7. 點 **Deploy**

### 部署後

- 取得 `https://xxx.vercel.app`，更新本 README 的 Demo 連結
- 測試 `/map` 地圖點選與篩選是否正常

### 自動更新

Push 至 GitHub `main` 分支後，Vercel 會自動重新部署。

### 雲端版限制

| 項目 | 說明 |
|------|------|
| 討論區留言 | 存於瀏覽器 localStorage |
| 分析 Excel | 雲端不寫入本機檔案（API 自動略過） |
| 獎學金 sync | 雲端僅讀取已打包的 `data/scholarships.json` |

---

## 本地開發

```powershell
cd "C:\Users\user\Desktop\data visual\project"
npm install
npm run dev
```

瀏覽器開啟：**http://localhost:3000**

同步部署用資料（可選，build 前會自動執行）：

```powershell
npm run copy-data
```

---

## 專案結構

```text
project/
├── data/                    # 學校與 QS 主資料
│   ├── nycu_191_clean.json
│   ├── qs_rankings_2026.json
│   └── scholarships.json
├── src/                     # Next.js 應用程式
├── package.json
└── legacy/app.py            # 舊版 Python Dash（非本期主要交付）
```

---

## 從 GitHub 下載後，同學無法正常運行的常見原因

### 1. 沒有執行 `npm install`

Git **不會** 上傳 `node_modules/`。每位成員 clone 後都必須自己安裝依賴：

```powershell
npm install
```

### 2. 用錯方式「開啟網頁」（篩選／按鈕會全部失效）

本專案是 **Next.js 動態網站**，互動功能都依賴瀏覽器執行 JavaScript。

**正確方式：** 終端機顯示 `Ready` 後，用瀏覽器開 **http://localhost:3000**（由 `npm run dev` 提供）。

### 3. 與舊版 `legacy/app.py` 搞混

根目錄的 `legacy/app.py` 是 **Python Dash** 舊版介面，需 Python 環境，且功能與 Next.js 版不同。

| 項目 | Next.js（本 README） | legacy/app.py（舊版） |
|------|---------------------|----------------------|
| 啟動位置 | `project/` 根目錄 | `project/` 根目錄 |
| 指令 | `npm run dev` | `python legacy/app.py` |
| 預設網址 | http://localhost:3000 | 依 Dash 設定 |

### 4. Node.js 版本過舊或未安裝

建議 **Node.js 20 LTS** 或以上。檢查：`node -v`

### 5. 連接埠 3000 已被占用

```powershell
npx next dev -p 3001
```

---

## 完整安裝與啟動步驟（給新成員）

### 前置需求

- [Git](https://git-scm.com/)
- [Node.js 20+](https://nodejs.org/)（含 npm）

### 步驟

```powershell
git clone <你的-repository-url>
cd "data visual\project"
dir data\nycu_191_clean.json
npm install
npm run dev
```

終端出現 `Ready` 後，用 Chrome / Edge 開啟 **http://localhost:3000**。

### 正式環境建置（選用）

```powershell
npm run build
npm run start
```

---

## 資料檔說明

| 檔案 | 用途 |
|------|------|
| `data/nycu_191_clean.json` | 191 所姊妹校主資料（**必須**） |
| `data/qs_rankings_2026.json` | QS 2026 排名 |
| `data/scholarships.json` | 獎學金快取 |

更新 QS 排名（在專案根目錄執行）：

```powershell
node scripts/sync_qs_rankings.mjs
```

---

## 疑難排解

### 頁面空白或顯示 School data file not found

→ 確認 `data/nycu_191_clean.json` 存在，且 clone 的是完整 repo。

### 畫面有出來，但篩選、收藏、地圖點擊都沒反應

1. 確認網址是 **http://localhost:3000**，不是 `file://`
2. 確認是用 **`npm run dev`** 啟動
3. 按 **F12 → Console** 查看錯誤訊息

---

## 技術棧

- [Next.js 16](https://nextjs.org/)（App Router）
- React 19、TypeScript、Tailwind CSS
- [globe.gl](https://globe.gl/) / Three.js（3D 地圖）
