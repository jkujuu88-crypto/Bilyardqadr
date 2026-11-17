(function () {
  var Q = window.QADR;
  var state = Q.state, save = Q.save, money = Q.money, hhmm = Q.hhmm, fmtDate = Q.fmtDate;
  var plural = Q.plural, newId = Q.newId, $ = Q.$, el = Q.el, btn = Q.btn;
  var renderTables = Q.renderTables, renderHistory = Q.renderHistory, renderClear = Q.renderClear;

  /* ---------- Долги ---------- */
  var debtForm = $('debt-form');
  var debtNameIn = $('debt-name');
  var debtAmountIn = $('debt-amount');
  var debtNoteIn = $('debt-note');
  var debtErrorEl = $('debt-error');
  var debtListEl = $('debt-list');
  var debtTotalEl = $('debt-total');
  var debtCountEl = $('debt-count');
  var debtBadge = $('debt-badge');
  var debtNamesEl = $('debt-names');
  var closedBox = $('closed-box');
  var closedSummary = $('closed-summary');
  var closedList = $('closed-list');
  var pendingDelete = null;

  function showError(msg) {
    debtErrorEl.textContent = msg;
    debtErrorEl.hidden = !msg;
  }

  function findDebt(id) {
    for (var i = 0; i < state.debts.length; i++) if (state.debts[i].id === id) return state.debts[i];
    return null;
  }

  function renderDebts() {
    var open = state.debts.filter(function (d) { return !d.closed; });
    var done = state.debts.filter(function (d) { return d.closed; })
      .sort(function (a, b) { return b.closed - a.closed; });

    var sum = 0;
    open.forEach(function (d) { sum += d.amount; });
    debtTotalEl.textContent = money(sum) + ' смн';
    debtCountEl.textContent = 'Всего должны · ' + open.length + ' ' +
      plural(open.length, ['открытый долг', 'открытых долга', 'открытых долгов']);
    debtBadge.hidden = open.length === 0;
    debtBadge.textContent = open.length;

    var seen = {};
    debtNamesEl.innerHTML = '';
    state.debts.forEach(function (d) {
      var key = d.name.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      var o = document.createElement('option');
      o.value = d.name;
      debtNamesEl.appendChild(o);
    });

    debtListEl.innerHTML = '';
    if (!open.length) {
      debtListEl.appendChild(el('p', 'empty', 'Долгов нет. Запиши первый в форме выше.'));
    }
    open.forEach(function (d) {
      var card = el('div', 'debt');
      var top = el('div', 'debt-top');
      var info = el('div', 'debt-info');
      info.appendChild(el('div', 'debt-name', d.name));
      if (d.note) info.appendChild(el('div', 'debt-meta', d.note));
      info.appendChild(el('div', 'debt-meta', 'Записан ' + fmtDate(d.created)));
      top.appendChild(info);
      top.appendChild(el('div', 'debt-amount', money(d.amount) + ' смн'));
      card.appendChild(top);

      var actions = el('div', 'debt-actions');
      if (pendingDelete === d.id) {
        actions.appendChild(el('span', 'ask', 'Удалить этот долг без оплаты?'));
        actions.appendChild(btn('small danger', 'Да, удалить', function () {
          state.debts = state.debts.filter(function (x) { return x.id !== d.id; });
          pendingDelete = null;
          save();
          renderDebts();
        }));
        actions.appendChild(btn('small', 'Отмена', function () { pendingDelete = null; renderDebts(); }));
      } else {
        actions.appendChild(btn('close-debt', 'Закрыть долг', function () {
          var x = findDebt(d.id);
          if (x) { x.closed = Date.now(); save(); renderDebts(); }
        }));
        actions.appendChild(btn('small', 'Удалить', function () { pendingDelete = d.id; renderDebts(); }));
      }
      card.appendChild(actions);
      debtListEl.appendChild(card);
    });

    closedList.innerHTML = '';
    closedBox.hidden = done.length === 0;
    closedSummary.textContent = 'Закрытые долги (' + done.length + ')';
    done.slice(0, 100).forEach(function (d) {
      var li = el('li');
      var main = el('div', 'row-main');
      main.appendChild(el('div', 'row-table', d.name));
      main.appendChild(el('div', 'row-sub', (d.note ? d.note + ' · ' : '') + 'Закрыт ' + fmtDate(d.closed)));
      li.appendChild(main);
      li.appendChild(el('div', 'row-cost', money(d.amount) + ' смн'));
      li.appendChild(btn('small', 'Вернуть', function () {
        var x = findDebt(d.id);
        if (x) { x.closed = null; save(); renderDebts(); }
      }));
      closedList.appendChild(li);
    });
  }

  debtForm.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var name = debtNameIn.value.trim();
    var amount = parseFloat(debtAmountIn.value.replace(/\s/g, '').replace(',', '.'));
    if (!name) { showError('Напиши имя человека.'); debtNameIn.focus(); return; }
    if (!(amount > 0)) { showError('Напиши сумму больше нуля, например 25.'); debtAmountIn.focus(); return; }
    state.debts.unshift({ id: newId(), name: name, amount: amount, note: debtNoteIn.value.trim(), created: Date.now(), closed: null });
    save();
    debtNameIn.value = '';
    debtAmountIn.value = '';
    debtNoteIn.value = '';
    showError('');
    renderDebts();
  });

  /* ---------- Меню ---------- */
  var screens = { tables: $('screen-tables'), history: $('screen-history'), debts: $('screen-debts') };
  var tabs = { tables: $('tab-tables'), history: $('tab-history'), debts: $('tab-debts') };

  function show(name) {
    if (!screens[name]) name = 'tables';
    Object.keys(screens).forEach(function (k) {
      screens[k].hidden = k !== name;
      if (k === name) tabs[k].setAttribute('aria-current', 'page');
      else tabs[k].removeAttribute('aria-current');
    });
    if (name === 'history') renderClear(false);
    if (name !== 'debts') pendingDelete = null;
  }

  Object.keys(tabs).forEach(function (k) {
    tabs[k].addEventListener('click', function () {
      show(k);
      try { if (location.hash !== '#' + k) location.hash = k; } catch (e) {}
      window.scrollTo(0, 0);
    });
  });
  window.addEventListener('hashchange', function () { show(location.hash.replace('#', '')); });

  renderTables();
  renderHistory();
  renderDebts();
  show(location.hash.replace('#', ''));
  setInterval(renderTables, 1000);
  document.addEventListener('visibilitychange', function () { renderTables(); renderHistory(); });
})();
    
