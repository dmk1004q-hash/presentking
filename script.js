/* =========================================================
   우리 반 발표왕 — 동작 로직
   - 기록은 브라우저 localStorage에 저장됩니다.
   - 데이터 구조:
     { className: "3학년 2반",
       students: [{ id, code: "S001", name, num, byDate: { "2026-11-10": 2 } }] }
   ========================================================= */
(function () {
  "use strict";

  const STORAGE_KEY = "balpyo-app-v1";
  const DOW = ["일", "월", "화", "수", "목", "금", "토"];
  const $ = (sel) => document.querySelector(sel);

  /* ---------- 상태 ---------- */
  const state = {
    data: load(),
    date: todayStr(),
    view: "record",
    range: "week",   // 현황판 기간
    basis: "all",    // 발표자 뽑기 기준 기간
    pickedId: null,
  };

  /* ---------- 저장 ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && Array.isArray(d.students)) return { className: d.className || "", students: d.students };
      }
    } catch (e) { /* 저장소를 못 읽으면 빈 상태로 시작 */ }
    return { className: "", students: [] };
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data)); }
    catch (e) { toast("기록을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요."); }
  }

  /* ---------- 날짜 도우미 ---------- */
  function pad(n) { return String(n).padStart(2, "0"); }
  function toStr(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function todayStr() { return toStr(new Date()); }
  function parse(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
  function addDays(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return toStr(d); }
  function label(s) { const d = parse(s); return (d.getMonth() + 1) + "월 " + d.getDate() + "일(" + DOW[d.getDay()] + ")"; }
  function isToday() { return state.date === todayStr(); }

  function bounds(range) {
    const d = parse(state.date);
    if (range === "day") return [state.date, state.date];
    if (range === "week") {
      const start = addDays(state.date, -((d.getDay() + 6) % 7)); // 월요일 시작
      return [start, addDays(start, 6)];
    }
    if (range === "month") {
      return [toStr(new Date(d.getFullYear(), d.getMonth(), 1)), toStr(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
    }
    return ["0000-00-00", "9999-99-99"];
  }

  /* ---------- 계산 도우미 ---------- */
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function students() {
    return [...state.data.students].sort((a, b) => (a.num ?? 999) - (b.num ?? 999) || a.code.localeCompare(b.code));
  }
  function find(id) { return state.data.students.find((s) => s.id === id); }
  function dayCount(s, date) { return (s.byDate && s.byDate[date]) || 0; }
  function total(s) { return Object.values(s.byDate || {}).reduce((a, b) => a + (b || 0), 0); }
  function countIn(s, [from, to]) {
    let t = 0;
    for (const [k, v] of Object.entries(s.byDate || {})) if (k >= from && k <= to) t += v || 0;
    return t;
  }
  function colorIndex(s) { return (parseInt(s.code.replace(/\D/g, ""), 10) || 0) % 6; }

  /* ---------- 화면 그리기 ---------- */
  function renderSummary() {
    const L = students();
    const day = L.reduce((a, s) => a + dayCount(s, state.date), 0);
    const who = L.filter((s) => dayCount(s, state.date) > 0).length;
    const all = L.reduce((a, s) => a + total(s), 0);
    const zero = L.filter((s) => total(s) === 0).length;
    const when = isToday() ? "오늘" : label(state.date);
    $("#sumDayLabel").textContent = when + " 발표";
    $("#sumWhoLabel").textContent = (isToday() ? "오늘" : "이날") + " 발표한 친구";
    $("#sumDay").innerHTML = day + "<small>회</small>";
    $("#sumWho").innerHTML = who + "<small>/ " + L.length + "명</small>";
    $("#sumAll").innerHTML = all + "<small>회</small>";
    $("#sumZero").innerHTML = zero + "<small>명</small>";
  }

  function renderGrid() {
    const L = students(), grid = $("#grid");
    if (!L.length) {
      grid.innerHTML = `<div class="empty"><div class="emoji">🐣</div><h2>아직 등록된 친구가 없어요</h2>
        <p>학생을 추가하면 아이디가 자동으로 붙고, 여기에 친구들 카드가 나타나요.</p>
        <button class="big-btn" data-go="manage">학생 추가하러 가기</button></div>`;
      return;
    }
    const max = Math.max(1, ...L.map((s) => dayCount(s, state.date)));
    grid.innerHTML = L.map((s) => {
      const c = dayCount(s, state.date);
      return `<div class="tile t${colorIndex(s)}${c === 0 ? " zero" : ""}" data-id="${s.id}">
        ${c > 0 && c === max && L.length > 1 ? '<span class="star">⭐ 최다 발표</span>' : ""}
        <div class="who"><span class="name">${esc(s.name)}</span><span class="code">${s.num != null ? s.num + "번 · " : ""}${esc(s.code)}</span></div>
        <div class="count" data-count>${c}<small>회</small></div>
        <div class="total">누적 ${total(s)}회</div>
        <div class="acts">
          <button class="minus" data-act="minus" aria-label="${esc(s.name)} 1회 빼기" ${c === 0 ? "disabled" : ""}>−</button>
          <button class="plus" data-act="plus" aria-label="${esc(s.name)} 발표 1회 추가">+1</button>
        </div>
      </div>`;
    }).join("");
  }

  function renderReportSelect() {
    const sel = $("#reportStudent"), keep = sel.value;
    const L = students();
    sel.innerHTML = L.length
      ? L.map((s) => `<option value="${s.id}">${s.num != null ? s.num + ". " : ""}${esc(s.name)} (${esc(s.code)})</option>`).join("")
      : '<option value="">학생이 없어요</option>';
    if (keep && find(keep)) sel.value = keep;
    $("#printOne").disabled = !L.length;
    $("#printAll").disabled = !L.length;
  }

  function renderBoard() {
    renderReportSelect();
    const L = students(), b = bounds(state.range);
    const names = {
      day: label(state.date),
      week: label(b[0]) + " ~ " + label(b[1]),
      month: (parse(state.date).getMonth() + 1) + "월 전체",
      all: "처음부터 지금까지",
    };
    $("#rangeLabel").textContent = names[state.range];
    document.querySelectorAll("#rangeSeg button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.r === state.range)));

    if (!L.length) {
      $("#rank").innerHTML = '<li style="display:block;color:var(--muted)">학생을 추가하면 순위가 여기에 나타나요.</li>';
      $("#needChips").innerHTML = "";
      $("#heat").innerHTML = "";
      $("#avgVal").textContent = "0";
      return;
    }

    const rows = L.map((s) => ({ s, n: countIn(s, b) })).sort((a, c) => c.n - a.n || (a.s.num ?? 999) - (c.s.num ?? 999));
    const max = Math.max(1, rows[0].n);
    const avg = rows.reduce((a, r) => a + r.n, 0) / rows.length;
    $("#avgVal").textContent = avg.toFixed(1);

    let prev = null, rank = 0;
    $("#rank").innerHTML = rows.map((r, i) => {
      if (r.n !== prev) { rank = i + 1; prev = r.n; }
      const medal = r.n > 0 && rank <= 3 ? ` medal m${rank}` : "";
      return `<li class="t${colorIndex(r.s)}${medal}">
        <span class="no">${rank}</span>
        <span class="nm" title="${esc(r.s.name)}">${esc(r.s.name)}</span>
        <span class="bar"><i style="width:${(r.n / max) * 100}%"></i><span class="avg" style="left:calc(${Math.min(avg / max, 1) * 100}% - 1px)"></span></span>
        <span class="n">${r.n}</span>
      </li>`;
    }).join("");

    const need = rows.filter((r) => r.n === 0);
    $("#needChips").innerHTML = need.length
      ? need.map((r) => `<span class="chip">${esc(r.s.name)}</span>`).join("")
      : '<span class="chip ok">모든 친구가 발표했어요 🎉</span>';

    // 최근 평일 10일
    const days = [];
    let cur = state.date;
    while (days.length < 10) {
      const w = parse(cur).getDay();
      if (w !== 0 && w !== 6) days.unshift(cur);
      cur = addDays(cur, -1);
    }
    const lvl = (n) => (n === 0 ? "" : n === 1 ? "h1" : n <= 3 ? "h2" : "h3");
    $("#heat").innerHTML = `<table><thead><tr><th></th>${days.map((d) => `<th>${parse(d).getDate()}<br>${DOW[parse(d).getDay()]}</th>`).join("")}</tr></thead>
      <tbody>${L.map((s) => `<tr><th class="l" title="${esc(s.name)}">${esc(s.name)}</th>${days.map((d) => { const n = dayCount(s, d); return `<td><span class="${lvl(n)}">${n || ""}</span></td>`; }).join("")}</tr>`).join("")}</tbody></table>`;
  }

  function renderRoster() {
    const L = students(), body = $("#rosterBody");
    $("#rosterCount").textContent = L.length ? L.length + "명" : "";
    if (!L.length) {
      body.innerHTML = '<tr><td colspan="5" style="color:var(--muted);padding:16px 6px">왼쪽에서 학생을 추가해 주세요.</td></tr>';
      return;
    }
    body.innerHTML = L.map((s) => `<tr data-id="${s.id}">
      <td class="code">${esc(s.code)}</td>
      <td><input class="num" id="num-${s.id}" value="${s.num ?? ""}" inputmode="numeric" aria-label="${esc(s.name)} 번호"></td>
      <td><input id="nm-${s.id}" value="${esc(s.name)}" aria-label="${esc(s.name)} 이름"></td>
      <td>${total(s)}회</td>
      <td><div class="row" style="flex-wrap:nowrap;gap:4px"><button class="rep" data-rep="${s.id}" aria-label="${esc(s.name)} 개인 현황표 출력">📄 현황표</button><button class="del" data-del="${s.id}">삭제</button></div></td>
    </tr>`).join("");
  }

  function render() {
    $("#dateInput").value = state.date;
    $("#className").value = state.data.className;
    document.title = (state.data.className ? state.data.className + " " : "") + "발표왕";
    renderSummary();
    if (state.view === "record") renderGrid();
    if (state.view === "board") renderBoard();
    if (state.view === "manage") renderRoster();
  }

  function setView(v) {
    state.view = v;
    document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === v)));
    ["record", "board", "manage"].forEach((x) => { $("#view-" + x).hidden = x !== v; });
    render();
  }

  /* ---------- 기록 바꾸기 ---------- */
  function change(id, delta, date) {
    const s = find(id);
    if (!s) return;
    date = date || state.date;
    s.byDate = s.byDate || {};
    s.byDate[date] = Math.max(0, (s.byDate[date] || 0) + delta);
    if (s.byDate[date] === 0) delete s.byDate[date];
    save();
    render();
    if (delta > 0) {
      const el = document.querySelector(`.tile[data-id="${id}"] [data-count]`);
      if (el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
    }
  }

  /* ---------- 학생 추가 / 수정 / 삭제 ---------- */
  function nextCode(offset) {
    const nums = state.data.students.map((s) => parseInt(s.code.replace(/\D/g, ""), 10) || 0);
    return "S" + String(Math.max(0, ...nums) + 1 + offset).padStart(3, "0");
  }
  function makeId() { return "st-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function addStudents(entries) {
    entries.forEach((e) => {
      // 추가할 때마다 목록이 늘어나므로 매번 "현재 가장 큰 번호 + 1"
      state.data.students.push({ id: makeId(), code: nextCode(0), name: e.name, num: e.num, byDate: {} });
    });
    save();
    render();
    toast(entries.length + "명을 추가했어요");
  }

  function removeStudent(id) {
    const idx = state.data.students.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const [removed] = state.data.students.splice(idx, 1);
    save();
    render();
    toast(removed.name + " 학생을 삭제했어요", () => {
      state.data.students.push(removed);
      save();
      render();
    });
  }

  /* ---------- 발표자 뽑기 ----------
     선택한 기간에서 발표 횟수가 가장 적은 친구들만 후보가 되고,
     그 후보 중에서 한 명을 무작위로 뽑습니다. */
  function candidates() {
    const L = students();
    if (!L.length) return { pool: [], min: 0 };
    const b = bounds(state.basis);
    const scored = L.map((s) => ({ s, n: countIn(s, b) }));
    const min = Math.min(...scored.map((x) => x.n));
    return { pool: scored.filter((x) => x.n === min).map((x) => x.s), min };
  }
  const basisName = { all: "전체 누적", week: "이번 주", day: "선택한 날" };

  function renderPool(highlightId) {
    const { pool, min } = candidates();
    document.querySelectorAll("#pickBasis button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.b === state.basis)));
    if (!pool.length) { $("#pickPool").innerHTML = '<span class="label">먼저 학생을 추가해 주세요.</span>'; return; }
    $("#pickPool").innerHTML =
      `<span class="label">후보 ${pool.length}명 · ${basisName[state.basis]} ${min}회</span>` +
      pool.map((s) => `<span class="${s.id === highlightId ? "hit" : ""}">${esc(s.name)}</span>`).join("");
  }

  function openPicker() {
    state.pickedId = null;
    $("#pickName").textContent = "두근두근";
    $("#pickName").className = "pick-name";
    $("#pickMeta").textContent = "버튼을 눌러 뽑아 보세요";
    $("#pickPlus").hidden = true;
    $("#drawBtn").textContent = "뽑기!";
    renderPool();
    $("#picker").hidden = false;
    $("#drawBtn").focus();
  }
  function closePicker() { $("#picker").hidden = true; $("#openPicker").focus(); }

  let rolling = false;
  function draw() {
    const { pool } = candidates();
    if (!pool.length || rolling) return;
    rolling = true;
    $("#drawBtn").disabled = true;
    $("#pickPlus").hidden = true;
    const box = $("#pickName");
    box.className = "pick-name rolling";
    const winner = pool[Math.floor(Math.random() * pool.length)];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const steps = reduce || pool.length === 1 ? 0 : 14;
    let i = 0;
    const tick = () => {
      if (i < steps) {
        box.textContent = pool[Math.floor(Math.random() * pool.length)].name;
        i++;
        setTimeout(tick, 60 + i * 12); // 점점 느려지는 효과
        return;
      }
      box.textContent = winner.name;
      box.className = "pick-name done";
      $("#pickMeta").textContent = `${winner.code} · 누적 ${total(winner)}회 발표`;
      state.pickedId = winner.id;
      renderPool(winner.id);
      $("#pickPlus").hidden = false;
      $("#drawBtn").textContent = "다시 뽑기";
      $("#drawBtn").disabled = false;
      rolling = false;
    };
    tick();
  }

  /* ---------- A4 개인 발표 현황표 ----------
     학생 한 명당 A4 한 장: 요약 숫자, 월별 그래프, 최근 4주 달력,
     날짜별 기록, 선생님 한마디 칸, 확인 서명란 */
  function monthKey(s) { return s.slice(0, 7); }
  function monthLabel(k) { return parseInt(k.slice(5), 10) + "월"; }

  function monthRange() {
    // 기록이 있는 첫 달부터 선택한 날짜의 달까지, 최대 12개월 (최소 6개월)
    const end = parse(state.date);
    const allDates = state.data.students.flatMap((s) => Object.keys(s.byDate || {})).sort();
    let start = allDates.length ? parse(allDates[0]) : end;
    const months = [];
    const cur = new Date(end.getFullYear(), end.getMonth(), 1);
    while (months.length < 12) {
      months.unshift(toStr(cur).slice(0, 7));
      if (cur <= new Date(start.getFullYear(), start.getMonth(), 1) && months.length >= 6) break;
      cur.setMonth(cur.getMonth() - 1);
    }
    return months;
  }

  function monthChart(s, months) {
    const L = state.data.students;
    const mine = months.map((m) => Object.entries(s.byDate || {}).filter(([k]) => monthKey(k) === m).reduce((a, [, v]) => a + v, 0));
    const avg = months.map((m) => (L.length ? L.reduce((a, st) => a + Object.entries(st.byDate || {}).filter(([k]) => monthKey(k) === m).reduce((x, [, v]) => x + v, 0), 0) / L.length : 0));
    const W = 700, H = 150, padL = 34, padB = 26, padT = 18, plotW = W - padL - 10, plotH = H - padT - padB;
    const maxV = Math.max(4, ...mine, ...avg);
    const step = maxV <= 8 ? 2 : maxV <= 20 ? 5 : 10;
    const top = Math.ceil(maxV / step) * step;
    const y = (v) => padT + plotH - (v / top) * plotH;
    const slot = plotW / months.length, bw = Math.min(46, slot * 0.55);
    let g = "";
    for (let t = 0; t <= top; t += step) {
      g += `<line x1="${padL}" x2="${W - 10}" y1="${y(t)}" y2="${y(t)}" stroke="#E3E7F5" stroke-width="1"/>`;
      g += `<text x="${padL - 6}" y="${y(t) + 4}" font-size="11" fill="#6B7092" text-anchor="end">${t}</text>`;
    }
    months.forEach((m, i) => {
      const cx = padL + slot * i + slot / 2;
      const v = mine[i];
      if (v > 0) {
        g += `<rect x="${cx - bw / 2}" y="${y(v)}" width="${bw}" height="${y(0) - y(v)}" rx="5" fill="#FF8FAB"/>`;
        g += `<text x="${cx}" y="${y(v) - 5}" font-size="12" font-weight="700" fill="#2F3350" text-anchor="middle">${v}</text>`;
      }
      g += `<text x="${cx}" y="${H - 8}" font-size="12" fill="#4B5072" text-anchor="middle">${monthLabel(m)}</text>`;
    });
    const pts = months.map((m, i) => `${padL + slot * i + slot / 2},${y(avg[i])}`).join(" ");
    g += `<polyline points="${pts}" fill="none" stroke="#5A9FE8" stroke-width="2" stroke-dasharray="5 4"/>`;
    months.forEach((m, i) => { g += `<circle cx="${padL + slot * i + slot / 2}" cy="${y(avg[i])}" r="3.5" fill="#5A9FE8"/>`; });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="월별 발표 횟수와 반 평균">${g}</svg>`;
  }

  function recentWeeks(s) {
    // 선택한 날짜가 있는 주를 포함한 최근 4주, 월~금
    const d = parse(state.date);
    const monday = addDays(state.date, -((d.getDay() + 6) % 7));
    let html = '<div></div>' + ["월", "화", "수", "목", "금"].map((x) => `<div class="h">${x}</div>`).join("");
    for (let w = 3; w >= 0; w--) {
      const start = addDays(monday, -7 * w);
      const sd = parse(start);
      html += `<div class="wk">${sd.getMonth() + 1}/${sd.getDate()}~</div>`;
      for (let i = 0; i < 5; i++) {
        const day = addDays(start, i);
        const n = dayCount(s, day);
        const future = day > todayStr();
        const lvl = future ? "off" : n === 0 ? "" : n === 1 ? "l1" : n <= 3 ? "l2" : "l3";
        html += `<div class="c ${lvl}"><small>${parse(day).getDate()}일</small><b>${future ? "" : n || "·"}</b></div>`;
      }
    }
    return html;
  }

  function buildReport(s) {
    const L = state.data.students;
    const t = total(s);
    const avg = L.length ? L.reduce((a, st) => a + total(st), 0) / L.length : 0;
    const rank = 1 + L.filter((st) => total(st) > t).length;
    const mb = bounds("month");
    const monthN = countIn(s, mb);
    const dates = Object.entries(s.byDate || {}).filter(([, v]) => v > 0).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    const shown = dates.slice(0, 30);
    const first = dates.length ? dates[dates.length - 1][0] : null;
    const diff = t - avg;
    const badge = t === 0 ? "첫 발표를 기다려요" : diff >= 0.5 ? "반 평균보다 많이 발표" : diff <= -0.5 ? "조금 더 기회가 필요해요" : "반 평균만큼 발표";
    const months = monthRange();

    return `<article class="report">
      <header class="rp-head">
        <div><div class="rp-class">${esc(state.data.className || "우리 반")}</div><h1>발표 현황표 <span>🎤</span></h1></div>
        <div class="rp-date">기준일 ${label(state.date)}<br>출력일 ${label(todayStr())}</div>
      </header>

      <section class="rp-who">
        <div><div class="rp-name">${esc(s.name)}</div><div class="rp-meta">${s.num != null ? s.num + "번 · " : ""}아이디 ${esc(s.code)}${first ? " · 첫 발표 " + label(first) : ""}</div></div>
        <div class="rp-badge">${badge}</div>
      </section>

      <section class="rp-stats">
        <div class="rp-stat" style="background:#FFEADF"><div class="k">누적 발표</div><div class="v">${t}<small>회</small></div><div class="d">처음부터 기준일까지</div></div>
        <div class="rp-stat" style="background:#E2F0FF"><div class="k">반 평균</div><div class="v">${avg.toFixed(1)}<small>회</small></div><div class="d">우리 반 ${L.length}명 기준</div></div>
        <div class="rp-stat" style="background:#DDF6EF"><div class="k">반 순위</div><div class="v">${rank}<small>등 / ${L.length}명</small></div><div class="d">누적 횟수 기준</div></div>
        <div class="rp-stat" style="background:#EEE9FF"><div class="k">${parse(state.date).getMonth() + 1}월 발표</div><div class="v">${monthN}<small>회</small></div><div class="d">발표한 날 ${dates.length}일 (전체)</div></div>
      </section>

      <section class="rp-sec rp-chart">
        <h2>월별 발표 횟수</h2>
        <p class="rp-note">분홍 막대는 ${esc(s.name)}, 파란 점선은 반 평균입니다.</p>
        ${monthChart(s, months)}
      </section>

      <section class="rp-sec">
        <h2>최근 4주 기록</h2>
        <div class="rp-weeks">${recentWeeks(s)}</div>
      </section>

      <section class="rp-sec">
        <h2>날짜별 기록</h2>
        ${shown.length
          ? `<div class="rp-list">${shown.map(([k, v]) => `<div><span>${parse(k).getMonth() + 1}/${parse(k).getDate()}(${DOW[parse(k).getDay()]})</span><b>${v}회</b></div>`).join("")}</div>
             ${dates.length > shown.length ? `<p class="rp-note" style="margin-top:2mm">최근 ${shown.length}일만 표시했어요. 전체 ${dates.length}일 기록은 앱에서 볼 수 있어요.</p>` : ""}`
          : '<p class="rp-note">아직 발표한 날이 없어요.</p>'}
      </section>

      <section class="rp-grow">
        <div class="rp-comment"><h2 style="font-family:var(--font-display);font-weight:400;font-size:13pt">선생님 한마디</h2></div>
      </section>

      <footer class="rp-foot">
        <div>우리 반 발표왕</div>
        <div class="rp-sign"><div>담임 확인 <span>&nbsp;</span></div><div>보호자 확인 <span>&nbsp;</span></div></div>
      </footer>
    </article>`;
  }

  function printReports(list) {
    if (!list.length) return;
    $("#printArea").innerHTML = list.map(buildReport).join("");
    // 글꼴이 준비된 뒤 인쇄 창을 엽니다
    const go = () => setTimeout(() => window.print(), 50);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
  }

  /* ---------- 알림 ---------- */
  let toastTimer;
  function toast(msg, undo) {
    $("#toastMsg").textContent = msg;
    $("#toastUndo").hidden = !undo;
    $("#toastUndo").onclick = () => { if (undo) undo(); $("#toast").hidden = true; };
    $("#toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $("#toast").hidden = true; }, 3500);
  }

  /* ---------- 파일 저장 ---------- */
  function downloadFile(name, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function filePrefix() { return (state.data.className || "발표기록").replace(/[\\/:*?"<>|]/g, "_"); }

  function exportCsv() {
    const L = students();
    if (!L.length) { $("#backupMsg").textContent = "내보낼 기록이 없어요."; return; }
    const dates = [...new Set(L.flatMap((s) => Object.keys(s.byDate || {})))].sort();
    const q = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const lines = [["아이디", "번호", "이름", "누적", ...dates].map(q).join(",")]
      .concat(L.map((s) => [s.code, s.num ?? "", s.name, total(s), ...dates.map((d) => dayCount(s, d))].map(q).join(",")));
    downloadFile(filePrefix() + "_" + todayStr() + ".csv", "﻿" + lines.join("\r\n"), "text/csv;charset=utf-8");
    $("#backupMsg").textContent = "CSV 파일을 저장했어요. 엑셀에서 열 수 있어요.";
  }
  function exportJson() {
    downloadFile(filePrefix() + "_백업_" + todayStr() + ".json", JSON.stringify(state.data, null, 2), "application/json");
    $("#backupMsg").textContent = "백업 파일을 저장했어요.";
  }
  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        if (!d || !Array.isArray(d.students)) throw new Error("형식");
        const ok = d.students.every((s) => s && typeof s.name === "string" && typeof s.code === "string");
        if (!ok) throw new Error("형식");
        state.data = {
          className: typeof d.className === "string" ? d.className : "",
          students: d.students.map((s) => ({ id: s.id || makeId(), code: s.code, name: s.name, num: s.num ?? null, byDate: s.byDate || {} })),
        };
        save();
        render();
        $("#backupMsg").textContent = `백업을 불러왔어요. 학생 ${state.data.students.length}명`;
      } catch (e) {
        $("#backupMsg").textContent = "이 파일은 발표왕 백업 파일이 아니에요. '백업 파일 저장'으로 만든 .json 파일을 골라 주세요.";
      }
    };
    reader.readAsText(file);
  }

  /* ---------- 이벤트 연결 ---------- */
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));

  $("#grid").addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (go) { setView(go.dataset.go); return; }
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const id = btn.closest(".tile").dataset.id;
    const s = find(id);
    if (btn.dataset.act === "plus") {
      const d = state.date;
      change(id, 1, d);
      toast(s.name + " 발표 +1 👏", () => change(id, -1, d));
    } else {
      change(id, -1);
    }
  });

  $("#rangeSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    state.range = b.dataset.r;
    renderBoard();
  });

  $("#dateInput").addEventListener("change", (e) => { if (e.target.value) { state.date = e.target.value; render(); } });
  $("#prevDay").addEventListener("click", () => { state.date = addDays(state.date, -1); render(); });
  $("#nextDay").addEventListener("click", () => { state.date = addDays(state.date, 1); render(); });
  $("#todayBtn").addEventListener("click", () => { state.date = todayStr(); render(); });

  $("#className").addEventListener("change", (e) => {
    state.data.className = e.target.value.trim().slice(0, 30);
    save();
    render();
  });

  $("#addOne").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#addName").value.trim();
    if (!name) return;
    const n = parseInt($("#addNum").value, 10);
    addStudents([{ name: name.slice(0, 20), num: isNaN(n) ? null : n }]);
    $("#addName").value = "";
    $("#addNum").value = isNaN(n) ? "" : String(n + 1);
    $("#addName").focus();
  });

  $("#addMany").addEventListener("submit", (e) => {
    e.preventDefault();
    const lines = $("#bulk").value.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const entries = lines.map((l) => {
      const m = l.match(/^(\d{1,3})[\s.,)\t-]+(.+)$/);
      return m ? { num: +m[1], name: m[2].trim().slice(0, 20) } : { num: null, name: l.slice(0, 20) };
    });
    addStudents(entries);
    $("#bulk").value = "";
  });

  $("#rosterBody").addEventListener("change", (e) => {
    const tr = e.target.closest("tr");
    if (!tr) return;
    const s = find(tr.dataset.id);
    if (!s) return;
    if (e.target.id.startsWith("nm-")) {
      const v = e.target.value.trim();
      if (v) s.name = v.slice(0, 20);
    }
    if (e.target.id.startsWith("num-")) {
      const n = parseInt(e.target.value, 10);
      s.num = isNaN(n) ? null : n;
    }
    save();
    render();
  });

  $("#printOne").addEventListener("click", () => {
    const s = find($("#reportStudent").value);
    if (s) printReports([s]);
  });
  $("#printAll").addEventListener("click", () => printReports(students()));

  $("#rosterBody").addEventListener("click", (e) => {
    const rep = e.target.closest("[data-rep]");
    if (rep) { const s = find(rep.dataset.rep); if (s) printReports([s]); return; }
    const b = e.target.closest("[data-del]");
    if (!b) return;
    if (b.classList.contains("arm")) { removeStudent(b.dataset.del); return; }
    // 한 번 더 눌러야 삭제 (실수 방지)
    document.querySelectorAll(".del.arm").forEach((x) => { x.classList.remove("arm"); x.textContent = "삭제"; });
    b.classList.add("arm");
    b.textContent = "정말 삭제";
    setTimeout(() => { b.classList.remove("arm"); b.textContent = "삭제"; }, 3000);
  });

  $("#exportCsv").addEventListener("click", exportCsv);
  $("#exportJson").addEventListener("click", exportJson);
  $("#importJson").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) importJson(f);
    e.target.value = "";
  });

  // 발표자 뽑기
  $("#openPicker").addEventListener("click", openPicker);
  $("#closePicker").addEventListener("click", closePicker);
  $("#picker").addEventListener("click", (e) => { if (e.target.id === "picker") closePicker(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#picker").hidden) closePicker(); });
  $("#drawBtn").addEventListener("click", draw);
  $("#pickBasis").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || rolling) return;
    state.basis = b.dataset.b;
    renderPool(state.pickedId);
  });
  $("#pickPlus").addEventListener("click", () => {
    if (!state.pickedId) return;
    const s = find(state.pickedId);
    change(state.pickedId, 1, state.date);
    toast(s.name + " 발표 +1 👏");
    $("#pickPlus").hidden = true;
    $("#pickMeta").textContent = `${s.code} · 누적 ${total(s)}회 발표`;
    state.pickedId = null;
    renderPool();
  });

  // 다른 탭에서 바뀐 기록 반영
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) { state.data = load(); render(); }
  });

  /* ---------- 시작 ---------- */
  render();
})();
