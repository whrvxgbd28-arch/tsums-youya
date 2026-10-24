# TSUMS P10 QA-062｜現有三頁 DOM 互動接線補丁

- Document ID：TSUMS-P10-QA062-DOM-INTEGRATION-20261024
- 版本：QA-062 v0.1 Integration Candidate｜2026-10-24（Asia/Taipei）
- 資訊層級：Public-Layer UI Integration／Protected Core Excluded／Non-Canonical
- Release State：**Not Deployed｜Production Release Hold**
- 基準：使用者提供之 GitHub Pages 截圖、QA-056～061 工作紀錄、已提供的五結構與 Medical T-State 索引。**並非正式 GitHub Pages source snapshot**。

## 為何這次不同於 QA-057～061

先前各版本主要建立**另一份獨立 `index.html`**；這不能修好已部署的三頁。QA-062 提供單一可獨立插入的 `qa062-p10-interactions.js`，在已有原始頁上掃描**已知靜態資訊卡片**，為其補掛「＋ 記錄」及可點擊抽屜，並在 P10 顯示底部「拍照記錄／語音速記」雙快捷鍵。它不要求把整個網站換成新原型，也不讀取或修改 Protected Core。

## 實際整合步驟（工程師或倉庫擁有者操作）

1. 在 GitHub 儲存庫預設分支，將本包 `qa062-p10-interactions.js` 放在原本的 `index.html` **同層目錄**；保留原 P9、P10、P11 三頁，不要用本包 `qa062_fixture.html` 覆蓋任何正式頁。
2. 在正式 `index.html` 的 `</body>` **前**新增：

   ```html
   <script src="./qa062-p10-interactions.js" defer></script>
   ```

3. 若 PWA service worker/Cache Storage 固定舊版 assets，必須依既有發版制度**升版資產清單和快取鍵**；不得清除使用者既有 IndexedDB，且不得把未驗證舊資料遷移為成功記錄。
4. 在正式 branch 前保留原 commit SHA，先於測試分支與 iPhone Safari 測試，通過後才執行 review / merge / deployment。嚴禁把本包樣例與正式 `index.html` 直接互換。
5. 檢視實際 DOM 是否符合卡片標籤與雙按鈕工具列的辨識規則；若有不同，先在 `RULES` 新增**明確標籤映射**，不要放寬到所有 DIV，以免誤觸 P9/P11。

## 覆蓋的既有卡片範圍（22 種可辨識入口）

- 五結構：氧、溫、血、腦、動（5）
- SOS／救援：事故事件、救援受理、最後有效位置、通報交接（4）
- 撤退外援：避難位置、接駁交通、留守人、保險外援（4）
- 生態／權利：場域封閉、棲地警訊、敏感座標外送、受保護知識（4）
- 通訊／CHECK-IN：行動網路、無線電、衛星電話、追蹤器、CHECK-IN（5）

**只有實際含相符文字、未接成既有功能按鈕的卡片**才會掛載；不是聲稱已驗證每一張正式頁。保留已存在 `data-qa061-open` 等 QA 功能入口，避免覆寫。

## 交易與責任邊界

- 拍照／選圖：原始 Blob 在使用者選取後，先計算 SHA-256，再以 `IndexedDB.add()` 新增本機事件；**只有交易 `oncomplete` 才顯示本機保存完成**。
- 語音速記：需要使用者授權麥克風與 `MediaRecorder` 支援，停止並寫入交易成功後才顯示完成；原音無自動語音轉寫。
- 摘要：只能從人工輸入、來源、裝置時間、候選媒體 ID 組成**候選摘要**；必須再由使用者輸入操作者並按「人工確認並保存摘要」。**沒有影像 AI/OCR/語音語意辨識。**
- 本機 DB：`TSUMS_P10_QA062_LOCAL` v1，`events` append-only（僅就該 JS 應用程式而言）；原始資料與人工覆核分開追加；無伺服器上傳、無自動傳送、無外部回執判定。
- SHA-256 是完整性檢核摘要，**不是簽章、可信時間戳或法定不可否認證明**；`deviceTime`／`observationTime` 不得直接冒稱經外部可信時間源確認的 `T₀,k`。
- 離線 Web App 可能被 Safari 清理站點資料。真實傷病資料不應在未加密或未經授權裝置進行正式部署；目前無安全登入、靜態加密、遠端備份、容量監控、個資保存期限、告知／同意與法定調閱機制。
- 對 `protected` 類型，禁拍照、禁錄音、禁定位，禁止自由文字觀察，只允許受限權利狀態與操作者；即使如此仍需人工保護；本補丁不保證對所有敏感地名語意進行辨識。
- 生態類型亦禁止「自動一鍵取得座標」；原始相片可能含 EXIF 定位 metadata，僅能放在有權限且安全的受限本機環境，不外送。
- 緊急求援不應依賴 PWA：移除**重複大型** 119 工具列而保留一處小型 `tel:119` 通道（需電信連線）；拍照與錄音均不得干擾救援。

## 實機驗收門檻（尚未完成）

1. 以正式三頁 commit 為底，P9、P10、P11 各按鈕與導航回歸，確認 P10 快捷鍵不遮住其他頁。
2. iPhone Safari HTTPS：相機（包括相簿匯入）、麥克風權限允許／拒絕、暫停背景切換與恢復。
3. IndexedDB 寫入、重新整理、關閉重開、瀏覽器更新、空間不足及隱私模式，確認不虛報成功。
4. 輸入者確認、原圖 SHA-256 比對、摘要人工修改與雙筆鏈接，PWA 不得自動生成醫療診斷。
5. 敏感坐標與受保護知識不外送、第三方 CDN／Network requests、隱私與個資告知。
6. 真實傳送、收件回執、權限閘門、保險/救援「受理」等流程需獨立串接正式系統和具名權責。
7. Mobile layout / VoiceOver / 焦點 / 觸控目標尺寸 / 自動預覽 / 離線工作。

## 目前驗證結果

- `node --check`：PASS。
- `test_qa062_dom_only.py`：模擬原頁 8/8 靜態卡片有新增按鈕、抽屜可開關、人工摘要可生成、未填操作者阻擋、HTTPS 不可用時保存失敗不虛報、底部工具列被替換、測試中 P9/P11 原按鈕保持、P10 隱藏時原工具列復原：PASS。
- 真正 `http://127.0.0.1` 的 Playwright 瀏覽器路由被此執行環境阻擋（ERR_BLOCKED_BY_ADMINISTRATOR）。因此**IndexedDB 實際提交／重新整理持久化未驗證**。
- 不能聲稱真實 GitHub Pages 三頁已修復。現有 GitHub 連線範圍未取得該倉庫；公開頁面亦無法讀取。

## QA 最終狀態

**INTEGRATION CODE DELIVERED｜DOM FIXTURE PASSED｜LIVE SOURCE NOT AVAILABLE｜IPHONE & STORAGE QA PENDING｜RELEASE HOLD**
