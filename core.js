(function () {
  var RATE = 0.5; // сомони за 1 минуту
  var KEY = 'billiard-timer-v1';
  var COUNT = 4;
  var MAX_HISTORY = 2000;

  var PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';
  var STOP = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>';

  var state = { tables: [], history: [], debts: [] };
  for (var i = 0; i < COUNT; i++) state.tables.push({ start: null, sec: 0 });

  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && saved.tables && saved.tables.length === COUNT) {
      state.tables = saved.tables;
      state.history = Array.isArray(saved.history) ? saved.history : [];
      state.debts = Array.isArray(saved.debts) ? saved.debts : [];
    }
  } catch (e) {}

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtTime(sec) {
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return pad(h) + ':' + pad(m) + ':' + pad(s);
  }
  function costOf(sec) { return sec / 60 * RATE; }
  function money(v) { return v.toFixed(2); }
  function hhmm(ts) { var d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function fmtDate(ts) { var d = new Date(ts); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + ' ' + hhmm(ts); }
  function dayKey(ts) { var d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dayLabel(ts) {
    if (dayKey(ts) === dayKey(Date.now())) return 'Сегодня';
    return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function plural(n, f) {
    var a = n % 10, b = n % 100;
    if (a === 1 && b !== 11) return f[0];
    if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return f[1];
    return f[2];
  }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function btn(cls, text, fn, id) {
    var b = el('button', cls, text);
    b.type = 'button';
    if (id) b.id = id;
    b.addEventListener('click', fn);
    return b;
  }

  var grid = $('grid');
  var statusEl = $('status');
  var badge = $('badge');
  var dayTotalEl = $('day-total');
  var allTotalEl = $('all-total');
  var byTableEl = $('by-table');
  var listEl = $('history-list');
  var clearBox = $('clear-box');
  var cards = [];

  state.tables.forEach(function (t, idx) {
    var card = document.createElement('section');
    card.className = 'card';
    card.innerHTML =
      '<div class="card-head"><h3>Стол ' + (idx + 1) + '</h3><span class="pill"></span></div>' +
      '<div class="time">00:00:00</div>' +
      '<div class="cost-row"><span class="cost-label"></span><span class="cost">0.00 <small>смн</small></span></div>' +
      '<button type="button" class="toggle" id="toggle-' + (idx + 1) + '"></button>';
    grid.appendChild(card);
    var refs = {
      card: card,
      pill: card.querySelector('.pill'),
      time: card.querySelector('.time'),
      label: card.querySelector('.cost-label'),
      cost: card.querySelector('.cost'),
      btn: card.querySelector('button')
    };
    refs.btn.addEventListener('click', function () { toggle(idx); });
    cards.push(refs);
  });

  function elapsed(t) {
    return t.start ? Math.max(0, Math.floor((Date.now() - t.start) / 1000)) : t.sec;
  }

  function renderTables() {
    var running = 0;
    state.tables.forEach(function (t, idx) {
      var r = cards[idx];
      var sec = elapsed(t);
      var on = !!t.start;
      if (on) running++;
      r.card.classList.toggle('running', on);
      r.pill.textContent = on ? 'Идёт игра' : 'Свободен';
      r.time.textContent = fmtTime(sec);
      r.label.textContent = on ? 'Сейчас к оплате' : (sec > 0 ? 'Итого к оплате' : 'К оплате');
      r.cost.innerHTML = money(costOf(sec)) + ' <small>смн</small>';
      var want = on ? 'stop' : 'start';
      if (r.btn.getAttribute('data-mode') !== want) {
        r.btn.setAttribute('data-mode', want);
        r.btn.innerHTML = (on ? STOP : PLAY) + '<span>' + (on ? 'Стоп' : 'Старт') + '</span>';
      }
    });
    statusEl.textContent = 'Идёт игра: ' + running + ' из ' + COUNT + ' столов';
    badge.hidden = running === 0;
    badge.textContent = running;
  }

  function renderHistory() {
    var h = state.history;
    var today = dayKey(Date.now());
    var all = 0, day = 0;
    var per = [];
    for (var i = 0; i < COUNT; i++) per.push(0);
    h.forEach(function (e) {
      all += e.cost;
      if (dayKey(e.end) === today) day += e.cost;
      if (e.table >= 1 && e.table <= COUNT) per[e.table - 1] += e.cost;
    });
    allTotalEl.textContent = money(all) + ' смн';
    dayTotalEl.textContent = money(day) + ' смн';

    byTableEl.innerHTML = '';
    per.forEach(function (v, i) {
      var s = el('div', 'stat');
      s.appendChild(el('div', 'stat-label', 'Стол ' + (i + 1) + ', всего'));
      s.appendChild(el('div', 'stat-value', money(v) + ' смн'));
      byTableEl.appendChild(s);
    });

    listEl.innerHTML = '';
    if (!h.length) {
      listEl.appendChild(el('p', 'empty', 'Пока пусто. Когда остановишь стол, игра появится здесь.'));
      renderClear(false);
      return;
    }

    var groups = [];
    var map = {};
    h.forEach(function (e) {
      var k = dayKey(e.end);
      if (!map[k]) { map[k] = { ts: e.end, sum: 0, items: [] }; groups.push(map[k]); }
      map[k].sum += e.cost;
      map[k].items.push(e);
    });

    var frag = document.createDocumentFragment();
    groups.forEach(function (g) {
      var box = el('div', 'day-group');
      var title = el('div', 'day-title');
      title.appendChild(el('span', '', dayLabel(g.ts)));
      title.appendChild(el('span', 'sum', money(g.sum) + ' смн'));
      box.appendChild(title);
      var ul = el('ul', 'rows');
      g.items.forEach(function (e) {
        var li = el('li');
        var main = el('div', 'row-main');
        main.appendChild(el('div', 'row-table', 'Стол ' + e.table));
        main.appendChild(el('div', 'row-sub', hhmm(e.start) + '–' + hhmm(e.end) + ' · ' + fmtTime(e.sec)));
        li.appendChild(main);
        li.appendChild(el('div', 'row-cost', money(e.cost) + ' смн'));
        ul.appendChild(li);
      });
      box.appendChild(ul);
      frag.appendChild(box);
    });
    listEl.appendChild(frag);
    renderClear(false);
  }

  function renderClear(asking) {
    clearBox.innerHTML = '';
    if (!state.history.length) return;
    if (!asking) {
      clearBox.appendChild(btn('small', 'Очистить историю', function () { renderClear(true); }, 'clear-history'));
      return;
    }
    clearBox.appendChild(el('span', '', 'Удалить всю историю и общий счёт?'));
    clearBox.appendChild(btn('small danger', 'Да, удалить', function () {
      state.history = [];
      save();
      renderHistory();
    }, 'clear-yes'));
    clearBox.appendChild(btn('small', 'Отмена', function () { renderClear(false); }, 'clear-no'));
  }

  function toggle(idx) {
    var t = state.tables[idx];
    if (t.start) {
      var now = Date.now();
      var sec = elapsed(t);
      state.history.unshift({ table: idx + 1, start: t.start, end: now, sec: sec, cost: costOf(sec) });
      if (state.history.length > MAX_HISTORY) state.history.length = MAX_HISTORY;
      t.sec = sec;
      t.start = null;
      save();
      renderTables();
      renderHistory();
    } else {
      t.start = Date.now();
      t.sec = 0;
      save();
      renderTables();
    }
  }

  window.QADR = {
    state: state, save: save, pad: pad, money: money, hhmm: hhmm, fmtDate: fmtDate, plural: plural, newId: newId,
    $: $, el: el, btn: btn,
    renderTables: renderTables, renderHistory: renderHistory, renderClear: renderClear
  };
})();
        
