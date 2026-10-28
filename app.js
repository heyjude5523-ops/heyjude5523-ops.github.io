// 번호 찾기 · 아직 안 올린 편 숨기기 · 편 창 열기 · 영상 자동 재생 · 클릭 세기(GoatCounter, 쿠키·개인정보 없음)
(function () {
  var qs = new URLSearchParams(location.search);
  var all = qs.has("all"); // 미리보기: ?all=1 이면 예정 편도 보임
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

  // 보이는 편이 하나도 없으면 첫 편 날짜를 알려 준다
  $$(".reel,.strip").forEach(function (r) {
    var ks = $$("[data-open]", r);
    if (!ks.length || $$("[data-open]:not(.hide)", r).length) return;
    var d = ks.map(function (k) { return k.dataset.open; }).sort()[0].split("-");
    var msg = "첫 편은 " + (+d[1]) + "월 " + (+d[2]) + "일에 올라옵니다";
    if (r.classList.contains("strip")) r.innerHTML = '<span class="soon">' + msg + "</span>";
    else r.insertAdjacentHTML("beforeend", '<p class="soon">' + msg + "</p>");
  });

  // 클릭 세기. GC_CODE 가 비면 이 기기 안(localStorage)에서만 센다 — 미리보기 확인용.
  function count(ev, title) {
    if (window.GC_CODE && window.goatcounter && window.goatcounter.count) {
      window.goatcounter.count({ path: ev, title: title || ev, event: true });
    } else {
      try {
        var t = JSON.parse(localStorage.getItem("clicks") || "{}");
        t[ev] = (t[ev] || 0) + 1;
        localStorage.setItem("clicks", JSON.stringify(t));
      } catch (e) {}
    }
    if (qs.has("debug")) showDebug();
  }
  function showDebug() {
    var d = $("#dbg") || document.body.appendChild(Object.assign(document.createElement("pre"), { id: "dbg" }));
    try { d.textContent = JSON.stringify(JSON.parse(localStorage.getItem("clicks") || "{}"), null, 1); } catch (e) {}
  }
  if (qs.has("debug")) showDebug();

  // 영상: 보일 때만 받아서 재생(데이터 아끼기)
  function play(v) {
    if (!v) return;
    if (!v.src && v.dataset.src) v.src = v.dataset.src;
    var p = v.play(); if (p && p.catch) p.catch(function () {});
  }
  function stop(v) { if (v && v.src) v.pause(); }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { var v = $("video", e.target); e.isIntersecting ? play(v) : stop(v); });
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
    if (a.dataset.ev) count(a.dataset.ev, a.dataset.title);
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
    count("find/" + location.pathname.split("/").filter(Boolean).pop() + "/" + id.slice(1));
    q.blur(); q.value = "";
    openEp(id);
  }
  go.addEventListener("click", find);
  q.addEventListener("keydown", function (e) { if (e.key === "Enter") find(); });
})();
