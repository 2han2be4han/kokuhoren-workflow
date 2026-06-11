/**
 * 国保連請求ワークフロー — GAS Webアプリ
 * ────────────────────────────────────────────
 * 役割：HTMLからの保存(POST)を受けてスプレッドシートに記録、
 *       読込(GET)で当月の進捗を返す（途中再開用）。
 *
 * 【セットアップ手順】
 * 1. Googleスプレッドシートを新規作成（シートは自動生成されます）
 * 2. 拡張機能 → Apps Script を開く
 * 3. このコードを貼り付けて保存
 * 4. 「デプロイ」→「新しいデプロイ」→種類:ウェブアプリ
 *    - 実行ユーザー：自分
 *    - アクセスできるユーザー：全員
 * 5. 発行されたURL（/exec で終わる）をHTMLの「設定」に貼り付け
 * ────────────────────────────────────────────
 */

const SHEET_LOG   = "進捗ログ";      // 項目単位の状態
const SHEET_FAC   = "施設マスタ";    // 施設名
const SHEET_SUM   = "月次サマリ";    // 月ごとの集約

/* ---------- POST：保存 ＋ LINE Webhook受信 ---------- */
function doPost(e){
  // LINEからのWebhook（userId取得用）は events 配列を持つ → 先に判定
  try{
    const peek = JSON.parse(e.postData.contents);
    if(peek && Array.isArray(peek.events)){
      return handleLineWebhook_(peek);
    }
  }catch(err){ /* JSONでない等は通常POSTとして続行 */ }

  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try{
    const body = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if(body.type === "state" || body.type === "branch"){
      saveState_(ss, body);
    } else if(body.type === "facility"){
      saveFacilities_(ss, body);
    }
    return json_({ok:true});
  }catch(err){
    return json_({ok:false, error:String(err)});
  }finally{
    lock.releaseLock();
  }
}

/* ---------- GET：読込（途中再開） ---------- */
function doGet(e){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = e.parameter.action;
  const month  = e.parameter.month;
  if(action === "load"){
    return json_(loadMonth_(ss, month));
  }
  return json_({ok:true, msg:"kokuhoren workflow GAS is running"});
}

/* ---------- 状態保存（upsert：同月・同項目は上書き） ---------- */
function saveState_(ss, body){
  const sh = sheet_(ss, SHEET_LOG, ["対象月","種別","項目ID","状態","更新日時"]);
  const data = sh.getDataRange().getValues();
  const key = body.month + "|" + body.type + "|" + body.itemId;
  let rowIdx = -1;
  for(let i=1;i<data.length;i++){
    if(data[i][0]+"|"+data[i][1]+"|"+data[i][2] === key){ rowIdx = i+1; break; }
  }
  // 配列（差戻対象児童 10-kids 等）はJSON文字列で保存
  var stateVal = body.state;
  if(Array.isArray(stateVal)) stateVal = JSON.stringify(stateVal);
  if(stateVal === undefined || stateVal === null) stateVal = "todo";
  const row = [body.month, body.type, body.itemId, stateVal, body.ts||new Date().toISOString()];
  if(rowIdx>0){ sh.getRange(rowIdx,1,1,row.length).setValues([row]); }
  else { sh.appendRow(row); }
  updateSummary_(ss, body.month);
}

/* ---------- 施設・児童マスタ保存（月ごと全置換） ----------
   facilities = { jishaKids:[{id,name,isSibling,enabled}],
                  tashaKids:[{id,name,enabled}],
                  jougenFax:[{name,enabled}] }                       */
function saveFacilities_(ss, body){
  const sh = sheet_(ss, SHEET_FAC, ["対象月","区分","ID","名前","兄弟","有効"]);
  const data = sh.getDataRange().getValues();
  const f = body.facilities || {};
  // 当月の既存行を全削除
  for(let i=data.length-1;i>=1;i--){
    if(data[i][0]===body.month){ sh.deleteRow(i+1); }
  }
  (f.jishaKids||[]).forEach(k=>{
    sh.appendRow([body.month, "jishaKids", k.id||"", k.name||"", k.isSibling===true, k.enabled!==false]);
  });
  (f.tashaKids||[]).forEach(k=>{
    sh.appendRow([body.month, "tashaKids", k.id||"", k.name||"", false, k.enabled!==false]);
  });
  (f.jougenFax||[]).forEach(x=>{
    sh.appendRow([body.month, "jougenFax", "", x.name||"", false, x.enabled!==false]);
  });
}

/* ---------- 当月読込 ---------- */
function loadMonth_(ss, month){
  const out = {states:{}, branch:{}, facilities:{jishaKids:[],tashaKids:[],jougenFax:[]}};
  const log = ss.getSheetByName(SHEET_LOG);
  if(log){
    const d = log.getDataRange().getValues();
    for(let i=1;i<d.length;i++){
      if(d[i][0]!==month) continue;
      if(d[i][1]==="state") out.states[d[i][2]] = d[i][3];
      else if(d[i][1]==="branch"){
        var bv = d[i][3];
        // 差戻対象児童(10-kids)はJSON配列文字列で保存されている
        if(typeof bv==="string" && bv.charAt(0)==="["){
          try{ bv = JSON.parse(bv); }catch(e){}
        }
        out.branch[d[i][2]] = bv;
      }
    }
  }
  const fac = ss.getSheetByName(SHEET_FAC);
  if(fac){
    const d = fac.getDataRange().getValues();
    // 列: 対象月,区分,ID,名前,兄弟,有効
    for(let i=1;i<d.length;i++){
      if(d[i][0]!==month) continue;
      const k = d[i][1];
      if(!out.facilities[k]) out.facilities[k]=[];
      const enabled = d[i][5]===true || d[i][5]==="TRUE";
      if(k==="jishaKids"){
        out.facilities[k].push({id:d[i][2]||"", name:d[i][3], isSibling:(d[i][4]===true||d[i][4]==="TRUE"), enabled:enabled});
      } else if(k==="tashaKids"){
        out.facilities[k].push({id:d[i][2]||"", name:d[i][3], enabled:enabled});
      } else if(k==="jougenFax"){
        out.facilities[k].push({name:d[i][3], enabled:enabled});
      }
    }
  }
  const fc=out.facilities;
  if(!fc.jishaKids.length && !fc.tashaKids.length && !fc.jougenFax.length) delete out.facilities;
  return out;
}

/* ---------- 月次サマリ更新 ---------- */
function updateSummary_(ss, month){
  const log = ss.getSheetByName(SHEET_LOG);
  if(!log) return;
  const d = log.getDataRange().getValues();
  let done=0, total=0;
  for(let i=1;i<d.length;i++){
    if(d[i][0]===month && d[i][1]==="state"){ total++; if(d[i][3]==="done") done++; }
  }
  const sh = sheet_(ss, SHEET_SUM, ["対象月","完了数","進捗率(%)","最終更新"]);
  const data = sh.getDataRange().getValues();
  let rowIdx=-1;
  for(let i=1;i<data.length;i++){ if(data[i][0]===month){ rowIdx=i+1; break; } }
  const pct = total? Math.round(done/total*100):0;
  const row=[month, done, pct, new Date().toISOString()];
  if(rowIdx>0) sh.getRange(rowIdx,1,1,row.length).setValues([row]);
  else sh.appendRow(row);
}

/* ---------- ユーティリティ ---------- */
function sheet_(ss, name, headers){
  let sh = ss.getSheetByName(name);
  if(!sh){ sh = ss.insertSheet(name); sh.appendRow(headers); }
  return sh;
}
function json_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   LINE 公式アカウント（Messaging API）通知
   ────────────────────────────────────────────
   目的：毎月1〜5日の朝10時台・夕17時台に、締切が近いのに
         未完了のPhaseがあれば自分のLINEへ push 通知する。
   スクリプトプロパティ（プロジェクトの設定 → スクリプト プロパティ）：
     LINE_TOKEN    … チャネルアクセストークン（長期）
     LINE_USER_ID  … 自分のuserId（下のWebhookで取得して貼る）
   ============================================================ */

/* 締切テーブル：何日締切か / どのPhaseか / 項目IDの接頭辞 / 表示名 */
const LINE_DEADLINES = [
  { day: 3, phase: "p6", prefix: "6-", label: "利用者負担額一覧 FAX" },
  { day: 4, phase: "p8", prefix: "8-", label: "センター仮提出" },
  { day: 5, phase: "p9", prefix: "9-", label: "上限管理結果票 FAX" },
];
const SHEET_LINE_ID = "LINE_ID取得";

/* ---------- LINE Webhook：userIdを専用シートに書き出す ---------- */
function handleLineWebhook_(payload){
  try{
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = sheet_(ss, SHEET_LINE_ID, ["受信日時","種別","userId","メッセージ"]);
    (payload.events||[]).forEach(function(ev){
      const src = ev.source || {};
      const uid = src.userId || "";
      const msg = (ev.message && ev.message.text) || ev.type || "";
      sh.appendRow([new Date().toISOString(), src.type||"", uid, msg]);
    });
  }catch(err){ /* 失敗してもLINEには200を返す */ }
  // LINEには必ず200 OKを返す
  return ContentService.createTextOutput(JSON.stringify({ok:true}))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- 当月の対象月キー（YYYY-MM） ---------- */
function lineCurMonth_(){
  const d = new Date();
  const y = d.getFullYear();
  const m = ("0"+(d.getMonth()+1)).slice(-2);
  return y+"-"+m;
}

/* ---------- 締切連動チェック → 未完了があればpush ---------- */
function lineNotifyIfPending(){
  const today = new Date();
  const dom = today.getDate();
  // 毎月1〜5日のみ稼働
  if(dom < 1 || dom > 5) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const month = lineCurMonth_();
  const states = readStates_(ss, month);

  // 各締切Phaseの未完了を集計（締切日を過ぎていないもの＝当日含む）
  const pendings = [];
  LINE_DEADLINES.forEach(function(dl){
    if(dl.day < dom) return; // 締切を過ぎたものは通知しない（5日までの運用）
    const ids = Object.keys(states).filter(function(id){ return id.indexOf(dl.prefix)===0; });
    // 1つでも done でない項目があれば未完了扱い（項目未登録時も未完了とみなす）
    const total = ids.length;
    const done  = ids.filter(function(id){ return states[id]==="done"; }).length;
    if(total===0 || done < total){
      const remain = dl.day - dom; // 0=本日締切
      pendings.push({ label: dl.label, day: dl.day, remain: remain, done: done, total: total });
    }
  });

  if(!pendings.length) return; // 全部終わっていれば通知しない

  // メッセージ組み立て（締切が近い順）
  pendings.sort(function(a,b){ return a.remain - b.remain; });
  let lines = ["⚠️ 国保連請求：未完了の締切があります"];
  pendings.forEach(function(p){
    const when = p.remain===0 ? "本日締切" : ("残り"+p.remain+"日");
    const prog = p.total>0 ? ("（"+p.done+"/"+p.total+"完了）") : "（未着手）";
    lines.push("・"+p.day+"日 "+p.label+"　"+when+" "+prog);
  });
  lines.push("");
  lines.push("→ アプリで確認してください");

  linePush_(lines.join("\n"));
}

/* ---------- 進捗ログから当月の状態マップを作る ---------- */
function readStates_(ss, month){
  const out = {};
  const log = ss.getSheetByName(SHEET_LOG);
  if(!log) return out;
  const d = log.getDataRange().getValues();
  for(let i=1;i<d.length;i++){
    if(d[i][0]===month && d[i][1]==="state"){ out[d[i][2]] = d[i][3]; }
  }
  return out;
}

/* ---------- LINE push 送信 ---------- */
function linePush_(text){
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("LINE_TOKEN");
  const uid   = props.getProperty("LINE_USER_ID");
  if(!token || !uid){
    Logger.log("LINE_TOKEN または LINE_USER_ID が未設定です");
    return;
  }
  const res = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + token },
    payload: JSON.stringify({ to: uid, messages: [{ type:"text", text:text }] }),
    muteHttpExceptions: true
  });
  Logger.log("LINE push: " + res.getResponseCode() + " " + res.getContentText());
}

/* ---------- 手動テスト：今すぐ自分に1通送る ---------- */
function lineTestPush(){
  linePush_("✅ テスト通知：LINE連携は正常です（国保連請求ワークフロー）");
}

/* ---------- トリガー設定：毎日 朝10時台・夕17時台に実行 ----------
   一度だけ手動実行すればOK。重複防止のため既存トリガーを消してから作る。 */
function setupLineTriggers(){
  // 既存の lineNotifyIfPending トリガーを削除
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction()==="lineNotifyIfPending") ScriptApp.deleteTrigger(t);
  });
  // 朝10時台
  ScriptApp.newTrigger("lineNotifyIfPending").timeBased().atHour(10).everyDays(1).create();
  // 夕17時台
  ScriptApp.newTrigger("lineNotifyIfPending").timeBased().atHour(17).everyDays(1).create();
  Logger.log("トリガーを設定しました（毎日10時台・17時台）。実際の通知は毎月1〜5日のみ飛びます。");
}
