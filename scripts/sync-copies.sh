#!/bin/bash
# sync-copies.sh — 把本 repo 的權威版同步到所有登記的複製點，並以 md5 驗證。
#
# 權威版＝ GitHub/faber-castell-color。複製點見 CLAUDE.md 的「複製件登記」：
#   faber-castell-color-lib.js ＋ data/fc-colors.js → color-palette / thangka-trace
#   整包前端 → InProgress 鏡像（回灌只同步程式碼，不碰資料夾）
#
# 之前這支放在暫存區，結果清掉之後就漏同步了一次；收進 repo 才不會再弄丟。
# 用法：bash scripts/sync-copies.sh
set -u
G=/Users/Shared/nodeapp/GitHub
I=/Users/Shared/nodeapp/InProgress
SRC=$G/faber-castell-color/public/apps/faber-castell-color
FAIL=0

echo "=== 1) 整包前端 → InProgress 鏡像（只同步程式碼）==="
mkdir -p "$I/public/apps/faber-castell-color/"
cp -R "$SRC/." "$I/public/apps/faber-castell-color/"

echo "=== 2) 共用 lib + 資料 → color-palette / thangka-trace（含各自的 InProgress 鏡像）==="
# ⚠️ 這裡曾有第三個複製對象 `data/fc-names-i18n.js`（FC 色名 zh/ja 對照，只有 color-palette 用），
# 於 2026-08-04 連同該檔本身一起移除。經過值得記下來：
#   ① 那行的守衛檢查的是**目的端**有沒有，但缺的是**來源端**——本 repo 根本沒有這個檔。
#      於是每次跑都噴兩行 `cp: No such file`，**而 exit code 仍是 0**：
#      錯誤訊息與成功長得一模一樣，正是這支腳本存在的目的要防的那種事。
#   ② 追「為什麼來源沒有」才是重點：它是 db_artcolor 建庫**之前**的產物，產生器
#      `data/source/generate.js` 已凍結不可再跑、匯出器 a3-export.js 也不產它。
#      **沒有權威版的複製件就是過期資料**——與 SoR 現值對不上（實查 zh 47 筆、ja 19 筆不同），
#      color-palette 因此一直顯示舊譯名。（它另外只涵蓋 ag 141 色，但消費端走 nearestFC
#      的預設 series:'ag'、Black Edition 取不到，那一段是潛在問題而非已發生的問題。）
#   ③ 正解是消費端改讀 `fc-colors.js` 的 `nameZh`／`nameJa`（259 色三語齊備，隨匯出走），
#      那也是同檔 CDA／COPIC 早就在用的做法。**修守衛只會讓錯誤安靜下來，不會讓它變對。**
for app in color-palette thangka-trace; do
  for dst in "$G/$app/public/apps/$app" "$I/public/apps/$app"; do
    [ -d "$dst" ] || { echo "  MISSING $dst"; FAIL=1; continue; }
    cp "$SRC/faber-castell-color-lib.js" "$dst/faber-castell-color-lib.js"
    cp "$SRC/data/fc-colors.js"          "$dst/data/fc-colors.js"
  done
done

verify() {   # $1=檔名相對路徑, 其餘=所有複製點
  local label=$1; shift
  local n
  n=$(md5 -r "$@" | awk '{print $1}' | sort -u | wc -l | tr -d ' ')
  if [ "$n" = "1" ]; then echo "  OK        $label — $# 份單一 hash"
  else echo "  MISMATCH  $label — $n 種 hash"; md5 -r "$@"; FAIL=1; fi
}

echo
echo "=== md5 驗證 ==="
verify "faber-castell-color-lib.js" \
  "$SRC/faber-castell-color-lib.js" \
  "$G/color-palette/public/apps/color-palette/faber-castell-color-lib.js" \
  "$G/thangka-trace/public/apps/thangka-trace/faber-castell-color-lib.js" \
  "$I/public/apps/faber-castell-color/faber-castell-color-lib.js" \
  "$I/public/apps/color-palette/faber-castell-color-lib.js" \
  "$I/public/apps/thangka-trace/faber-castell-color-lib.js"

verify "data/fc-colors.js" \
  "$SRC/data/fc-colors.js" \
  "$G/color-palette/public/apps/color-palette/data/fc-colors.js" \
  "$G/thangka-trace/public/apps/thangka-trace/data/fc-colors.js" \
  "$I/public/apps/faber-castell-color/data/fc-colors.js" \
  "$I/public/apps/color-palette/data/fc-colors.js" \
  "$I/public/apps/thangka-trace/data/fc-colors.js"

echo "=== InProgress 前端整包逐檔比對 ==="
if diff -rq "$SRC" "$I/public/apps/faber-castell-color" > /dev/null; then
  echo "  OK  與獨立版逐檔相同（$(find "$SRC" -type f | wc -l | tr -d ' ') 個檔）"
else
  diff -rq "$SRC" "$I/public/apps/faber-castell-color"
  FAIL=1
fi

echo
if [ "$FAIL" -eq 0 ]; then echo "全部通過。"; else echo "有項目不一致（見上）。"; fi
exit "$FAIL"
