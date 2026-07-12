# 恆春民宿網站：最終前台＋完整管理後台

此版本直接以你上傳的「最終上架前台版本」為基礎製作，保留原本版面、照片、相簿與文字呈現，新增完整 CMS 管理後台。

## 已新增的後台功能

- 管理員 Email／密碼登入
- 第一個註冊帳號自動成為管理員
- 新增民宿：前台自動新增一張民宿卡片
- 修改民宿所有資料
- 上架／下架
- 刪除民宿：前台整張卡片消失
- 修改顯示順序
- 修改民宿名稱、館別、包棟人數、房型
- 修改旺季／淡季價格
- 修改地址、入住時間、退房時間、押金、訂金與加床資訊
- 修改設備
- 上傳／更換封面圖片
- 上傳與刪除相簿照片
- 修改首頁簡介
- 修改價格備註
- 修改六則訂房／入住須知
- 修改 LINE 與 Instagram
- 前台從資料庫即時讀取，不必因內容修改而重新部署

## 系統架構

- 前台與後台：HTML、CSS、JavaScript
- 資料庫／帳號／圖片：Supabase
- 程式碼：GitHub
- 部署：Vercel

## 第一次安裝：必須做一次

### 1. 建立 Supabase 專案

註冊 Supabase，建立一個新 Project。

### 2. 建立資料庫與權限

1. Supabase 左側進入 `SQL Editor`
2. 建立 New query
3. 打開本壓縮檔內的 `supabase-setup.sql`
4. 全選複製，貼進 SQL Editor
5. 按 `Run`

SQL 會建立：

- `stays`：民宿資料
- `stay_images`：相簿照片
- `site_settings`：首頁、須知、聯絡資訊
- `profiles`：管理員權限
- Supabase Storage 圖片空間
- Row Level Security 安全規則
- 現有五間民宿與原本相簿資料

### 3. 填寫 Supabase 連線資訊

Supabase 進入：

`Project Settings → API`

複製：

- Project URL
- anon public key 或 Publishable key

打開 `config.js`，改成：

```javascript
window.APP_CONFIG = {
  SUPABASE_URL: "貼上你的 Project URL",
  SUPABASE_ANON_KEY: "貼上你的 anon public key"
};
```

只能使用 anon／publishable key，禁止使用 service_role key。

### 4. 上傳 GitHub

把壓縮檔解壓縮後，將裡面的所有檔案上傳到原本 GitHub Repository 最外層，覆蓋舊版：

```text
assets/
index.html
styles.css
app.js
cms.css
admin.html
admin.css
admin.js
config.js
supabase-setup.sql
vercel.json
```

Commit 後，Vercel 會自動重新部署。

### 5. 建立管理員帳號

網站部署成功後，開啟：

```text
https://hengchun-homestay.vercel.app/admin.html
```

輸入 Email 與至少 8 碼密碼，點：

`第一次使用：註冊管理員`

第一個成功註冊的帳號會自動成為管理員。

若 Supabase 有開啟 Email 驗證，先到信箱完成驗證，再登入。

完成管理員註冊後，建議到：

`Supabase → Authentication → Providers → Email`

關閉一般使用者自由註冊，避免其他人註冊帳號。

## 日常使用

日後修改內容只需：

1. 開啟 `/admin.html`
2. 登入
3. 新增、編輯、上下架或刪除
4. 按儲存
5. 前台自動更新

不需要再修改程式碼，也不需要重新上傳 GitHub。

## 上下架與刪除的差別

- **下架**：資料保留，但前台隱藏；建議暫時不接客時使用
- **刪除**：資料庫永久刪除，前台完全消失；刪除前會要求確認

## 目前範圍

此版本是民宿內容管理系統，不含：

- 線上訂房庫存
- 房況日曆
- 金流
- 客戶會員
- 自動訂單通知
