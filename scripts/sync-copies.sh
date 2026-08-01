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
for app in color-palette thangka-trace; do
  for dst in "$G/$app/public/apps/$app" "$I/public/apps/$app"; do
    [ -d "$dst" ] || { echo "  MISSING $dst"; FAIL=1; continue; }
    cp "$SRC/faber-castell-color-lib.js" "$dst/faber-castell-color-lib.js"
    cp "$SRC/data/fc-colors.js"          "$dst/data/fc-colors.js"
    [ -f "$dst/data/fc-names-i18n.js" ] && cp "$SRC/data/fc-names-i18n.js" "$dst/data/fc-names-i18n.js"
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
