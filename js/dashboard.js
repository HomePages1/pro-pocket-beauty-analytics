(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = { rows: [], period: "30" };
  const text = (v, fallback = "不明") => v === undefined || v === null || v === "" ? fallback : String(v);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const num = v => Number(v || 0).toLocaleString("ja-JP");

  function getDate(row) {
    const d = new Date(row.timestamp || row.receivedAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  function rowsInPeriod() {
    if (state.period === "all") return state.rows;
    const now = new Date();
    if (state.period === "today") return state.rows.filter(r => {
      const d = getDate(r); return d && d.toDateString() === now.toDateString();
    });
    const limit = Date.now() - Number(state.period) * 86400000;
    return state.rows.filter(r => { const d = getDate(r); return d && d.getTime() >= limit; });
  }
  function countBy(rows, key, fallback = "不明") {
    const map = new Map();
    rows.forEach(r => { const k = text(r[key], fallback); map.set(k, (map.get(k) || 0) + 1); });
    return [...map.entries()].sort((a,b) => b[1] - a[1]);
  }
  function unique(rows, key) { return new Set(rows.map(r => r[key]).filter(Boolean)).size; }
  function numeric(row, keys) {
    for (const key of keys) {
      const value = parseFloat(row[key]);
      if (Number.isFinite(value)) return value;
    }
    return null;
  }
  function average(rows, keys) {
    const values = rows.map(r => numeric(r, keys)).filter(v => v !== null);
    return values.length ? values.reduce((a,b) => a+b,0) / values.length : 0;
  }
  function renderRanks(id, entries) {
    const target = $(id); target.innerHTML = "";
    if (!entries.length) { target.innerHTML = '<div class="empty">データがありません</div>'; return; }
    const max = entries[0][1] || 1;
    entries.slice(0,12).forEach(([name, value]) => {
      target.insertAdjacentHTML("beforeend",
        `<div class="rank"><span class="rank-name" title="${esc(name)}">${esc(name)}</span><b class="rank-number">${num(value)}</b><div class="track"><div class="fill" style="width:${value/max*100}%"></div></div></div>`);
    });
  }
  function renderChart(id, entries, labelLimit = 14) {
    const target = $(id); target.innerHTML = "";
    const shown = entries.slice(-labelLimit);
    if (!shown.length) { target.innerHTML = '<div class="empty">データがありません</div>'; return; }
    const max = Math.max(...shown.map(x => x[1]), 1);
    shown.forEach(([label,value]) => {
      target.insertAdjacentHTML("beforeend",
        `<div class="bar-item"><span class="bar-value">${value}</span><div class="bar" style="height:${Math.max(2,value/max*160)}px"></div><span class="bar-label">${esc(label)}</span></div>`);
    });
  }
  function render(rows) {
    $("pv").textContent = num(rows.length);
    $("users").textContent = num(unique(rows,"userId"));
    $("sessions").textContent = num(unique(rows,"sessionId"));
    $("newUsers").textContent = num(rows.filter(r => String(r.isNewUser).toLowerCase() === "true").length);
    $("duration").textContent = `${average(rows,["duration","durationSeconds"]).toFixed(1)}秒`;
    $("scroll").textContent = `${average(rows,["scrollPercent","scrollRate","scroll"]).toFixed(1)}%`;

    const daily = countBy(rows.map(r => ({...r, bucket: getDate(r)?.toLocaleDateString("ja-JP",{month:"numeric",day:"numeric"}) || "不明"})), "bucket");
    const monthly = countBy(rows.map(r => ({...r, bucket: getDate(r)?.toLocaleDateString("ja-JP",{year:"numeric",month:"2-digit"}) || "不明"})), "bucket");
    const weekdays = countBy(rows.map(r => ({...r, bucket: getDate(r)?.toLocaleDateString("ja-JP",{weekday:"short"}) || "不明"})), "bucket");
    const hours = countBy(rows.map(r => ({...r, bucket: getDate(r) ? `${String(getDate(r).getHours()).padStart(2,"0")}時` : "不明"})), "bucket");
    renderChart("dailyChart", daily);
    renderChart("monthlyChart", monthly, 12);
    renderRanks("weekdayList", weekdays);
    renderRanks("hourList", hours);
    renderRanks("pageList", countBy(rows,"page"));
    renderRanks("sourceList", countBy(rows,"source").map(([source,n]) => [source,n]));
    renderRanks("campaignList", countBy(rows,"campaign"));
    renderRanks("countryList", countBy(rows,"country"));
    renderRanks("regionList", countBy(rows,"prefecture").filter(([x]) => x !== "不明").concat(countBy(rows,"region").filter(([x]) => x !== "不明")));
    renderRanks("cityList", countBy(rows,"city"));
    renderRanks("deviceList", countBy(rows,"device"));
    renderRanks("browserList", countBy(rows,"browser"));
    renderRanks("osList", countBy(rows,"os"));
    renderRanks("languageList", countBy(rows,"language"));
    renderRanks("visitorType", [["新規訪問",rows.filter(r => String(r.isNewUser).toLowerCase()==="true").length],["リピーター・未判定",rows.filter(r => String(r.isNewUser).toLowerCase()!=="true").length]]);

    const details = $("details");
    details.innerHTML = rows.slice().sort((a,b) => (getDate(b)?.getTime()||0)-(getDate(a)?.getTime()||0)).slice(0,300).map(r => {
      const d = getDate(r);
      const duration = numeric(r,["duration","durationSeconds"]);
      const scroll = numeric(r,["scrollPercent","scrollRate","scroll"]);
      return `<tr><td>${d ? d.toLocaleString("ja-JP") : "不明"}</td><td>${esc(text(r.page))}</td><td>${esc(text(r.title))}</td><td>${esc(text(r.country))}</td><td>${esc(text(r.prefecture, text(r.region)))}</td><td>${esc(text(r.city))}</td><td>${esc(text(r.source))}</td><td>${esc(text(r.medium))}</td><td>${esc(text(r.device))}</td><td>${esc(text(r.browser))}</td><td>${duration===null?"-":duration+"秒"}</td><td>${scroll===null?"-":scroll+"%"}</td></tr>`;
    }).join("");
    $("rowCount").textContent = `${num(rows.length)}件`;
    $("status").textContent = `${num(rows.length)}件のデータを表示中`;
  }
  async function load() {
    $("status").textContent = "データを読み込んでいます…";
    try {
      const url = `${ANALYTICS_CONFIG.gasUrl}?action=analytics&key=${encodeURIComponent(ANALYTICS_CONFIG.apiKey)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      state.rows = Array.isArray(data) ? data : (data.rows || data.data || []);
      if (!Array.isArray(state.rows)) throw new Error("データ形式が不正です");
      render(rowsInPeriod());
    } catch (error) {
      console.error(error);
      $("status").textContent = "データ取得に失敗しました。GASの公開設定・URL・ブラウザのエラーを確認してください。";
    }
  }
  $("period").addEventListener("change", e => { state.period = e.target.value; render(rowsInPeriod()); });
  $("reload").addEventListener("click", load);
  load();
})();