/* 用最小 DOM stub 在 Node 裡實際跑 index.html 的邏輯並驗證 */
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];

class El {
  constructor(tag) {
    this.tagName = (tag || "div").toUpperCase();
    this.children = [];
    this.dataset = {};
    this.style = {};
    this._cls = new Set();
    this._html = "";
    this.textContent = "";
    this.value = "";
    this.checked = false;
    this._listeners = {};
    const self = this;
    this.classList = {
      add: (...c) => c.forEach((x) => self._cls.add(x)),
      remove: (...c) => c.forEach((x) => self._cls.delete(x)),
      toggle: (c, f) => { if (f === undefined) f = !self._cls.has(c); f ? self._cls.add(c) : self._cls.delete(c); return f; },
      contains: (c) => self._cls.has(c),
    };
  }
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return [...this._cls].join(" "); }
  set innerHTML(v) { this._html = v; }
  get innerHTML() { return this._html; }
  addEventListener(t, f) { (this._listeners[t] = this._listeners[t] || []).push(f); }
  blur() {}
  closest() { return null; }
}

// ---- 假的 WebAudio：用來數「有沒有真的發出聲音」 ----
let toneCount = 0;
class FakeParam { setValueAtTime() {} exponentialRampToValueAtTime() {} linearRampToValueAtTime() {} }
class FakeOsc { constructor() { this.frequency = new FakeParam(); this.type = ""; } connect() {} start() { toneCount++; } stop() {} }
class FakeGain { constructor() { this.gain = new FakeParam(); } connect() {} }
global.AudioContext = class {
  constructor() { this.currentTime = 0; this.state = "running"; this.destination = {}; }
  createOscillator() { return new FakeOsc(); }
  createGain() { return new FakeGain(); }
  resume() {}
};

const els = {};
const handlers = {};
let rafCb = null;

global.document = {
  getElementById: (id) => (els[id] = els[id] || new El("div")),
  createElement: (t) => new El(t),
  addEventListener: (t, f) => { (handlers[t] = handlers[t] || []).push(f); },
};
global.window = global;
global.requestAnimationFrame = (fn) => { rafCb = fn; };

// ---- 執行受測腳本 ----
eval(js);

// ---- 工具 ----
const GLYPH = { "0":"abcdef","1":"bc","2":"abdeg","3":"abcdg","4":"bcfg","5":"acdfg","6":"acdefg",
  "7":"abc","8":"abcdefg","9":"abcdfg","-":"g","E":"adefg","n":"ceg"," ":"",".":"" };
const REV = {};
for (const k in GLYPH) if (!REV[GLYPH[k]]) REV[GLYPH[k]] = k;

function segsOf(cell) {
  return cell.children.filter((c) => c._cls.has("seg") && !c._cls.has("dot"));
}
function decodeCell(cell) {
  const on = segsOf(cell).filter((s) => s._cls.has("on"))
    .map((s) => [...s._cls].find((c) => c !== "seg")).sort().join("");
  return REV[on] === undefined ? "?" : REV[on];
}
function lcd() { return els.lcd.children.map(decodeCell).join(""); }
function subText() { return els.sub.innerHTML; }
function press(k) { (handlers.keydown || []).forEach((f) => f({ key: k, target: { tagName: "DIV" }, preventDefault() {} })); }
let t = 0;
function frames(n, msEach) {
  for (let i = 0; i < (n || 1); i++) { t += (msEach || 16); rafCb(t); }
}
function framesFor(ms) { frames(Math.ceil(ms / 16), 16); }

let fails = 0;
function ok(cond, msg, extra) {
  if (cond) { console.log("  PASS  " + msg); }
  else { fails++; console.log("  FAIL  " + msg + (extra !== undefined ? "   → " + extra : "")); }
}

// ================= 電卓測試 =================
console.log("\n=== 電卓 ===");
press("1"); press("2"); press("3"); press("+"); press("4"); press("5"); press("="); frames(1);
ok(lcd().trim() === "168", "123 + 45 = 168", lcd());
press("Escape"); frames(1);
ok(lcd().trim() === "0", "AC 歸零", lcd());
press("1"); press("0"); press("0"); press("0"); press("0"); press("0"); press("0"); press("0"); press("0"); press("0"); press("0"); frames(1);
ok(lcd().replace(/\./g, "").trim() === "1000000000", "輸入上限 10 位", lcd());
press("Escape");
press("9"); press("sqrt".length ? "r" : "r"); // 無效鍵，忽略
press("Escape");
// √9 = 3  → 用滑鼠路徑（click handler）測試非鍵盤鍵
function clickKey(k, v) { els.keys._listeners.click.forEach((f) => f({ target: { closest: () => ({ dataset: { k, v }, blur() {} }) } })); }
clickKey("d", "9"); clickKey("sqrt"); frames(1);
ok(lcd().trim() === "3", "√9 = 3", lcd());
clickKey("ac");
clickKey("d", "1"); clickKey("div"); clickKey("d", "3"); clickKey("eq"); frames(1);
ok(lcd().trim() === "0333333333", "1 ÷ 3 = 0.333333333（0 + 9 位小數）", lcd());
clickKey("ac");
clickKey("d", "1"); clickKey("d", "0"); clickKey("d", "0"); clickKey("taxin"); frames(1);
ok(lcd().trim() === "110", "100 税込(10%) = 110", lcd());
clickKey("ac");
clickKey("d", "5"); clickKey("d", "0"); clickKey("d", "0"); clickKey("taxout"); frames(1);
ok(lcd().trim() === "4545454545", "500 税抜(10%) = 454.5454545", lcd());
clickKey("ac");
clickKey("d", "2"); clickKey("d", "0"); clickKey("d", "0"); clickKey("add"); clickKey("d", "1"); clickKey("d", "0"); clickKey("pct"); frames(1);
ok(lcd().trim() === "220", "200 + 10% = 220", lcd());
clickKey("ac");
clickKey("d", "4"); clickKey("d", "2"); clickKey("add"); clickKey("d", "8"); clickKey("eq"); frames(1);
ok(lcd().trim() === "50", "42 + 8 = 50", lcd());
clickKey("d", "9"); clickKey("eq"); frames(1);
ok(lcd().trim() === "17", "定數計算：再按 9 = → 17（9+8）", lcd());
clickKey("ac"); frames(1);
clickKey("d", "5"); clickKey("d", "0"); clickKey("d", "0"); clickKey("d", "0"); clickKey("d", "0"); clickKey("d", "0"); clickKey("d", "0"); clickKey("d", "0"); clickKey("d", "0"); clickKey("d", "0"); clickKey("div"); clickKey("d", "0"); clickKey("eq"); frames(1);
ok(lcd().trim().indexOf("E") >= 0, "除以 0 → E", lcd());
clickKey("ac"); frames(1);

// ================= 遊戲測試 =================
console.log("\n=== 遊戲 ===");
clickKey("game");
frames(2);
ok(lcd().trim() === "0", "GAME → 先顯示最高分", lcd());
framesFor(1600);
ok(subText().indexOf("INVADERS") >= 0, "接著顯示本局條件 16 / 30", subText());
framesFor(1700);
ok(subText().indexOf("P1 R1") >= 0, "進入 Part1 Round1", subText());

function decodeField() { return [3,4,5,6,7,8].map((i) => decodeCell(els.lcd.children[i])); }

// 自動瞄準機器人：把砲台調到最靠近自己的侵略者數字，然後開火
let shots = 0, gains = 0, lastScore = 0, errors = 0, ufoSeen = 0, ufoKills = 0;
let maxRound = 0, sawClear = 0, livesSeen = 0;
const AIMORDER = ["0","1","2","3","4","5","6","7","8","9","n"];
try {
  for (let f = 0; f < 4000; f++) {
    frames(1);
    const st = subText();
    const rm = /P(\d) R(\d)/.exec(st);
    if (rm) maxRound = Math.max(maxRound, parseInt(rm[2], 10));
    if (st.indexOf("GAME OVER") >= 0) break;
    if (st.indexOf("CLEAR") >= 0) { sawClear++; framesFor(2100); continue; }
    if (!rm) continue;
    const fld = decodeField();
    if (fld.indexOf("n") >= 0) ufoSeen++;
    let target = null;
    for (let i = 0; i < 6; i++) { if (fld[i] && fld[i] !== " " && fld[i] !== "?") { target = fld[i]; break; } }
    if (!target) { framesFor(80); continue; }
    // AIM 需要逐格重繪，所以每次按完都推進一格畫面
    let guard = 0;
    while (decodeCell(els.lcd.children[0]) !== target && guard++ < 14) { press("z"); frames(1); }
    if (decodeCell(els.lcd.children[0]) === target) { press("x"); shots++; frames(1); }
    const m = /SCORE (\d+)/.exec(subText());
    if (m) {
      const sc = parseInt(m[1], 10);
      if (sc > lastScore) { if (sc - lastScore >= 310) ufoKills++; gains++; lastScore = sc; }
    }
    framesFor(110);
  }
} catch (e) { errors++; console.log("  EXCEPTION: " + e.stack); }

ok(errors === 0, "自動遊玩 4000 frames 沒有丟出例外");
ok(shots > 60, "至少發射 60 發（實際 " + shots + "）");
ok(gains > 30, "分數有持續增加（得分次數 " + gains + "，最後分數 " + lastScore + "）");
ok(ufoSeen > 0, "UFO(n) 有出現（出現 " + ufoSeen + " 幀）");
ok(ufoKills > 0, "UFO 有被擊落並 +300（" + ufoKills + " 次）");
ok(sawClear > 0, "有回合被清空（CLEAR 出現 " + sawClear + " 次）");
ok(maxRound >= 2, "回合會推進（最高到 R" + maxRound + "）");
console.log("  最終 sub = " + subText());
console.log("  最終 LCD = [" + lcd() + "]");

// ================= 旋律模式 / 電源開關 =================
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function switchTo(sw) {
  els.modeswitch._listeners.click.forEach((f) =>
    f({ target: { closest: () => ({ dataset: { sw }, blur() {} }) } }));
  frames(1);
}

(async function () {
  console.log("\n=== MG-880 旋律模式 / 模式開關 ===");
  clickKey("ac"); frames(1);

  switchTo("music");
  ok(els.keys._cls.has("music"), "切到 ♪：鍵盤加上 music class（鍵面浮現音名）");
  ok(subText().indexOf("MUSIC MODE") >= 0, "副顯示列顯示 MUSIC MODE", subText());
  ok(els.knob.style.transform === "translateX(100%)", "滑動開關指示塊移到第 2 段", els.knob.style.transform);

  const beforeNote = toneCount;
  clickKey("d", "1");
  frames(1);
  ok(toneCount > beforeNote, "按 1 = 發出ド（oscilator 有啟動）");
  ok(lcd().trim() === "1", "LCD 顯示音階級數 1", lcd());

  clickKey("sign");
  frames(1);
  ok(subText().indexOf("♯ ON") >= 0, "♯ 修飾可開啟", subText());

  const tuneAtGamePress = toneCount;
  clickKey("game");                                  // ♪ 模式下 GAME（預設）= 切回 CAL 開遊戲
  frames(1);
  ok(!els.keys._cls.has("music"), "♪ 模式下按 GAME：離開音樂模式", els.keys.className);
  ok(subText().indexOf("HIGH SCORE") >= 0, "♪ 模式下按 GAME：直接開始遊戲", subText());
  ok(toneCount - tuneAtGamePress <= 2, "沒有順便播內建曲（只有模式切換與開局提示音，實際 " +
    (toneCount - tuneAtGamePress) + " 聲）");

  // 回音樂模式，改用 ♪ 鍵聽內建曲
  switchTo("music");
  const tuneStart = toneCount;
  clickKey("melody");
  await sleep(1300);
  frames(1);
  const tuneNotes = toneCount - tuneStart;
  ok(tuneNotes >= 4, "♪ 鍵演奏《聖者的行進》（1.3 秒內 " + tuneNotes + " 個音）");
  ok(subText().indexOf("聖者の行進") >= 0, "副顯示列顯示正在演奏", subText());

  await sleep(8000);
  frames(1);
  ok(subText().indexOf("聖者の行進") < 0, "曲子播完會自行停止", subText());

  // 勾選「MG-880 實機行為」後，♪ 模式下的 GAME 變回演奏
  els["opt-gamekey"]._listeners.change.forEach((f) => f({ target: { checked: true } }));
  const beforeFidelity = toneCount;
  clickKey("game");
  await sleep(700);
  frames(1);
  ok(toneCount - beforeFidelity >= 2, "勾選實機行為後：♪ 模式下 GAME = 演奏內建曲",
    String(toneCount - beforeFidelity));
  ok(els.keys._cls.has("music"), "且仍留在音樂模式");
  els["opt-gamekey"]._listeners.change.forEach((f) => f({ target: { checked: false } }));
  clickKey("ac");
  frames(1);

  switchTo("off");
  ok(lcd().trim() === "", "切到 OFF：LCD 全暗", "[" + lcd() + "]");
  ok(subText().indexOf("OFF") >= 0, "副顯示列顯示 OFF", subText());

  switchTo("calc");
  ok(subText().indexOf("CALC") >= 0, "切回 CAL：回到電卓", subText());
  ok(lcd().trim() === "0", "電卓顯示 0（音樂模式沒有污染計算輸入）", lcd());

  // 音樂模式不該讓數字進到電卓
  switchTo("music");
  press("5"); press("6"); frames(1);
  switchTo("calc");
  ok(lcd().trim() === "0", "音樂模式下按 5 6 不會進到電卓", lcd());

  console.log("\n" + (fails === 0 ? "ALL PASS" : fails + " FAILED"));
  process.exit(fails === 0 ? 0 : 1);
})();
