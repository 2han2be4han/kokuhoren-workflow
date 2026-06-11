/* ============================================================
   国保連請求ワークフロー データ定義
   ・添付テキスト「書類の用意.txt」を正として反映
   ・docs（書類カラーマップ）= 書類バッジ専用色
   ・各 item は { id, text, note?, docs?[] }
   ============================================================ */

/* 書類カラーマップ：同じ書類は全フェーズで同色＋同アイコン＋太字名 */
const DOC_MAP = {
  riyohyo:      { name: "①利用表",                       color: "#2563EB", icon: "📋" },
  kesseki:      { name: "欠席記録",                       color: "#7C3AED", icon: "📅" },
  senmon_rec:   { name: "③専門的支援実施記録",           color: "#0D9488", icon: "🩺" },
  otayori:      { name: "おたより",                       color: "#65A30D", icon: "📰" },
  keikaku:      { name: "個別支援計画書別紙（算定時間表）", color: "#4F46E5", icon: "⏱" },
  doseki:       { name: "同席日数の表",                   color: "#0891B2", icon: "👥" },
  jisseki:      { name: "⑦実績",                         color: "#059669", icon: "✏️" },
  meisai1:      { name: "⑧-1明細書",                     color: "#D97706", icon: "💴" },
  meisai2:      { name: "⑧-2都道府県別",                 color: "#92400E", icon: "🗾" },
  seikyu_goukei:{ name: "④請求合計",                     color: "#DC2626", icon: "🧮" },
  ryokin:       { name: "⑤利用料金表",                   color: "#DB2777", icon: "🧾" },
  shiharaizumi: { name: "⑥支払済児童一覧",               color: "#475569", icon: "✅" },
  hogosha:      { name: "⑨保護者請求書",                 color: "#E11D48", icon: "👨‍👩‍👧" },
  futangaku:    { name: "⑪利用者負担額一覧",             color: "#EA580C", icon: "📮" },
  jougen:       { name: "上限額管理結果票",               color: "#9333EA", icon: "📠" },
};

/* 期限定義（締切ストリップ用） */
const DEADLINES = [
  { id: "d3", label: "利用者負担額一覧 FAX", day: 3, phaseId: "p6" },
  { id: "d4", label: "センター仮提出",       day: 4, phaseId: "p8" },
  { id: "d5", label: "上限管理結果票 FAX",   day: 5, phaseId: "p9" },
];

const WORKFLOW = [
  {
    id: "p1", no: 1, title: "書類の用意", icon: "📁",
    lead: "請求に必要な書類を集めます。置き場所も併記。",
    items: [
      { id: "1-1", text: "利用表（児童ごとの利用数を表示）", note: "デイロボから出力", docs: ["riyohyo"] },
      { id: "1-2", text: "欠席記録を用意", note: "キャビネット2の上段", docs: ["kesseki"] },
      { id: "1-3", text: "専門的支援実施記録を用意", note: "キャビネット2に掲示されているもの", docs: ["senmon_rec"] },
      { id: "1-4", text: "おたよりを用意", docs: ["otayori"] },
      { id: "1-5", text: "個別支援計画書別紙（算定時間表）を用意", note: "請求できる利用時間・算定時間の根拠。必須", docs: ["keikaku"] },
      { id: "1-6", text: "同席日数の表を用意", note: "職員ステーションから", docs: ["doseki"] },
    ],
  },
  {
    id: "p2", no: 2, title: "書類日付照合", icon: "🔍",
    lead: "利用表と欠席記録を突き合わせ、時間の誤りを洗い出します。",
    items: [
      { id: "2-1", text: "利用表 × 欠席記録の照合", note: "日付・児童名・利用有無が一致しているか（照らし合わせ）", docs: ["riyohyo", "kesseki"] },
      { id: "2-2", text: "利用表で利用時間が間違っている箇所を抽出", note: "誤りのある行を洗い出す", docs: ["riyohyo"] },
    ],
  },
  {
    id: "p3", no: 3, title: "⑦実績作成", icon: "✏️",
    lead: "1件ずつ正確に入力。請求できるのは計画書別紙の時間のみ。",
    items: [
      { id: "3-1", text: "利用時間（開始・終了）を入力", note: "個別支援計画書別紙に載っている利用時間でしか請求不可", docs: ["jisseki", "keikaku"] },
      { id: "3-2", text: "送迎を確認・入力", note: "グループLINEで確認可能", docs: ["jisseki"] },
      { id: "3-3", text: "延長時間を入力", note: "区分に注意（区分ミスが起きやすい）", docs: ["jisseki"] },
      { id: "3-4", text: "算定時間を入力", note: "個別支援計画書別紙に載っている算定時間でしか請求不可", docs: ["jisseki", "keikaku"] },
      { id: "3-5", text: "専門的支援実施加算日を確認", note: "実施記録と一致しているか", docs: ["jisseki", "senmon_rec"] },
      { id: "3-6", text: "イベント参加を確認", docs: ["jisseki"] },
    ],
  },
  {
    id: "p4", no: 4, title: "⑧-1明細作成", icon: "💴",
    lead: "加算・サービス提供区分・利用者負担上限を正確に入力。",
    groups: [
      {
        subtitle: "加算数の確認",
        items: [
          { id: "4-1", text: "人工内耳装用児支援加算", note: "同席日数を使用", docs: ["meisai1", "doseki"] },
          { id: "4-2", text: "専門的支援実施加算", note: "専門的支援実施加算表を使用", docs: ["meisai1", "senmon_rec"] },
          { id: "4-3", text: "個別サポート加算", docs: ["meisai1"] },
        ],
      },
      {
        subtitle: "サービス提供区分数の確認",
        items: [
          { id: "4-4", text: "児童発達の区分を確認", note: "21411 / 21412 / 21413", docs: ["meisai1"] },
          { id: "4-5", text: "放課後等デイサービスの区分を確認", note: "411 / 412 / 413", docs: ["meisai1"] },
        ],
      },
      {
        subtitle: "利用者負担上限月額の確認",
        items: [
          { id: "4-6", text: "無償化対象児童が0円になっているか確認", note: "0〜3歳（年少じゃない）・小学生が対象", docs: ["meisai1"] },
        ],
      },
      {
        subtitle: "自社の作業を始める",
        dynamicKids: "jisha",
        note: "児童名・兄弟設定は「施設・対象管理」タブで編集。兄弟の児童は上限管理手順を展開できます。",
        items: [],
      },
      {
        subtitle: "他社児童の処理",
        dynamicKids: "tasha",
        note: "他社あり：管理結果額1・金額0円。センター提出書類作成時は暫定で算出。",
        items: [],
      },
    ],
    accordions: {
      jisha_fukusu: {
        title: "兄弟の上限管理手順",
        steps: [
          "上の子の明細を作成する",
          "下の子の明細を作成する",
          "上の子の上限管理で複数児童に切り替える",
          "下の子の明細を作り直して総請求額を取得する",
          "上の子の上限管理に下の子の総請求額を入れる",
          "上限管理結果票に出てきた下の子の利用者負担額をメモする",
          "下の子の明細の金額にメモした金額を入れる",
          "保存する",
        ],
      },
    },
  },
  {
    id: "p5", no: 5, title: "実績と明細の印刷", icon: "🖨",
    lead: "実績と明細を印刷します。",
    items: [
      { id: "5-1", text: "実績を印刷", docs: ["jisseki"] },
      { id: "5-2", text: "明細を印刷", docs: ["meisai1"] },
    ],
  },
  {
    id: "p6", no: 6, title: "⑪利用者負担額一覧の印刷", icon: "📮",
    deadline: 3,
    lead: "FAXで送付。毎月3日まで！",
    items: [
      { id: "6-1", text: "利用者負担額一覧を印刷", docs: ["futangaku"] },
      { id: "6-2", text: "送付状を作成して印刷", note: "「ここから作る」ボタンで上限管理フォルダへ遷移", docs: ["futangaku"], folderLink: true },
      { id: "6-3", text: "送付状と利用者負担額一覧をFAXする", docs: ["futangaku"] },
    ],
  },
  {
    id: "p7", no: 7, title: "⑧-2都道府県別・④請求合計・⑥支払済・金額照合", icon: "📊",
    lead: "集計と照合。請求合計はまだ印刷しない点に注意。",
    items: [
      { id: "7-1", text: "⑧-2都道府県別を印刷", docs: ["meisai2"] },
      { id: "7-2", text: "④請求合計に金額を入れる", note: "印刷はまだ！", docs: ["seikyu_goukei"] },
      { id: "7-3", text: "⑧-1明細書を用意し、給付費の金額を⑥支払済児童一覧に入れる", docs: ["meisai1", "shiharaizumi"] },
      { id: "7-4", text: "④請求合計 と ⑥支払済児童一覧の金額が合っているか確認", note: "不一致なら原因を確認", docs: ["seikyu_goukei", "shiharaizumi"] },
      { id: "7-5", text: "④請求合計 と ⑥支払済児童一覧を印刷", docs: ["seikyu_goukei", "shiharaizumi"] },
    ],
  },
  {
    id: "p8", no: 8, title: "⑤利用料金表・⑨保護者請求書・仮提出", icon: "👨‍👩‍👧",
    deadline: 4,
    lead: "保護者向け処理と仮提出。仮提出は毎月4日まで！",
    items: [
      { id: "8-1", text: "職員ステーションを開いて利用料金表を作成", docs: ["ryokin"] },
      { id: "8-2", text: "⑧-1明細書の利用者負担額を入力", docs: ["ryokin", "meisai1"] },
      { id: "8-3", text: "イベントの参加を確認", docs: ["ryokin"] },
      { id: "8-4", text: "利用料金表を保存", docs: ["ryokin"] },
      { id: "8-5", text: "利用料金表を印刷", docs: ["ryokin"] },
      { id: "8-6", text: "⑤利用料金表を元に⑨保護者請求書を作成", docs: ["hogosha", "ryokin"] },
      { id: "8-7", text: "⑤利用料金表 と ⑨保護者請求書の金額を照合", docs: ["hogosha", "ryokin"] },
      { id: "8-8", text: "保護者請求書を印刷（領収書は印刷しない）", docs: ["hogosha"] },
      { id: "8-9", text: "センターに仮提出する", note: "毎月4日まで！", docs: ["hogosha"] },
    ],
  },
  {
    id: "p9", no: 9, title: "上限管理結果票（自社）のFAX", icon: "📠",
    deadline: 5,
    lead: "phase無視で5日までにマスト。SSから公式LINEで通知あり。",
    items: [
      { id: "9-0", text: "公式LINEからの通知が送信済みか確認", note: "SSからの通知の有無をチェック", docs: ["jougen"] },
      { id: "9-1", text: "他施設（ウィズユー／キッズワンハート等）から来た負担額一覧票を用意", note: "施設名の追加・削除は「施設・対象管理」タブで", docs: ["jougen"] },
      { id: "9-2", text: "上限額管理結果票を印刷", docs: ["jougen"] },
      { id: "9-3", text: "送付状を作成", note: "Phase6と同じ上限管理フォルダへ遷移", docs: ["jougen"], folderLink: true },
      { id: "9-4", text: "FAXする", docs: ["jougen"] },
    ],
  },
  {
    id: "p10", no: 10, title: "差戻から修正をする", icon: "🔄",
    lead: "差戻が来たら、対象児童を選んでから分岐に沿って対応します。",
    branch: true,
    items: [
      { id: "10-kids", text: "差戻に下記の児童はいますか？", kidSelect: true, note: "差し戻された児童を選択（複数可）。選んだ児童が下の各項目に出ます。" },
      { id: "10-q1", text: "実績の修正が必要？", branchQuestion: true, note: "YESなら下の連動項目が開く" },
      { id: "10-1", text: "明細書を開いて金額が変動するか確認", note: "実績修正=YESのとき", docs: ["meisai1"], branchChild: "yes", kidChips: true },
      { id: "10-q2", text: "明細の金額が変動した？", branchQuestion: true, note: "YESなら下の連動項目が開く", branchChild: "yes" },
      { id: "10-2", text: "加算の再確認（⑧-1明細作成の加算確認項目を出す）", note: "金額変動=YESのとき", docs: ["meisai1"], branchChild: "yes2", kidChips: true },
      { id: "10-3", text: "上限管理が必要なら修正のFAXをする", note: "差戻児童に兄弟（上限管理）が含まれるとき", docs: ["jougen"], branchChild: "yes2", siblingOnly: true },
      { id: "10-4", text: "支払済児童一覧を修正", docs: ["shiharaizumi"], branchChild: "yes2", kidChips: true },
      { id: "10-5", text: "都道府県別を再作成", docs: ["meisai2"], branchChild: "yes2" },
      { id: "10-6", text: "請求合計を修正", docs: ["seikyu_goukei"], branchChild: "yes2" },
      { id: "10-7", text: "保護者請求書を修正", docs: ["hogosha"], branchChild: "yes2", kidChips: true },
      { id: "10-8", text: "修正した書類を印刷する", note: "実績修正=NOの場合はここだけでOK" },
    ],
  },
  {
    id: "p11", no: 11, title: "書類の再確認・取り込み送信", icon: "✅",
    lead: "最終確認のうえ取り込み送信します。",
    items: [
      { id: "11-1", text: "全部そろっているか確認" },
      { id: "11-2", text: "取り込み送信する" },
    ],
  },
];

/* 施設・対象管理の初期値（スプレッドシート施設マスタと同期）
   jishaKids : 自社児童 [{ name, isSibling, enabled }]
   tashaKids : 他社児童 [{ name, enabled }]
   jougenFax : 上限管理FAX先施設 [{ name, enabled }]                       */
const FACILITY_DEFAULTS = {
  jishaKids: [],
  tashaKids: [],
  jougenFax: [{ name: "ウィズユー", enabled: true }, { name: "キッズワンハート", enabled: true }],
};

const FOLDER_PATH = "\\\\192.168.240.202\\04-パズルフォルダ\\201-FAX・提出・チラシ\\01-上限管理";
