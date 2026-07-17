# Supabase 設定

## 家庭同步

1. 安裝或直接使用 Supabase CLI，登入並連結專案：

   ```powershell
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

2. 建立受 RLS 保護的 `trip_sync_state` 資料表：

   ```powershell
   npx supabase db push
   ```

3. 設定允許連線的網站來源。正式網址與本機網址以逗號分隔：

   ```powershell
   npx supabase secrets set ALLOWED_ORIGIN=http://127.0.0.1:5173,http://localhost:5173,https://wing0928.github.io
   ```

4. 部署家庭同步 Edge Function：

   ```powershell
   npx supabase functions deploy trip-sync
   ```

5. 在 `.env.local` 設定 Project URL 與 Publishable Key：

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
   ```

   `VITE_SUPABASE_SYNC_FUNCTION_URL` 可省略，程式會依 Project URL 自動組合函式網址。Project URL 與 Publishable Key 可以放在前端；`SUPABASE_SERVICE_ROLE_KEY` 只由 Edge Function 使用，不可放進 `.env.local` 或 GitHub。

6. 電腦第一次開啟「設定 > 家庭同步」時按「建立家庭同步」。目前的旅行設定、行程與願望清單會上傳。手機開啟同一網站後，輸入電腦顯示的同步碼加入。

## Google Places（選用）

1. 將 Google Places API Key 設為 Supabase Secret：

   ```powershell
   npx supabase secrets set GOOGLE_PLACES_API_KEY=YOUR_GOOGLE_PLACES_KEY
   ```

2. 部署 Google Places Edge Function：

   ```powershell
   npx supabase functions deploy google-place-details
   ```

3. 在 `.env.local` 設定：

   ```dotenv
   VITE_GOOGLE_PLACES_FUNCTION_URL=https://YOUR_PROJECT.supabase.co/functions/v1/google-place-details
   ```

Google API Key 不可使用 `VITE_` 前綴，也不可提交到 GitHub。
