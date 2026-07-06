/**
 * faber-castell-color — 獨立執行的 Express 伺服器
 *
 * 唯讀參考工具：Faber-Castell 色號 → CSS（hex / var / rgb / utility class）對照。
 * 141 色資料是靜態 registry（public/apps/faber-castell-color/data/fc-colors.js，
 * 由 Farbtabelle-AG-ENG-0214.pdf 產生），不需上傳/編輯，故**後端無 API**——
 * 只負責靜態檔、根路徑轉址、JSON 404。
 *
 * 啟動： npm install && npm start
 *        預設 http://localhost:3000/apps/faber-castell-color/
 */

const express = require('express');
const path = require('path');
const logger = require('morgan');

const app = express();

app.use(logger('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// 根路徑導向應用頁
app.get('/', (req, res) => res.redirect('/apps/faber-castell-color/'));

// 404（API 回 JSON，其餘回純文字）
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, error: 'Not found' });
  res.status(404).type('text/plain').send('Not found');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`faber-castell-color →  http://localhost:${PORT}/apps/faber-castell-color/`);
});
