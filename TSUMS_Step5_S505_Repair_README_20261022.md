# TSUMS Step 5 S5-05 修復候選｜2026-10-22

**文件層級：Internal Engineering Review / Public Layer / Non-Canonical / Protected Core excluded。**

## 已確認的失敗
原本 `v0641CommitPreDecision()` 先對 `trips` 儲存行前決策，再另外呼叫 `appendEvent`，沒有共同 transaction；若證據事件寫入失敗，可能留下沒有對應事件的 GO。此缺陷在先前的 S5-05 隔離合成測試重現。

## 修復候選的控制
- 以單一 IndexedDB `readwrite` transaction 同時寫入 `trips` 與 `events`，並將 `field_sessions` 納入鎖定與行程啟動狀態檢查。
- 同一筆 transaction 驗證 trip snapshot、最後一筆事件的序號／雜湊、活動尚未啟動，拒絕過時決策。
- 正式提交前重新檢查具名人員權限、Gate 狀態及準備快照；行程切換或 Gate 改變必須重新確認。
- 先前決策仍保存在原來已提交的事件；新決策加入 `supersedes_decision_record_id` 引用，不回寫原事件。
- `render` 失敗不會錯稱本機事務未成功。

## 目前驗收範圍
- HTML inline scripts 靜態編譯：通過。
- Node in-memory IndexedDB 交易模擬：3/3 PASS（共同提交、事件失敗回滾、過時提交拒絕）。
- **真實瀏覽器 IndexedDB 整合測試：尚未通過／未完成。** 本地容器政策阻擋 Chromium 開啟測試頁；此項必須在 Codespaces 的隔離來源完成。
- **Codespaces 真實候選檔尚未比對或驗收。** 不得宣稱 Step 5 正式驗收 PASS。

## Codespaces 執行
將本 ZIP 上傳 Codespaces 測試分支專案根目錄。直接解壓至根目錄（僅新增控制檔案），然後：

```bash
cd /workspaces/tsums-youya
python3 -m zipfile -e TSUMS_Step5_S505_Repair_Candidate_20261022.zip .
bash TSUMS_Step5_S505_Run_In_Codespaces_20261022.sh
```

若有多個 `index.field-runtime-p0-v5*.html` 候選版，安全腳本會拒絕自動選擇，需明確指定原始 v5 版本：

```bash
bash TSUMS_Step5_S505_Run_In_Codespaces_20261022.sh index.field-runtime-p0-v5-EXACT.html
```

所有新證據寫入 `qa-evidence/20261022-step5/`。**無 Commit / 無 Push / 不改 main / 不更動 Port 8000。**

## 下一個放行閘門
在同一個隔離瀏覽器來源上使用合成行程，執行真實 IndexedDB 交易中止、重新載入、雙視窗／同時寫入、重複提交、事件雜湊重算與 Gate 更新後拒絕。若任何一項未通過，Step 5 保持 `NOT ACCEPTED`。
