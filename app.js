// 번호 찾기 · 아직 안 올린 편 숨기기 · 편 창 열기 · 영상 자동 재생 · 방문·클릭 세기(Supabase site_hits, 쿠키·개인정보 없음)
(function () {
  var qs = new URLSearchParams(location.search);
  var all = qs.has("all"); // 미리보기: ?all=1 이면 예정 편도 보임
  var deep = parseInt(qs.get("n"), 10); // 프로필 링크 /salim/?n=12 → 12번 편 창을 바로 연다
  // 들어온 utm 은 90일 동안 들고 다닌다(이 기기 안). 클릭 기록 끝에 /c=계정 으로도 붙인다 — 허브→칸으로 옮겨도 이어진다
  var UK = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"], utm = {};
  UK.forEach(function (k) { var v = qs.get(k); if (v) utm[k] = v.slice(0, 100); });
  try {
    if (utm.utm_source || utm.utm_campaign) localStorage.setItem("utm", JSON.stringify({ t: Date.now(), u: utm }));
    else { var su = JSON.parse(localStorage.getItem("utm") || "null"); if (su && Date.now() - su.t < 90 * 864e5) utm = su.u; }
  } catch (e) {}
  var camp = /^[a-z0-9_.]{1,40}$/.test(utm.utm_campaign || "") ? utm.utm_campaign : "";
  if (deep) { // n 만 빼고 utm 등 나머지는 주소에 남긴다
    var rest = new URLSearchParams(location.search); rest.delete("n");
    history.replaceState(null, "", location.pathname + (rest.toString() ? "?" + rest : "") + "#n" + String(deep).padStart(2, "0"));
  }
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // 오늘(한국 시간) 이전 공개일만 보이기 · 어제·오늘 편엔 NEW
  var now = Date.now() + 9 * 3600e3;
  var today = new Date(now).toISOString().slice(0, 10), yday = new Date(now - 864e5).toISOString().slice(0, 10);
  $$("[data-open]").forEach(function (el) {
    var d = el.dataset.open;
    if (!all && d > today) el.classList.add("hide");
    else if (d >= yday && el.classList.contains("slide")) el.insertAdjacentHTML("beforeend", '<span class="new">NEW</span>');
  });

  // 이번 주 새로 = 공개 7일 안 편. 너무 적으면 최신 3편은 남긴다.
  var wk = new Date(now - 6 * 864e5).toISOString().slice(0, 10);
  $$(".reel.recent").forEach(function (r) {
    $$(".slide:not(.hide)", r).forEach(function (s, i) {
      if (i >= 3 && (!s.dataset.open || s.dataset.open < wk)) s.classList.add("hide");
    });
  });

  // 편 창 아래 다른 편: 아직 안 올린 편은 빼고 앞의 3개만
  $$(".also").forEach(function (n) {
    $$(".al:not(.hide)", n).forEach(function (a, i) { if (i >= 3) a.classList.add("hide"); });
  });

  // 보이는 편이 하나도 없으면 첫 편 날짜를 알려 준다
  $$(".reel,.strip,.grid").forEach(function (r) {
    var ks = $$("[data-open]", r);
    if (!ks.length || $$("[data-open]:not(.hide)", r).length || (r.classList.contains("grid") && $(".reel .soon"))) return;
    var d = ks.map(function (k) { return k.dataset.open; }).sort()[0].split("-");
    var msg = "첫 편은 " + (+d[1]) + "월 " + (+d[2]) + "일에 올라옵니다";
    // 허브: 아직 안 열린 채널은 큰 카드 대신 아래쪽 한 줄로 (날짜는 이름 밑 작은 글씨)
    if (r.classList.contains("strip")) { var ch = r.closest(".ch"); ch.classList.add("wait"); $("small", ch).textContent = msg; ch.parentNode.appendChild(ch); return; }
    else r.insertAdjacentHTML("beforeend", '<p class="soon">' + msg + "</p>");
  });

  // 첫 화면: 지금 보이는 최신 편(쿠팡 링크 있는 편)의 버튼을 위에 꺼내 둔다 → 들어오자마자 한 번에 쿠팡
  var hero = $("#hero"), bar = $("#bar");
  var top = $$(".ep:not(.hide)").filter(function (ep) { return $(".buy[href]", ep); })[0];
  if (hero && top) {
    var id = top.id, nn = id.slice(1);
    hero.innerHTML = '<span class="badge">' + nn + '번 · 최신 영상</span>' + $("h2", top).outerHTML +
      $(".buys", top).outerHTML + '<a class="more-l" href="#' + id + '" data-ev="open/' + slug() + "/" + nn + '/top">영상·한 장 표 보기 ›</a>';
    $$(".buy[data-ev]", hero).forEach(function (b) { b.dataset.ev += "/top"; }); // 첫 화면 버튼 클릭은 /top 으로 따로 센다
    hero.hidden = false;
    if (bar) {
      bar.href = "#" + id; bar.dataset.ev = "bar/" + slug() + "/" + nn;
      bar.textContent = nn + "번 쿠팡 링크 바로 보기 ›";
      bar.hidden = false;
      // 첫 화면 버튼이 보이는 동안은 숨기고, 내려가면 나타난다
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (es) { bar.classList.toggle("away", es[0].isIntersecting); }).observe(hero);
      }
    }
  }
  function slug() { return location.pathname.split("/").filter(Boolean).pop() || "hub"; }

  // 방문(view)·쿠팡 클릭(click)을 Supabase 표 site_hits 에 한 줄씩 넣는다. IP·쿠키 없음, vid = 이 브라우저의 무작위 번호.
  // 로봇(webdriver)·로컬 미리보기·HIT 설정 없음 → 보내지 않는다.
  var H = window.HIT, live = !!H && !navigator.webdriver && /^https:$/.test(location.protocol) &&
    !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var vid = "";
  try { vid = localStorage.getItem("vid") || ""; if (!vid) { vid = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); localStorage.setItem("vid", vid); } } catch (e) {}
  function hit(event, item) {
    if (!live) return;
    var row = { event: event, site: location.hostname, path: location.pathname.slice(0, 300), item: item || null,
      ref: document.referrer ? document.referrer.split("/").slice(0, 3).join("/").slice(0, 300) : null, vid: vid || null };
    UK.forEach(function (k) { row[k] = utm[k] || null; });
    var h = { "apikey": H.key, "Content-Type": "application/json", "Prefer": "return=minimal" };
    if (!/^sb_/.test(H.key)) h.Authorization = "Bearer " + H.key; // 옛 anon 키(JWT)일 때만
    try { fetch(H.url + "/rest/v1/site_hits", { method: "POST", headers: h, body: JSON.stringify(row), keepalive: true }).catch(function () {}); } catch (e) {}
  }
  hit("view");

  // 이 기기 안 클릭 기록 — ?debug 미리보기 확인용
  function count(ev) {
    if (camp) ev += "/c=" + camp;
    try {
      var t = JSON.parse(localStorage.getItem("clicks") || "{}");
      t[ev] = (t[ev] || 0) + 1;
      localStorage.setItem("clicks", JSON.stringify(t));
    } catch (e) {}
    if (/^click\//.test(ev)) hit("click", ev.split("/c=")[0].split("/").slice(2).join("/").slice(0, 40)); // 예: 05/2 · 05/2/top
    if (qs.has("debug")) showDebug();
  }
  function showDebug() {
    var d = $("#dbg") || document.body.appendChild(Object.assign(document.createElement("pre"), { id: "dbg" }));
    try { d.textContent = JSON.stringify(JSON.parse(localStorage.getItem("clicks") || "{}"), null, 1); } catch (e) {}
  }
  if (qs.has("debug")) showDebug();
  if (deep) count("deep/" + slug() + "/" + String(deep).padStart(2, "0")); // 프로필 링크로 바로 들어온 수

  // 영상: 보일 때만 받아서 재생(데이터 아끼기)
  var ready = false, seen = [];
  window.addEventListener("load", function () {
    setTimeout(function () { ready = true; seen.forEach(play); }, 1500);
  });
  function play(v) {
    if (!v) return;
    if (!v.src && v.dataset.src) v.src = v.dataset.src;
    var p = v.play(); if (p && p.catch) p.catch(function () {});
  }
  function stop(v) { if (v && v.src) v.pause(); }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = $("video", e.target);
        if (e.isIntersecting) { if (ready) play(v); else seen.push(v); }
        else { stop(v); seen = seen.filter(function (x) { return x !== v; }); }
      });
    }, { threshold: 0.6 });
    $$(".slide").forEach(function (s) { io.observe(s); });
    var ro = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); ro.unobserve(e.target); } });
    }, { threshold: 0.1 });
    $$(".tile,.ch").forEach(function (t, i) { t.classList.add("rise"); t.style.transitionDelay = (i % 3) * 60 + "ms"; ro.observe(t); });
    // 탭이 뒤에서 열리면 감시가 늦게 올 수 있다 → 1.2초 뒤 화면 안에 있는 것은 그냥 보이게
    setTimeout(function () { $$(".rise:not(.in)").forEach(function (t) { if (t.getBoundingClientRect().top < innerHeight) t.classList.add("in"); }); }, 1200);
  }

  // 편 창: #n03 이면 아래에서 올라오는 창을 연다. 뒤로 가기 = 닫기.
  var cur = null, pushed = false;
  function sync() {
    var el = /^#n\d\d$/.test(location.hash) ? $(location.hash) : null;
    if (el && el.classList.contains("hide")) el = null;
    if (cur && cur !== el) { cur.classList.remove("open"); stop($("video", cur)); }
    cur = el;
    document.body.classList.toggle("lock", !!el);
    $$(".slide video").forEach(function (v) { el ? stop(v) : 0; });
    if (el) { el.classList.add("open"); el.scrollTop = 0; play($("video", el)); }
  }
  function openEp(id, replace) {
    history[replace ? "replaceState" : "pushState"](null, "", "#" + id);
    if (!replace) pushed = true;
    sync();
  }
  function close() {
    if (pushed) { pushed = false; history.back(); }
    else { history.replaceState(null, "", location.pathname + location.search); sync(); }
  }
  window.addEventListener("popstate", function () { pushed = false; sync(); });
  $$(".ep").forEach(function (ep) {
    ep.addEventListener("click", function (e) { if (e.target === ep) close(); }); // 어두운 바깥 누르면 닫기
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && cur) close(); });

  document.addEventListener("click", function (e) {
    var a = e.target.closest("a");
    if (!a) return;
    if (a.hasAttribute("data-close")) { e.preventDefault(); close(); return; }
    if (a.dataset.ev) count(a.dataset.ev);
    var h = a.getAttribute("href") || "";
    if (/^#n\d\d$/.test(h)) { e.preventDefault(); openEp(h.slice(1), !!cur); return; } // 창 안 이전·다음은 기록 안 쌓음
    // 바깥(쿠팡)으로 나가는 링크는 신호가 나갈 틈을 잠깐 준다
    if (a.dataset.ev && /^https?:/.test(h) && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      setTimeout(function () { location.href = a.href; }, 180);
    }
  });

  // 이전·다음 버튼 중 아직 안 올린 편은 감춘다
  $$(".pn a").forEach(function (a) { var t = $(a.getAttribute("href")); if (!t || t.classList.contains("hide")) a.classList.add("hide"); });
  sync(); // 주소에 #n03 이 붙어 들어오면 바로 연다

  // 번호로 찾기
  var q = $("#q"), go = $("#go");
  if (!q) return;
  function find() {
    var n = parseInt(q.value, 10);
    if (!n) return;
    var id = "n" + String(n).padStart(2, "0"), el = document.getElementById(id);
    if (!el || el.classList.contains("hide")) {
      q.value = ""; q.placeholder = n + "번은 아직 없어요";
      var f = q.form; f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake");
      return;
    }
    count("find/" + slug() + "/" + id.slice(1));
    q.blur(); q.value = "";
    openEp(id);
  }
  go.addEventListener("click", find);
  q.addEventListener("keydown", function (e) { if (e.key === "Enter") find(); });
})();
