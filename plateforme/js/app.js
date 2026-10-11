/* =====================================================================
   Interface de la plateforme (vues, édition, glisser-déposer, exports)
   ===================================================================== */
(function () {
  'use strict';
  const D = window.EDT_DATA, E = window.EDT_ENGINE, X = window.EDT_EXPORT;
  const DAYS = E.DAYS, SLOTS = E.SLOTS;
  const STORE = 'edt-francais-bba-s1-2026';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ORIGINAL = E.clone(D.ORIGINAL);
  const ORIG = Object.fromEntries(ORIGINAL.sessions.map(s => [s.id, s]));
  let state = load();
  let undoStack = [], redoStack = [];
  let A = E.analyze(state);
  const ui = Object.assign({ view: 'dashboard', level: 'L1', teacher: null, day: 0, blockMode: false, showOld: true, freeCat: 'all' }, loadUi());

  /* ---------------- Persistance ---------------- */
  function upgrade(st) {
    st.meta = Object.assign({}, ORIGINAL.meta, st.meta || {});
    st.levels.forEach(l => { l.groups = l.groups || []; l.short = l.short || l.id; l.name = l.name || l.id; });
    st.rooms.forEach(r => { r.blocked = r.blocked || []; if (r.auto === undefined) r.auto = true; r.type = r.type || 'TD'; });
    st.sessions.forEach(s => { s.groups = s.groups || []; s.levels = s.levels || []; s.room = s.room || ''; s.teacher = s.teacher || ''; s.module = s.module || ''; s.type = s.type || 'TD'; });
    return st;
  }
  function valid(st) { return st && Array.isArray(st.sessions) && Array.isArray(st.rooms) && Array.isArray(st.levels); }
  function load() {
    try { const s = JSON.parse(localStorage.getItem(STORE)); if (valid(s)) return upgrade(s); } catch (e) { /* données locales absentes */ }
    return E.clone(ORIGINAL);
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { toast('Enregistrement local impossible : ' + e.message, 'err'); } }
  function loadUi() { try { return JSON.parse(localStorage.getItem(STORE + '-ui')) || {}; } catch (e) { return {}; } }
  function saveUi() { try { localStorage.setItem(STORE + '-ui', JSON.stringify({ view: ui.view, level: ui.level, day: ui.day, showOld: ui.showOld, teacher: ui.teacher })); } catch (e) { /* ignoré */ } }

  function commit(fn, msg) {
    undoStack.push(JSON.stringify(state)); if (undoStack.length > 200) undoStack.shift();
    redoStack = [];
    fn(state); save(); refresh();
    if (msg) toast(msg);
  }
  function undo() { if (!undoStack.length) return; redoStack.push(JSON.stringify(state)); state = JSON.parse(undoStack.pop()); save(); refresh(); toast('Action annulée'); }
  function redo() { if (!redoStack.length) return; undoStack.push(JSON.stringify(state)); state = JSON.parse(redoStack.pop()); save(); refresh(); toast('Action rétablie'); }

  /* ---------------- Aides ---------------- */
  const lvl = id => state.levels.find(l => l.id === id);
  const lvShort = id => (lvl(id) || { short: id }).short;
  const levelsLabel = s => s.levels.map(lvShort).join(' + ');
  const roomById = id => state.rooms.find(r => r.id === id);
  const sessById = id => state.sessions.find(s => s.id === id);
  const when = s => `${DAYS[s.day]} ${SLOTS[s.slot]}`;
  const sLabel = s => `${levelsLabel(s)} · ${s.module} (${s.type}${s.groups.length ? ' ' + s.groups.join('+') : ''})${s.room ? ' — ' + s.room : ''}`;
  const HUES = { L1: 212, L2: 178, L3: 135, M1L: 268, M1D: 318, M2L: 28, M2D: 2 };
  function hue(id) { if (HUES[id] != null) return HUES[id]; let x = 0; for (const c of id) x = (x * 31 + c.charCodeAt(0)) % 360; return x; }
  const newId = () => 'N-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ICON = {
    dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    door: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17"/><circle cx="15" cy="12" r="1"/></svg>',
    free: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
    hist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>',
    cog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
    print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><rect x="6" y="14" width="12" height="8"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/></svg>',
    word: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m8 13 1.5 5 1.5-4 1.5 4L14 13"/></svg>',
  };

  function issuesOf(id) {
    const list = A.bySession[id] || [];
    return {
      conflicts: list.filter(i => typeof i === 'number').map(i => A.conflicts[i]),
      warnings: list.filter(i => typeof i === 'string').map(i => A.warnings[+i.slice(1)]),
    };
  }
  function levelConflictCount(levelId) {
    return A.conflicts.filter(c => c.ids.some(id => { const s = sessById(id); return s && s.levels.includes(levelId); })).length;
  }

  /* ---------------- Rendu général ---------------- */
  function refresh() {
    A = E.analyze(state);
    renderTop(); renderNav(); renderView(); saveUi();
  }
  function renderTop() {
    const m = state.meta;
    $('#brand-sub').textContent = `${m.department} · ${m.faculty} · ${m.semester} ${m.year}`;
    const pill = $('#status-pill');
    const n = A.counts.total;
    pill.className = 'pill ' + (n ? 'bad' : 'ok');
    pill.innerHTML = `<span class="dot"></span>${n ? n + ' conflit' + (n > 1 ? 's' : '') : 'Aucun conflit'}`;
    $('#btn-undo').disabled = !undoStack.length; $('#btn-redo').disabled = !redoStack.length;
  }
  const NAV = [
    ['dashboard', 'Tableau de bord', 'dash'], ['levels', 'Emplois du temps', 'cal'], ['rooms', 'Occupation des salles', 'door'],
    ['free', 'Salles libres', 'free'], ['teachers', 'Enseignants', 'user'], ['issues', 'Conflits & alertes', 'alert'],
    ['changes', 'Modifications', 'hist'], '-', ['manage', 'Salles, niveaux & données', 'cog'],
  ];
  function renderNav() {
    const changes = E.diff(ORIGINAL, state).length;
    $('#nav').innerHTML = NAV.map(n => n === '-' ? '<div class="sep"></div>' :
      `<button class="${ui.view === n[0] ? 'active' : ''}" data-act="nav" data-view="${n[0]}">${ICON[n[2]]}<span>${n[1]}</span>${n[0] === 'issues' ? `<span class="count ${A.counts.total ? '' : 'ok'}">${A.counts.total}</span>` : ''}${n[0] === 'changes' && changes ? `<span class="count ok">${changes}</span>` : ''}</button>`).join('');
  }
  function renderView() {
    const v = VIEWS[ui.view] || VIEWS.dashboard;
    const main = $('#main'); const top = main.scrollTop;
    main.innerHTML = v();
    main.scrollTop = top;
  }

  /* ---------------- Carte de séance ---------------- */
  function card(s, o = {}) {
    const iss = issuesOf(s.id);
    const orig = ORIG[s.id];
    const roomChanged = orig && orig.room !== s.room;
    const tip = [sLabel(s), when(s), ...iss.conflicts.map(c => '⚠ ' + c.message), ...iss.warnings.map(w => '• ' + w.message), s.note ? 'Remarque : ' + s.note : ''].filter(Boolean).join('\n');
    return `<div class="card ${s.type === 'Cours' ? 'cours' : ''} ${iss.conflicts.length ? 'is-conflict' : ''} ${!iss.conflicts.length && iss.warnings.length ? 'is-warn' : ''}"
      draggable="true" data-act="edit" data-id="${h(s.id)}" style="--h:${hue(s.levels[0])}" title="${h(tip)}">
      ${o.showLevel || s.levels.length > 1 ? `<div class="c-lv">${h(levelsLabel(s))}</div>` : ''}
      <div class="c-mod">${h(s.module)}</div>
      <div class="c-meta"><span class="c-type">${h(s.type)}${s.groups.length ? ' ' + h(s.groups.join('+')) : ''}</span>${o.hideRoom ? '' : `<span class="c-room ${roomChanged ? 'changed' : ''} ${!s.room ? 'missing' : ''}">${s.room ? h(s.room) : 'salle ?'}</span>`}${!o.hideRoom && roomChanged && ui.showOld ? `<span class="c-old" title="Salle d'origine">${h(orig.room || 'aucune')}</span>` : ''}${s.locked ? `<span class="c-lock" title="Salle verrouillée">${ICON.lock}</span>` : ''}</div>
      ${s.teacher && !o.hideTeacher ? `<div class="c-teach">${h(s.teacher)}</div>` : ''}
    </div>`;
  }

  function grid(sessions, o = {}) {
    let out = `<div class="grid-wrap"><table class="grid"><thead><tr><th class="corner"></th>${SLOTS.map(t => `<th>${t}</th>`).join('')}</tr></thead><tbody>`;
    for (let d = 0; d < 6; d++) {
      out += `<tr><th class="day">${DAYS[d]}</th>`;
      for (let t = 0; t < 6; t++) {
        const list = sessions.filter(s => s.day === d && s.slot === t)
          .sort((a, b) => (b.type === 'Cours') - (a.type === 'Cours') || (a.groups[0] || '').localeCompare(b.groups[0] || ''));
        const conf = list.some(s => issuesOf(s.id).conflicts.length);
        out += `<td class="cell ${conf ? 'has-conflict' : ''}" data-drop="grid" data-day="${d}" data-slot="${t}">${list.map(s => card(s, o)).join('')}${o.add ? `<button class="add" title="Ajouter une séance" data-act="add" data-day="${d}" data-slot="${t}" ${o.add.level ? `data-level="${h(o.add.level)}"` : ''} ${o.add.teacher ? `data-teacher="${h(o.add.teacher)}"` : ''}>+</button>` : ''}</td>`;
      }
      out += '</tr>';
    }
    return out + '</tbody></table></div>';
  }

  /* ---------------- VUES ---------------- */
  const VIEWS = {};

  VIEWS.dashboard = () => {
    const c = A.counts;
    const missing = A.warnings.filter(w => w.kind === 'noroom').length;
    const changes = E.diff(ORIGINAL, state);
    const roomChanges = changes.filter(d => d.kind === 'modified' && d.fields.includes('room')).length;
    const teachers = new Set(state.sessions.map(s => E.normKey(s.teacher)).filter(Boolean)).size;
    const roomProblems = c.room + c.blocked;
    let out = `<div class="page-h"><div><h1>Tableau de bord</h1><p>${h(state.meta.department)} — ${h(state.meta.semester)} ${h(state.meta.year)}</p></div></div>`;
    if (roomProblems || missing) {
      out += `<div class="hero bad"><div class="grow"><div class="t">${roomProblems} conflit${roomProblems > 1 ? 's' : ''} de salle${missing ? ` · ${missing} séance${missing > 1 ? 's' : ''} sans salle` : ''}</div>
        <p>La résolution automatique ne change que les salles : jours, horaires, enseignants et groupes restent identiques. Vous verrez chaque changement avant de l'appliquer.</p></div>
        <button class="btn primary" data-act="resolve">Résoudre automatiquement</button></div>`;
    } else {
      out += `<div class="hero ok"><div class="grow"><div class="t">Aucun conflit de salle</div><p>Chaque salle n'accueille qu'une seule séance par créneau${roomChanges ? ` · ${roomChanges} salle${roomChanges > 1 ? 's' : ''} modifiée${roomChanges > 1 ? 's' : ''} par rapport aux documents d'origine` : ''}.</p></div>
        <button class="btn" data-act="nav" data-view="changes">Voir les modifications</button><button class="btn primary" data-act="export">Exporter</button></div>`;
    }
    out += `<div class="stats">
      <div class="stat ${c.room + c.blocked ? 'bad' : 'ok'}"><div class="n">${c.room + c.blocked}</div><div class="l">Conflits de salle</div></div>
      <div class="stat ${c.teacher ? 'bad' : 'ok'}"><div class="n">${c.teacher}</div><div class="l">Conflits d'enseignant</div></div>
      <div class="stat ${c.group ? 'bad' : 'ok'}"><div class="n">${c.group}</div><div class="l">Conflits de groupe (mêmes étudiants)</div></div>
      <div class="stat ${A.warnings.length ? 'warn' : 'ok'}"><div class="n">${A.warnings.length}</div><div class="l">Alertes à vérifier</div></div>
      <div class="stat"><div class="n">${state.sessions.length}</div><div class="l">Séances · ${state.levels.length} niveaux</div></div>
      <div class="stat"><div class="n">${state.rooms.length}</div><div class="l">Salles · ${teachers} enseignants</div></div>
    </div>`;
    out += `<div class="panel"><h2>Par niveau</h2><table class="tbl"><thead><tr><th>Niveau</th><th>Groupes</th><th class="num">Séances</th><th class="num">Conflits</th><th class="num">Salles modifiées</th><th></th></tr></thead><tbody>`;
    for (const l of state.levels) {
      const ss = state.sessions.filter(s => s.levels.includes(l.id));
      const nc = levelConflictCount(l.id);
      const rc = changes.filter(d => d.kind === 'modified' && d.fields.includes('room') && d.now.levels.includes(l.id)).length;
      out += `<tr><td><span class="tab" style="--h:${hue(l.id)};padding:2px 9px;cursor:default"><span class="sw"></span>${h(l.short)}</span> ${h(l.name)}</td><td>${h(l.groups.join(', '))}</td><td class="num">${ss.length}</td>
        <td class="num" style="color:${nc ? 'var(--bad)' : 'var(--good)'};font-weight:700">${nc}</td><td class="num">${rc}</td>
        <td style="text-align:right"><button class="btn sm" data-act="open-level" data-level="${h(l.id)}">Ouvrir</button></td></tr>`;
    }
    out += '</tbody></table></div>';
    out += `<div class="panel"><h2>Comment ça marche</h2><div class="hint" style="font-size:13px;line-height:1.6">
      1. <b>Résoudre les salles</b> propose une nouvelle salle libre pour chaque séance en conflit (même type de salle, de préférence une salle déjà utilisée par le niveau, et la même salle pour une série de TD consécutifs).<br>
      2. Cliquez sur n'importe quelle séance pour la modifier ; la liste des salles indique en direct si chacune est libre ou occupée.<br>
      3. Glissez-déposez une séance pour la déplacer (vers un autre créneau, ou vers une autre salle dans « Occupation des salles »).<br>
      4. Marquez les salles utilisées par d'autres départements comme <b>indisponibles</b> (Occupation des salles → mode indisponibilité) : elles ne seront jamais proposées.<br>
      5. <b>Exporter</b> : Word (un emploi du temps par niveau, au format du département), Excel complet, impression/PDF, sauvegarde.<br>
      Toutes les modifications sont enregistrées automatiquement dans ce navigateur. Pensez à faire une sauvegarde JSON de temps en temps.</div></div>`;
    return out;
  };

  VIEWS.levels = () => {
    if (!lvl(ui.level)) ui.level = state.levels[0] && state.levels[0].id;
    const l = lvl(ui.level);
    let out = `<div class="page-h"><div><h1>Emplois du temps</h1><p>Cliquez sur une séance pour la modifier · glissez-la vers un autre créneau · « + » pour ajouter</p></div>
      <div class="actions"><label class="chk"><input type="checkbox" data-act="toggle-old" ${ui.showOld ? 'checked' : ''}> Afficher l'ancienne salle</label>
      ${l ? `<button class="btn" data-act="print-level" data-level="${h(l.id)}">${ICON.print}Imprimer</button><button class="btn" data-act="docx-level" data-level="${h(l.id)}">${ICON.word}Word</button>` : ''}
      <button class="btn primary" data-act="add" data-level="${h(ui.level || '')}">${ICON.plus}Ajouter une séance</button></div></div>`;
    out += '<div class="tabs">' + state.levels.map(x => { const n = levelConflictCount(x.id); return `<button class="tab ${x.id === ui.level ? 'active' : ''}" style="--h:${hue(x.id)}" data-act="pick-level" data-level="${h(x.id)}"><span class="sw"></span>${h(x.short)}${n ? `<span class="b">${n}</span>` : ''}</button>`; }).join('') + '</div>';
    if (!l) return out + '<div class="empty">Aucun niveau. Ajoutez-en un dans « Salles, niveaux & données ».</div>';
    out += `<p class="hint" style="margin:-4px 0 10px">${h(l.name)} — groupes ${h(l.groups.join(', ') || '—')}${l.notes ? ' — NB : ' + h(l.notes) : ''}</p>`;
    out += grid(state.sessions.filter(s => s.levels.includes(l.id)), { add: { level: l.id } });
    out += `<div class="legend" style="margin-top:10px"><span><i style="background:#fff0f0;border-color:var(--bad)"></i>Conflit</span><span><i style="background:var(--chg-soft);border-color:#e8c35a"></i>Salle modifiée</span><span><i style="background:var(--warn-soft);border-color:#e7b766"></i>Salle manquante</span><span>Cours = fond plus foncé</span></div>`;
    return out;
  };

  VIEWS.rooms = () => {
    const days = ui.day === 'all' ? [0, 1, 2, 3, 4, 5] : [ui.day];
    let out = `<div class="page-h"><div><h1>Occupation des salles</h1><p>Une ligne par salle. Glissez une séance vers une autre salle ou un autre créneau pour la déplacer.</p></div>
      <div class="actions"><button class="btn ${ui.blockMode ? 'primary' : ''}" data-act="block-mode">${ui.blockMode ? 'Terminer : indisponibilités' : 'Marquer des indisponibilités'}</button></div></div>`;
    if (ui.blockMode) out += `<div class="note-box" style="margin-bottom:12px">Mode indisponibilité : cliquez sur une case vide (ou hachurée) pour marquer la salle comme <b>indisponible</b> à ce créneau (utilisée par un autre département, travaux…). Elle ne sera plus jamais proposée à ce créneau.</div>`;
    out += '<div class="tabs">' + DAYS.map((d, i) => {
      const n = A.conflicts.filter(c => c.day === i && (c.kind === 'room' || c.kind === 'blocked')).length;
      return `<button class="tab ${ui.day === i ? 'active' : ''}" data-act="pick-day" data-day="${i}">${d}${n ? `<span class="b">${n}</span>` : ''}</button>`;
    }).join('') + `<button class="tab ${ui.day === 'all' ? 'active' : ''}" data-act="pick-day" data-day="all">Toute la semaine</button></div>`;
    for (const d of days) {
      if (days.length > 1) out += `<h2 style="font-size:15px;margin:18px 0 8px">${DAYS[d]}</h2>`;
      out += `<div class="grid-wrap ${ui.blockMode ? 'blockmode' : ''}"><table class="grid compact mini"><thead><tr><th class="corner">Salle</th>${SLOTS.map(t => `<th>${t}</th>`).join('')}</tr></thead><tbody>`;
      for (const r of state.rooms) {
        const used = state.sessions.filter(s => s.room === r.id).length;
        out += `<tr><th class="roomh">${h(r.id)}<small>${h(r.type)}${r.capacity ? ' · ' + r.capacity + ' pl.' : ''}${r.auto === false ? ' · manuel' : ''} · ${used} séances</small></th>`;
        for (let t = 0; t < 6; t++) {
          const list = state.sessions.filter(s => s.day === d && s.slot === t && s.room === r.id);
          const blocked = r.blocked.includes(d + '-' + t);
          const bad = list.length > 1 || (blocked && list.length);
          out += `<td class="cell ${blocked ? 'blocked' : ''} ${bad ? 'has-conflict' : ''}" data-drop="room" data-room="${h(r.id)}" data-day="${d}" data-slot="${t}" ${ui.blockMode ? 'data-act="toggle-block"' : ''}>${list.map(s => card(s, { showLevel: true, hideRoom: true })).join('')}${!ui.blockMode && !list.length && !blocked ? `<button class="add" data-act="add" data-room="${h(r.id)}" data-day="${d}" data-slot="${t}">+</button>` : ''}</td>`;
        }
        out += '</tr>';
      }
      const orphan = state.sessions.filter(s => s.day === d && (!s.room || !roomById(s.room)));
      if (orphan.length) {
        out += `<tr><th class="roomh" style="color:var(--warn)">Sans salle / inconnue</th>`;
        for (let t = 0; t < 6; t++) out += `<td class="cell" data-drop="none">${orphan.filter(s => s.slot === t).map(s => card(s, { showLevel: true })).join('')}</td>`;
        out += '</tr>';
      }
      out += '</tbody></table></div>';
    }
    return out;
  };

  VIEWS.free = () => {
    const cats = ['all', 'Amphi', 'SM', 'TD'];
    let out = `<div class="page-h"><div><h1>Salles libres</h1><p>Pour chaque créneau, les salles qui ne sont ni occupées ni indisponibles. Cliquez sur une salle pour y créer une séance.</p></div></div>`;
    out += '<div class="tabs">' + cats.map(c => `<button class="tab ${ui.freeCat === c ? 'active' : ''}" data-act="free-cat" data-cat="${c}">${c === 'all' ? 'Toutes' : c === 'SM' ? 'Salles SM' : c === 'TD' ? 'Salles TD' : 'Amphis'}</button>`).join('') + '</div>';
    out += `<div class="grid-wrap"><table class="grid"><thead><tr><th class="corner"></th>${SLOTS.map(t => `<th>${t}</th>`).join('')}</tr></thead><tbody>`;
    for (let d = 0; d < 6; d++) {
      out += `<tr><th class="day">${DAYS[d]}</th>`;
      for (let t = 0; t < 6; t++) {
        const free = E.freeRooms(state, d, t).filter(r => ui.freeCat === 'all' || r.type === ui.freeCat);
        out += `<td class="cell"><div class="hint" style="margin-bottom:3px">${free.length} libre${free.length > 1 ? 's' : ''}</div><div class="chips">${free.map(r => `<span class="chip ${h(r.type)}" data-act="add" data-room="${h(r.id)}" data-day="${d}" data-slot="${t}" title="Créer une séance en ${h(r.id)}">${h(r.id)}</span>`).join('')}</div></td>`;
      }
      out += '</tr>';
    }
    out += '</tbody></table></div><div class="legend" style="margin-top:10px"><span><i style="background:#eef3fd"></i>Amphi</span><span><i style="background:#f6effd"></i>Salle SM</span><span><i style="background:#effaf3"></i>Salle TD</span></div>';
    return out;
  };

  function teacherList() {
    const map = {};
    for (const s of state.sessions) {
      const k = E.normKey(s.teacher) || '__none';
      (map[k] = map[k] || { key: k, name: s.teacher || 'Non renseigné', ids: [] }).ids.push(s.id);
    }
    return Object.values(map).sort((a, b) => (a.key === '__none') - (b.key === '__none') || a.name.localeCompare(b.name, 'fr'));
  }
  VIEWS.teachers = () => {
    const list = teacherList();
    if (!list.find(t => t.key === ui.teacher)) ui.teacher = list[0] && list[0].key;
    const cur = list.find(t => t.key === ui.teacher);
    let out = `<div class="page-h"><div><h1>Enseignants</h1><p>Emploi du temps de chaque enseignant, tous niveaux confondus.</p></div></div><div class="split"><div class="list">`;
    for (const t of list) {
      const nc = A.conflicts.filter(c => c.kind === 'teacher' && E.normKey(c.teacher) === t.key).length;
      out += `<button class="${t.key === ui.teacher ? 'active' : ''}" data-act="pick-teacher" data-key="${h(t.key)}"><span>${h(t.name)}</span>${nc ? `<span class="b">${nc}</span>` : ''}<span class="n">${t.ids.length}</span></button>`;
    }
    out += '</div><div>';
    if (cur) {
      out += `<h2 style="margin:0 0 10px;font-size:16px">${h(cur.name)} <small class="hint">${cur.ids.length} séance${cur.ids.length > 1 ? 's' : ''}/semaine</small></h2>`;
      out += grid(state.sessions.filter(s => (E.normKey(s.teacher) || '__none') === cur.key), { showLevel: true, hideTeacher: cur.key !== '__none' });
    }
    return out + '</div></div>';
  };

  function sessRow(s) {
    return `<div class="sess"><span class="tab" style="--h:${hue(s.levels[0])};padding:1px 8px;cursor:default"><span class="sw"></span>${h(levelsLabel(s))}</span>${h(s.module)} · ${h(s.type)}${s.groups.length ? ' ' + h(s.groups.join('+')) : ''} · <b>${h(s.room || 'sans salle')}</b>${s.teacher ? ' · ' + h(s.teacher) : ''}<button class="btn sm" data-act="edit" data-id="${h(s.id)}">Modifier</button></div>`;
  }
  VIEWS.issues = () => {
    const K = { room: 'Salle', blocked: 'Indisponible', teacher: 'Enseignant', group: 'Groupe' };
    let out = `<div class="page-h"><div><h1>Conflits & alertes</h1><p>Les conflits sont bloquants ; les alertes sont à vérifier.</p></div>
      <div class="actions"><button class="btn primary" data-act="resolve">Résoudre les conflits de salle</button></div></div>`;
    out += `<div class="panel"><h2>Conflits <small>${A.conflicts.length}</small></h2>`;
    if (!A.conflicts.length) out += '<div class="empty">Aucun conflit. Chaque salle, chaque enseignant et chaque groupe n\'est utilisé qu\'une fois par créneau.</div>';
    const sorted = A.conflicts.slice().sort((a, b) => ['room', 'blocked', 'group', 'teacher'].indexOf(a.kind) - ['room', 'blocked', 'group', 'teacher'].indexOf(b.kind) || a.day - b.day || a.slot - b.slot);
    for (const c of sorted) {
      out += `<div class="issue"><div class="msg"><span class="kind">${K[c.kind]}</span>${h(c.message)}</div>${c.ids.map(id => sessById(id)).filter(Boolean).map(sessRow).join('')}
        ${c.kind === 'group' || c.kind === 'teacher' ? '<div class="hint">À corriger à la main (changer l\'horaire ou le groupe) : la résolution automatique ne modifie que les salles.</div>' : ''}</div>`;
    }
    out += '</div>';
    out += `<div class="panel"><h2>Alertes <small>${A.warnings.length}</small></h2>`;
    if (!A.warnings.length) out += '<div class="empty">Aucune alerte.</div>';
    const WK = { noroom: 'Sans salle', unknownroom: 'Salle inconnue', capacity: 'Capacité', coverage: 'Groupes' };
    for (const w of A.warnings) {
      out += `<div class="issue warn"><div class="msg"><span class="kind w">${WK[w.kind] || w.kind}</span>${h(w.message)}</div>${w.ids.map(id => sessById(id)).filter(Boolean).map(sessRow).join('')}</div>`;
    }
    out += '</div>';
    const noTeacher = state.sessions.filter(s => !s.teacher).length;
    out += `<div class="panel"><h2>Remarques relevées dans les documents Word d'origine</h2>`;
    out += D.IMPORT_NOTES.map(n => `<div class="issue info"><span class="kind i">${h(n.level === '*' ? 'Général' : n.level.split('+').map(lvShort).join(' + '))}</span>${h(n.text)}</div>`).join('');
    out += `<div class="issue info"><span class="kind i">Info</span>${noTeacher} séance${noTeacher > 1 ? 's' : ''} sans enseignant renseigné (les conflits d'enseignant ne peuvent pas être vérifiés pour celles-ci).</div></div>`;
    return out;
  };

  VIEWS.changes = () => {
    const list = E.diff(ORIGINAL, state);
    const F = { room: 'Salle', day: 'Jour', slot: 'Créneau', teacher: 'Enseignant', module: 'Module', type: 'Type', groups: 'Groupes', levels: 'Niveaux' };
    const fmt = (s, f) => f === 'day' ? DAYS[s.day] : f === 'slot' ? SLOTS[s.slot] : f === 'levels' ? s.levels.map(lvShort).join(' + ') : Array.isArray(s[f]) ? (s[f].join('+') || 'Tous') : (s[f] || '(vide)');
    let out = `<div class="page-h"><div><h1>Modifications</h1><p>Différences avec les documents Word d'origine (${list.length}). Utile pour informer les enseignants et les étudiants.</p></div>
      <div class="actions">${list.length ? '<button class="btn" data-act="print-changes">' + ICON.print + 'Imprimer la liste</button><button class="btn danger" data-act="reset">Revenir aux données d\'origine</button>' : ''}</div></div>`;
    if (!list.length) return out + '<div class="panel"><div class="empty">Aucune modification pour l\'instant.</div></div>';
    out += `<div class="panel" style="padding:0;overflow:auto"><table class="tbl"><thead><tr><th>Niveau</th><th>Jour · créneau</th><th>Séance</th><th>Changement</th><th></th></tr></thead><tbody>`;
    const sorted = list.slice().sort((a, b) => { const x = a.now || a.before, y = b.now || b.before; return x.day - y.day || x.slot - y.slot; });
    for (const d of sorted) {
      const s = d.now || d.before; const b = d.before || d.now;
      let what;
      if (d.kind === 'added') what = '<b style="color:var(--good)">Séance ajoutée</b>';
      else if (d.kind === 'deleted') what = '<b style="color:var(--bad)">Séance supprimée</b>';
      else what = d.fields.map(f => `${F[f]} : <span class="from">${h(fmt(d.before, f))}</span><span class="arrow">→</span><span class="to">${h(fmt(d.now, f))}</span>`).join('<br>');
      out += `<tr><td>${h(levelsLabel(s))}</td><td>${h(DAYS[b.day])} ${h(SLOTS[b.slot])}</td><td>${h(s.module)} · ${h(s.type)}${s.groups.length ? ' ' + h(s.groups.join('+')) : ''}${s.teacher ? ' · ' + h(s.teacher) : ''}</td><td>${what}</td>
        <td style="white-space:nowrap;text-align:right">${d.kind !== 'deleted' ? `<button class="btn sm" data-act="edit" data-id="${h(d.id)}">Modifier</button> ` : ''}<button class="btn sm" data-act="revert" data-id="${h(d.id)}">Annuler ce changement</button></td></tr>`;
    }
    return out + '</tbody></table></div>';
  };

  VIEWS.manage = () => {
    const m = state.meta;
    let out = `<div class="page-h"><div><h1>Salles, niveaux & données</h1><p>Les modifications sont enregistrées automatiquement.</p></div></div>`;
    // Salles
    out += `<div class="panel"><h2>Salles <small>${state.rooms.length}</small></h2>
      <p class="hint" style="margin-top:-4px">Catégorie : la résolution automatique propose d'abord une salle de la même catégorie. Décochez « Auto » pour qu'une salle ne soit jamais proposée automatiquement. La capacité (facultative) est vérifiée si l'effectif par groupe des niveaux est renseigné.</p>
      <table class="tbl"><thead><tr><th>Salle</th><th>Catégorie</th><th>Capacité</th><th>Auto</th><th class="num">Séances</th><th class="num">Indispo.</th><th></th></tr></thead><tbody>`;
    for (const r of state.rooms) {
      const used = state.sessions.filter(s => s.room === r.id).length;
      out += `<tr><td><b>${h(r.id)}</b></td>
        <td><select data-change="room-type" data-room="${h(r.id)}">${['Amphi', 'SM', 'TD'].map(t => `<option ${r.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
        <td style="width:110px"><input type="number" min="0" placeholder="—" value="${r.capacity || ''}" data-change="room-cap" data-room="${h(r.id)}"></td>
        <td><input type="checkbox" ${r.auto !== false ? 'checked' : ''} data-change="room-auto" data-room="${h(r.id)}"></td>
        <td class="num">${used}</td><td class="num">${r.blocked.length}</td>
        <td style="text-align:right;white-space:nowrap"><button class="btn sm" data-act="room-rename" data-room="${h(r.id)}">Renommer</button> <button class="btn sm danger" data-act="room-delete" data-room="${h(r.id)}">Supprimer</button></td></tr>`;
    }
    out += `</tbody></table><div class="row" style="margin-top:12px"><input type="text" id="new-room" placeholder="Nouvelle salle (ex. S12, A-5, SM-4)" style="width:260px"><select id="new-room-type"><option>TD</option><option>SM</option><option>Amphi</option></select><button class="btn primary" data-act="room-add">${ICON.plus}Ajouter la salle</button></div></div>`;
    // Niveaux
    out += `<div class="panel"><h2>Niveaux <small>${state.levels.length}</small></h2><table class="tbl"><thead><tr><th style="width:110px">Abrégé</th><th>Intitulé</th><th style="width:170px">Groupes</th><th style="width:110px">Effectif / groupe</th><th>Note (NB) imprimée</th><th></th></tr></thead><tbody>`;
    for (const l of state.levels) {
      out += `<tr><td><input type="text" value="${h(l.short)}" data-change="lv-short" data-level="${h(l.id)}"></td><td><input type="text" value="${h(l.name)}" data-change="lv-name" data-level="${h(l.id)}"></td>
        <td><input type="text" value="${h(l.groups.join(', '))}" data-change="lv-groups" data-level="${h(l.id)}" title="Séparer par des virgules"></td>
        <td><input type="number" min="0" placeholder="—" value="${l.groupSize || ''}" data-change="lv-size" data-level="${h(l.id)}"></td>
        <td><input type="text" value="${h(l.notes || '')}" data-change="lv-notes" data-level="${h(l.id)}"></td>
        <td><button class="btn sm danger" data-act="level-delete" data-level="${h(l.id)}">Supprimer</button></td></tr>`;
    }
    out += `</tbody></table><div class="row" style="margin-top:12px"><input type="text" id="new-level-short" placeholder="Abrégé (ex. M1 Litt)" style="width:150px"><input type="text" id="new-level-name" placeholder="Intitulé" style="width:260px"><input type="text" id="new-level-groups" placeholder="Groupes : G1, G2" style="width:150px"><button class="btn primary" data-act="level-add">${ICON.plus}Ajouter le niveau</button></div></div>`;
    // En-tête
    out += `<div class="panel"><h2>En-tête des documents</h2><div class="form-grid">
      ${[['university', 'Université'], ['faculty', 'Faculté'], ['department', 'Département'], ['year', 'Année universitaire'], ['semester', 'Semestre']].map(([k, lab]) => `<label class="field"><span>${lab}</span><input type="text" value="${h(m[k])}" data-change="meta" data-key="${k}"></label>`).join('')}
    </div></div>`;
    // Données
    out += `<div class="panel"><h2>Données</h2><p class="hint" style="margin-top:-4px">Tout est enregistré dans ce navigateur. Faites une sauvegarde (.json) pour transférer le travail sur un autre ordinateur ou le garder en sécurité.</p>
      <div class="row"><button class="btn" data-act="json-export">Sauvegarder (.json)</button><button class="btn" data-act="json-import">Importer une sauvegarde</button><button class="btn danger" data-act="reset">Revenir aux données d'origine</button></div></div>`;
    return out;
  };

  /* ---------------- Fenêtres modales ---------------- */
  function modal(title, body, footer, cls = '') {
    $('#modal-root').innerHTML = `<div class="modal-bg" data-act="modal-bg"><div class="modal ${cls}" role="dialog" aria-modal="true"><header><h3>${title}</h3><button class="x" data-act="close" aria-label="Fermer">×</button></header><div class="body">${body}</div>${footer ? `<footer>${footer}</footer>` : ''}</div></div>`;
    return $('#modal-root .modal');
  }
  function closeModal() { $('#modal-root').innerHTML = ''; }

  /** Conflits que provoquerait `draft` s'il remplaçait la séance du même id. */
  function draftConflicts(draft) {
    const temp = Object.assign({}, state, { sessions: state.sessions.filter(s => s.id !== draft.id).concat([draft]) });
    const a = E.analyze(temp);
    return {
      conflicts: a.conflicts.filter(c => c.ids.includes(draft.id)).map(c => ({ c, others: c.ids.filter(i => i !== draft.id).map(i => temp.sessions.find(s => s.id === i)) })),
      warnings: a.warnings.filter(w => w.ids.includes(draft.id) && w.kind !== 'coverage'),
    };
  }
  function describe(dc) {
    return dc.conflicts.map(({ c, others }) => {
      if (c.kind === 'room') return `Salle ${c.room} déjà occupée par ${others.map(sLabel).join(', ')}`;
      if (c.kind === 'blocked') return `Salle ${c.room} marquée indisponible à ce créneau`;
      if (c.kind === 'teacher') return `${c.teacher} a déjà cours : ${others.map(sLabel).join(', ')}`;
      return `Les mêmes étudiants ont déjà : ${others.map(sLabel).join(', ')}`;
    });
  }

  function familiarRooms(levels) {
    const set = new Set();
    state.sessions.forEach(s => { if (s.room && s.levels.some(L => levels.includes(L))) set.add(s.room); });
    return set;
  }
  function suggestRoom(d) {
    const free = E.freeRooms(state, d.day, d.slot, d.id).filter(r => r.auto !== false);
    const cur = roomById(d.room);
    const cat = cur ? cur.type : (d.type === 'Cours' ? 'Amphi' : 'TD');
    const order = { TD: ['TD', 'SM', 'Amphi'], SM: ['SM', 'Amphi', 'TD'], Amphi: ['Amphi', 'SM', 'TD'] }[cat];
    const fam = familiarRooms(d.levels);
    // la salle actuellement enregistrée puis la salle d'origine passent en premier si elles sont libres
    const saved = sessById(d.id), pref = [saved && saved.room, ORIG[d.id] && ORIG[d.id].room].filter(Boolean);
    const p = r => { const i = pref.indexOf(r.id); return i < 0 ? 9 : i; };
    free.sort((a, b) => p(a) - p(b) || order.indexOf(a.type) - order.indexOf(b.type) || (fam.has(b.id) - fam.has(a.id)) || state.rooms.indexOf(a) - state.rooms.indexOf(b));
    return free[0];
  }

  function openEditor(id, preset = {}) {
    const isNew = !id;
    const base = isNew ? { id: newId(), levels: [ui.level || (state.levels[0] && state.levels[0].id)].filter(Boolean), day: 0, slot: 0, module: '', type: 'TD', groups: [], room: '', teacher: '', locked: false, note: '' } : sessById(id);
    if (!base) return;
    const d = Object.assign(E.clone(base), preset);
    const modules = [...new Set(state.sessions.map(s => s.module))].sort((a, b) => a.localeCompare(b, 'fr'));
    const teachers = [...new Set(state.sessions.map(s => s.teacher).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    const orig = ORIG[d.id];
    const body = `<div class="form-grid">
      <div class="field full"><span>Niveau(x) — cochez plusieurs niveaux pour un cours commun</span><div class="checks" id="ed-levels">${state.levels.map(l => `<label class="chk"><input type="checkbox" value="${h(l.id)}" ${d.levels.includes(l.id) ? 'checked' : ''}> ${h(l.short)}</label>`).join('')}</div></div>
      <label class="field full"><span>Module</span><input type="text" id="ed-module" list="dl-modules" value="${h(d.module)}" autocomplete="off"></label>
      <label class="field"><span>Type</span><select id="ed-type">${['Cours', 'TD', 'TP'].map(t => `<option ${d.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <div class="field"><span>Groupes — aucun coché = tout le niveau</span><div class="checks" id="ed-groups"></div></div>
      <label class="field"><span>Jour</span><select id="ed-day">${DAYS.map((x, i) => `<option value="${i}" ${d.day === i ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="field"><span>Créneau</span><select id="ed-slot">${SLOTS.map((x, i) => `<option value="${i}" ${d.slot === i ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="field"><span>Salle ${orig && orig.room !== d.room ? `<span class="hint">(origine : ${h(orig.room || 'aucune')})</span>` : ''}</span><div class="row" style="flex-wrap:nowrap"><select id="ed-room" class="grow"></select><button class="btn sm" type="button" id="ed-suggest" title="Choisir automatiquement la meilleure salle libre">Salle libre</button></div></label>
      <label class="field"><span>Enseignant</span><input type="text" id="ed-teacher" list="dl-teachers" value="${h(d.teacher)}" autocomplete="off"></label>
      <label class="field full"><span>Remarque (interne)</span><input type="text" id="ed-note" value="${h(d.note || '')}"></label>
      <label class="chk full"><input type="checkbox" id="ed-locked" ${d.locked ? 'checked' : ''}> Verrouiller la salle (la résolution automatique ne la changera jamais — utile pour un labo, une salle équipée…)</label>
      <div class="full" id="ed-valid"></div>
    </div>
    <datalist id="dl-modules">${modules.map(x => `<option value="${h(x)}">`).join('')}</datalist>
    <datalist id="dl-teachers">${teachers.map(x => `<option value="${h(x)}">`).join('')}</datalist>`;
    const footer = `${!isNew ? '<button class="btn danger" id="ed-del">Supprimer</button><button class="btn" id="ed-dup">Dupliquer</button>' : ''}<span class="grow"></span><button class="btn" data-act="close">Annuler</button><button class="btn primary" id="ed-save">${isNew ? 'Ajouter' : 'Enregistrer'}</button>`;
    const m = modal(isNew ? 'Nouvelle séance' : 'Modifier la séance', body, footer);

    const read = () => {
      d.levels = $$('#ed-levels input:checked', m).map(i => i.value);
      d.groups = $$('#ed-groups input:checked', m).map(i => i.value);
      d.module = $('#ed-module', m).value.trim(); d.type = $('#ed-type', m).value;
      d.day = +$('#ed-day', m).value; d.slot = +$('#ed-slot', m).value; d.room = $('#ed-room', m).value;
      d.teacher = $('#ed-teacher', m).value.trim(); d.note = $('#ed-note', m).value.trim(); d.locked = $('#ed-locked', m).checked;
    };
    const drawGroups = () => {
      const groups = [...new Set(d.levels.flatMap(L => (lvl(L) || { groups: [] }).groups))];
      $('#ed-groups', m).innerHTML = groups.length ? groups.map(g => `<label class="chk"><input type="checkbox" value="${h(g)}" ${d.groups.includes(g) ? 'checked' : ''}> ${h(g)}</label>`).join('') : '<span class="hint">—</span>';
    };
    const drawRooms = () => {
      const k = d.day + '-' + d.slot;
      const opt = r => {
        const occ = state.sessions.filter(s => s.id !== d.id && s.day === d.day && s.slot === d.slot && s.room === r.id);
        const blocked = r.blocked.includes(k);
        const status = blocked ? '✖ indisponible' : occ.length ? '✖ occupée : ' + occ.map(s => `${levelsLabel(s)} ${s.module}${s.groups.length ? ' ' + s.groups.join('+') : ''}`).join(' / ') : '✓ libre';
        return `<option value="${h(r.id)}" ${d.room === r.id ? 'selected' : ''}>${h(r.id)} — ${h(status)}</option>`;
      };
      let html = `<option value="" ${!d.room ? 'selected' : ''}>— aucune salle —</option>`;
      for (const [cat, lab] of [['Amphi', 'Amphis'], ['SM', 'Salles SM'], ['TD', 'Salles TD']]) {
        const rs = state.rooms.filter(r => r.type === cat);
        if (rs.length) html += `<optgroup label="${lab}">${rs.map(opt).join('')}</optgroup>`;
      }
      if (d.room && !roomById(d.room)) html += `<option value="${h(d.room)}" selected>${h(d.room)} — salle inconnue</option>`;
      $('#ed-room', m).innerHTML = html;
    };
    const validate = () => {
      const errs = [];
      if (!d.levels.length) errs.push('Choisissez au moins un niveau.');
      if (!d.module) errs.push('Le module est obligatoire.');
      const dc = draftConflicts(d);
      const msgs = describe(dc);
      const warns = dc.warnings.map(w => w.message.replace(/ — .*$/, ''));
      const box = $('#ed-valid', m);
      if (!errs.length && !msgs.length) box.innerHTML = `<div class="validation ok">✓ Aucun conflit à ce créneau${warns.length ? ' · ' + h(warns.join(' · ')) : ''}</div>`;
      else box.innerHTML = `<div class="validation bad"><b>${errs.length ? 'À compléter' : 'Attention — conflit'}</b><ul>${errs.concat(msgs).map(x => `<li>${h(x)}</li>`).join('')}</ul></div>`;
      return { errs, msgs };
    };
    drawGroups(); drawRooms(); validate();
    m.addEventListener('change', e => {
      read();
      if (e.target.closest('#ed-levels')) { drawGroups(); read(); }
      if (e.target.id === 'ed-day' || e.target.id === 'ed-slot') drawRooms();
      validate();
    });
    m.addEventListener('input', e => { if (e.target.id === 'ed-teacher' || e.target.id === 'ed-module') { read(); validate(); } });
    $('#ed-suggest', m).onclick = () => {
      read(); const r = suggestRoom(d);
      if (!r) return toast('Aucune salle libre à ce créneau', 'err');
      d.room = r.id; drawRooms(); validate(); toast(`Salle ${r.id} proposée (libre)`);
    };
    $('#ed-save', m).onclick = () => {
      read(); const v = validate();
      if (v.errs.length) return;
      if (v.msgs.length && !confirm('Cette séance crée un conflit :\n\n- ' + v.msgs.join('\n- ') + '\n\nEnregistrer quand même ?')) return;
      commit(st => {
        const i = st.sessions.findIndex(s => s.id === d.id);
        if (i >= 0) st.sessions[i] = d; else st.sessions.push(d);
      }, isNew ? 'Séance ajoutée' : 'Séance modifiée');
      closeModal();
    };
    if (!isNew) {
      $('#ed-del', m).onclick = () => {
        if (!confirm(`Supprimer définitivement cette séance ?\n\n${sLabel(base)}\n${when(base)}`)) return;
        commit(st => { st.sessions = st.sessions.filter(s => s.id !== d.id); }, 'Séance supprimée (Ctrl+Z pour annuler)');
        closeModal();
      };
      $('#ed-dup', m).onclick = () => { read(); const copy = Object.assign(E.clone(d), { id: newId(), room: '' }); closeModal(); openEditor(null, copy); };
    }
    setTimeout(() => $('#ed-module', m).focus(), 30);
  }

  /* ---------------- Résolution automatique ---------------- */
  function openResolver() {
    let fill = true;
    const draw = () => {
      const res = E.resolveRooms(state, { fillMissing: fill });
      const before = A.counts.room + A.counts.blocked;
      const after = res.after.counts.room + res.after.counts.blocked;
      const missingBefore = A.warnings.filter(w => w.kind === 'noroom').length;
      const others = res.after.counts.teacher + res.after.counts.group;
      let body = `<div class="stats" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat ${before ? 'bad' : 'ok'}"><div class="n">${before}</div><div class="l">Conflits de salle actuels</div></div>
        <div class="stat"><div class="n">${res.changes.length}</div><div class="l">Changements de salle proposés</div></div>
        <div class="stat ${after ? 'bad' : 'ok'}"><div class="n">${after}</div><div class="l">Conflits de salle restants</div></div></div>
        <div class="note-box" style="margin-bottom:12px">Seule la <b>salle</b> change. Jours, horaires, enseignants et groupes restent strictement identiques, donc aucun nouveau conflit d'enseignant ou de groupe ne peut apparaître. Chaque nouvelle salle a été vérifiée libre (et non indisponible) au créneau concerné. Les séances verrouillées ne sont jamais déplacées.</div>
        <label class="chk" style="margin-bottom:10px"><input type="checkbox" id="rs-fill" ${fill ? 'checked' : ''}> Attribuer aussi une salle aux séances qui n'en ont pas (${missingBefore})</label>`;
      if (res.unresolved.length) {
        body += `<div class="validation bad" style="margin-bottom:10px"><b>${res.unresolved.length} conflit(s) impossible(s) à résoudre en changeant seulement de salle</b><ul>${res.unresolved.map(u => `<li>${DAYS[u.day]} ${SLOTS[u.slot]} — ${h(u.room || 'sans salle')} : ${h(u.message)}. Solutions : ajouter une salle, retirer une indisponibilité, ou déplacer une séance à un autre créneau.</li>`).join('')}</ul></div>`;
      }
      if (res.changes.length) {
        body += `<table class="tbl"><thead><tr><th><input type="checkbox" id="rs-all" checked title="Tout cocher"></th><th>Jour · créneau</th><th>Séance</th><th>Salle</th><th>Raison</th></tr></thead><tbody>`;
        res.changes.forEach((c, i) => {
          const s = sessById(c.id);
          body += `<tr><td><input type="checkbox" class="rs-c" data-i="${i}" checked></td><td style="white-space:nowrap">${DAYS[c.day]}<br><span class="hint">${SLOTS[c.slot]}</span></td>
            <td><span class="tab" style="--h:${hue(s.levels[0])};padding:1px 8px;cursor:default"><span class="sw"></span>${h(levelsLabel(s))}</span> ${h(s.module)} · ${h(s.type)}${s.groups.length ? ' ' + h(s.groups.join('+')) : ''}${s.teacher ? '<br><span class="hint">' + h(s.teacher) + '</span>' : ''}</td>
            <td style="white-space:nowrap"><span class="from">${h(c.from || 'aucune')}</span><span class="arrow">→</span><span class="to">${h(c.to)}</span></td><td class="hint">${h(c.reason)}</td></tr>`;
        });
        body += '</tbody></table>';
      } else if (!res.unresolved.length) body += '<div class="empty">Rien à corriger : aucune salle n\'est occupée deux fois.</div>';
      if (others) body += `<p class="hint" style="margin-top:10px">${others} conflit(s) d'enseignant ou de groupe existent dans les documents d'origine : ils ne concernent pas les salles et sont listés dans « Conflits & alertes » pour correction manuelle.</p>`;
      const m = modal('Résolution automatique des conflits de salle', body,
        `<span class="hint grow">Vous pourrez tout annuler avec Ctrl+Z.</span><button class="btn" data-act="close">Fermer</button>${res.changes.length ? `<button class="btn good" id="rs-apply">Appliquer les changements cochés</button>` : ''}`, 'wide');
      $('#rs-fill', m).onchange = e => { fill = e.target.checked; draw(); };
      const all = $('#rs-all', m);
      if (all) all.onchange = () => $$('.rs-c', m).forEach(c => (c.checked = all.checked));
      const btn = $('#rs-apply', m);
      if (btn) btn.onclick = () => {
        const chosen = $$('.rs-c:checked', m).map(c => res.changes[+c.dataset.i]);
        if (!chosen.length) return toast('Aucun changement coché', 'err');
        let applied = 0;
        commit(st => {
          for (const c of chosen) {
            const s = st.sessions.find(x => x.id === c.id);
            if (s && s.room === c.from) { s.room = c.to; applied++; }
          }
        });
        closeModal();
        const left = A.counts.room + A.counts.blocked;
        toast(left ? `${applied} salle(s) changée(s) — il reste ${left} conflit(s) de salle (changements décochés ?)` : `${applied} salle(s) changée(s) — plus aucun conflit de salle ✓`, left ? 'err' : 'ok');
      };
    };
    draw();
  }

  /* ---------------- Exports ---------------- */
  function openExport() {
    const body = `<div class="field"><span>Niveaux à inclure</span><div class="checks" id="ex-levels">${state.levels.map(l => `<label class="chk"><input type="checkbox" value="${h(l.id)}" checked> ${h(l.short)}</label>`).join('')}</div></div>
      <label class="chk" style="margin:8px 0 14px"><input type="checkbox" id="ex-hl"> Surligner les salles modifiées (par rapport aux documents d'origine)</label>
      ${A.counts.total ? `<div class="validation bad" style="margin-bottom:12px">Attention : il reste ${A.counts.total} conflit(s). Vous pouvez exporter quand même, mais vérifiez « Conflits & alertes ».</div>` : '<div class="validation ok" style="margin-bottom:12px">✓ Aucun conflit — les emplois du temps sont prêts à être diffusés.</div>'}
      <div class="row">
        <button class="btn primary" id="ex-docx">${ICON.word}Word (.docx) — une page par niveau</button>
        <button class="btn" id="ex-xlsx">Excel (.xlsx) — classeur complet</button>
        <button class="btn" id="ex-print">${ICON.print}Imprimer / PDF</button>
        <button class="btn" id="ex-json">Sauvegarde (.json)</button>
      </div>
      <p class="hint" style="margin-top:12px">Le classeur Excel contient : une feuille par niveau, l'occupation de chaque salle, la liste de toutes les séances (avec la salle d'origine) et la liste des modifications. Pour un PDF, choisissez « Enregistrer au format PDF » dans la fenêtre d'impression.</p>`;
    const m = modal('Exporter les emplois du temps', body, '<span class="grow"></span><button class="btn" data-act="close">Fermer</button>');
    const levels = () => $$('#ex-levels input:checked', m).map(i => i.value);
    const changedRooms = () => $('#ex-hl', m).checked ? new Set(E.diff(ORIGINAL, state).filter(d => d.kind === 'added' || (d.kind === 'modified' && d.fields.includes('room'))).map(d => d.id)) : null;
    $('#ex-docx', m).onclick = () => { if (!levels().length) return toast('Choisissez au moins un niveau', 'err'); X.exportDocx(state, levels(), { changedRooms: changedRooms() }); toast('Fichier Word généré'); };
    $('#ex-xlsx', m).onclick = () => { X.exportXlsx(state, A, E.diff(ORIGINAL, state), { highlight: $('#ex-hl', m).checked, original: ORIGINAL }); toast('Fichier Excel généré'); };
    $('#ex-print', m).onclick = () => { if (!levels().length) return toast('Choisissez au moins un niveau', 'err'); const ch = changedRooms(); closeModal(); printLevels(levels(), ch); };
    $('#ex-json', m).onclick = () => { X.exportJson(state); toast('Sauvegarde téléchargée'); };
  }

  function printLevels(levelIds, changed) {
    const m = state.meta;
    const html = state.levels.filter(l => levelIds.includes(l.id)).map(l => {
      const ss = state.sessions.filter(s => s.levels.includes(l.id));
      const days = [0, 1, 2, 3, 4, 5].filter(d => ss.some(s => s.day === d));
      const maxSlot = Math.max(4, ...ss.map(s => s.slot));
      const slots = [...Array(maxSlot + 1).keys()];
      let t = `<div class="pp"><div class="pp-head"><div><b>${h(m.university)}</b><br>${h(m.faculty)}<br>${h(m.department)} — Année universitaire ${h(m.year)}</div><div class="r"><b style="font-size:15px">Emploi du temps ${h(m.semester)}</b><br>Niveau : <b>${h(l.name)}</b><br>Groupes : ${h(l.groups.map(g => g.replace('G', '')).join('+'))}</div></div>`;
      t += `<table><thead><tr><th style="width:80px">Horaires</th>${slots.map(s => `<th>${SLOTS[s]}</th>`).join('')}</tr></thead><tbody>`;
      for (const d of days) {
        t += `<tr><th>${DAYS[d]}</th>`;
        for (const sl of slots) {
          const list = ss.filter(s => s.day === d && s.slot === sl).sort((a, b) => (b.type === 'Cours') - (a.type === 'Cours') || (a.groups[0] || '').localeCompare(b.groups[0] || ''));
          t += '<td>' + list.map(s => {
            const room = changed && changed.has(s.id) ? `<mark>${h(s.room || 'salle ?')}</mark>` : h(s.room || 'salle ?');
            return `<div class="s"><div class="m">${h(s.module)}${s.levels.length > 1 ? ' (' + h(levelsLabel(s)) + ')' : ''}</div><div>${h(s.type)}${s.groups.length ? ' ' + h(s.groups.join('+')) : ''} — ${room}</div>${s.teacher ? `<div class="t">${h(s.teacher)}</div>` : ''}</div>`;
          }).join('') + '</td>';
        }
        t += '</tr>';
      }
      t += '</tbody></table>';
      if (l.notes) t += `<div class="nb"><b>NB :</b> ${h(l.notes)}</div>`;
      return t + '</div>';
    }).join('');
    $('#print-area').innerHTML = html;
    setTimeout(() => window.print(), 50);
  }
  function printChanges() {
    const list = E.diff(ORIGINAL, state);
    const F = { room: 'Salle', day: 'Jour', slot: 'Créneau', teacher: 'Enseignant', module: 'Module', type: 'Type', groups: 'Groupes', levels: 'Niveaux' };
    const fmt = (s, f) => f === 'day' ? DAYS[s.day] : f === 'slot' ? SLOTS[s.slot] : f === 'levels' ? s.levels.map(lvShort).join(' + ') : Array.isArray(s[f]) ? (s[f].join('+') || 'Tous') : (s[f] || '—');
    let t = `<div class="pp"><div class="pp-head"><div><b>${h(state.meta.department)}</b> — ${h(state.meta.semester)} ${h(state.meta.year)}</div><div class="r"><b>Modifications des emplois du temps</b></div></div><table><thead><tr><th>Niveau</th><th>Jour</th><th>Créneau</th><th>Séance</th><th>Changement</th></tr></thead><tbody>`;
    for (const d of list.slice().sort((a, b) => { const x = a.before || a.now, y = b.before || b.now; return x.day - y.day || x.slot - y.slot; })) {
      const s = d.now || d.before, b = d.before || d.now;
      const what = d.kind === 'added' ? `Ajoutée (${h(s.room || '—')})` : d.kind === 'deleted' ? 'Supprimée' : d.fields.map(f => `${F[f]} : ${h(fmt(d.before, f))} → <b>${h(fmt(d.now, f))}</b>`).join('<br>');
      t += `<tr><td>${h(levelsLabel(s))}</td><td>${DAYS[b.day]}</td><td>${SLOTS[b.slot]}</td><td>${h(s.module)} · ${h(s.type)} ${h(s.groups.join('+'))}${s.teacher ? ' · ' + h(s.teacher) : ''}</td><td>${what}</td></tr>`;
    }
    $('#print-area').innerHTML = t + '</tbody></table></div>';
    setTimeout(() => window.print(), 50);
  }

  /* ---------------- Déplacements (glisser-déposer) ---------------- */
  function moveSession(id, patch) {
    const s = sessById(id); if (!s) return;
    const d = Object.assign(E.clone(s), patch);
    if (d.day === s.day && d.slot === s.slot && d.room === s.room) return;
    const msgs = describe(draftConflicts(d));
    const what = `${sLabel(s)}\n${when(s)}  →  ${DAYS[d.day]} ${SLOTS[d.slot]}${d.room !== s.room ? ' · salle ' + (d.room || '—') : ''}`;
    if (msgs.length && !confirm(`Ce déplacement crée un conflit :\n\n- ${msgs.join('\n- ')}\n\n${what}\n\nDéplacer quand même ?`)) return;
    commit(st => { Object.assign(st.sessions.find(x => x.id === id), patch); }, msgs.length ? 'Séance déplacée (avec conflit)' : 'Séance déplacée');
  }
  let dragId = null;
  document.addEventListener('dragstart', e => {
    const c = e.target.closest && e.target.closest('.card'); if (!c) return;
    dragId = c.dataset.id; c.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId);
  });
  document.addEventListener('dragend', () => { dragId = null; $$('.dragging').forEach(x => x.classList.remove('dragging')); $$('.drop-ok').forEach(x => x.classList.remove('drop-ok')); });
  document.addEventListener('dragover', e => {
    const td = e.target.closest && e.target.closest('td[data-drop]');
    if (!td || !dragId || td.dataset.drop === 'none') return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    $$('.drop-ok').forEach(x => x !== td && x.classList.remove('drop-ok')); td.classList.add('drop-ok');
  });
  document.addEventListener('drop', e => {
    const td = e.target.closest && e.target.closest('td[data-drop]');
    if (!td || !dragId || td.dataset.drop === 'none') return;
    e.preventDefault();
    const patch = { day: +td.dataset.day, slot: +td.dataset.slot };
    if (td.dataset.drop === 'room') patch.room = td.dataset.room;
    const id = dragId; dragId = null;
    moveSession(id, patch);
  });

  /* ---------------- Actions ---------------- */
  const ACT = {
    nav: el => { ui.view = el.dataset.view; refresh(); $('#main').scrollTop = 0; },
    'open-level': el => { ui.level = el.dataset.level; ui.view = 'levels'; refresh(); },
    'pick-level': el => { ui.level = el.dataset.level; refresh(); },
    'pick-day': el => { ui.day = el.dataset.day === 'all' ? 'all' : +el.dataset.day; refresh(); },
    'pick-teacher': el => { ui.teacher = el.dataset.key; refresh(); },
    'free-cat': el => { ui.freeCat = el.dataset.cat; refresh(); },
    'toggle-old': el => { ui.showOld = el.checked; refresh(); },
    'block-mode': () => { ui.blockMode = !ui.blockMode; refresh(); },
    'toggle-block': (el, e) => {
      if (e.target.closest('.card')) return;
      const r = el.dataset.room, k = el.dataset.day + '-' + el.dataset.slot;
      commit(st => { const room = st.rooms.find(x => x.id === r); const i = room.blocked.indexOf(k); if (i >= 0) room.blocked.splice(i, 1); else room.blocked.push(k); });
    },
    edit: (el, e) => { if (ui.blockMode && el.classList.contains('card') && e) { /* en mode indispo, une carte s'ouvre quand même */ } openEditor(el.dataset.id); },
    add: el => {
      const p = {};
      if (el.dataset.day != null) p.day = +el.dataset.day;
      if (el.dataset.slot != null) p.slot = +el.dataset.slot;
      if (el.dataset.room) p.room = el.dataset.room;
      if (el.dataset.level) p.levels = [el.dataset.level];
      if (el.dataset.teacher && el.dataset.teacher !== '__none') { const t = state.sessions.find(s => E.normKey(s.teacher) === el.dataset.teacher); if (t) p.teacher = t.teacher; }
      openEditor(null, p);
    },
    undo, redo,
    resolve: () => openResolver(),
    export: () => openExport(),
    close: () => closeModal(),
    'modal-bg': (el, e) => { if (e.target === el) closeModal(); },
    'docx-level': el => { X.exportDocx(state, [el.dataset.level], {}); toast('Fichier Word généré'); },
    'print-level': el => printLevels([el.dataset.level], null),
    'print-changes': () => printChanges(),
    revert: el => {
      const id = el.dataset.id; const o = ORIG[id];
      commit(st => {
        const i = st.sessions.findIndex(s => s.id === id);
        if (!o) { if (i >= 0) st.sessions.splice(i, 1); }
        else if (i >= 0) st.sessions[i] = E.clone(o);
        else st.sessions.push(E.clone(o));
      }, 'Changement annulé');
    },
    reset: () => {
      if (!confirm('Revenir exactement aux emplois du temps des documents Word d\'origine ?\n\nToutes les modifications (salles, séances, salles ajoutées, indisponibilités) seront perdues. Vous pourrez encore faire Ctrl+Z.')) return;
      commit(st => { const o = E.clone(ORIGINAL); Object.keys(st).forEach(k => delete st[k]); Object.assign(st, o); }, 'Données d\'origine restaurées');
    },
    'json-export': () => { X.exportJson(state); toast('Sauvegarde téléchargée'); },
    'json-import': () => $('#import-file').click(),
    'room-add': () => {
      const id = E.normRoom($('#new-room').value); const type = $('#new-room-type').value;
      if (!id) return toast('Saisissez un nom de salle', 'err');
      if (roomById(id)) return toast(`La salle ${id} existe déjà`, 'err');
      commit(st => { st.rooms.push({ id, type, capacity: null, auto: true, blocked: [] }); sortRooms(st); }, `Salle ${id} ajoutée`);
    },
    'room-rename': el => {
      const old = el.dataset.room;
      const v = prompt(`Nouveau nom pour la salle ${old} :`, old); if (v == null) return;
      const id = E.normRoom(v);
      if (!id || id === old) return;
      if (roomById(id)) return toast(`La salle ${id} existe déjà`, 'err');
      commit(st => { st.rooms.find(r => r.id === old).id = id; st.sessions.forEach(s => { if (s.room === old) s.room = id; }); sortRooms(st); }, `Salle ${old} renommée en ${id}`);
    },
    'room-delete': el => {
      const id = el.dataset.room; const used = state.sessions.filter(s => s.room === id).length;
      if (!confirm(used ? `La salle ${id} est utilisée par ${used} séance(s). Ces séances n'auront plus de salle (vous pourrez ensuite utiliser « Résoudre les salles »).\n\nSupprimer la salle ${id} ?` : `Supprimer la salle ${id} ?`)) return;
      commit(st => { st.rooms = st.rooms.filter(r => r.id !== id); st.sessions.forEach(s => { if (s.room === id) s.room = ''; }); }, `Salle ${id} supprimée`);
    },
    'level-add': () => {
      const short = $('#new-level-short').value.trim(); const name = $('#new-level-name').value.trim() || short;
      const groups = parseGroups($('#new-level-groups').value);
      if (!short) return toast('Saisissez au moins l\'abrégé du niveau', 'err');
      let id = short.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'NIV'; let n = 2; const base = id;
      while (lvl(id)) id = base + (n++);
      commit(st => st.levels.push({ id, short, name, groups: groups.length ? groups : ['G1'], groupSize: null, notes: '' }), `Niveau ${short} ajouté`);
    },
    'level-delete': el => {
      const id = el.dataset.level; const own = state.sessions.filter(s => s.levels.length === 1 && s.levels[0] === id).length;
      const shared = state.sessions.filter(s => s.levels.length > 1 && s.levels.includes(id)).length;
      if (!confirm(`Supprimer le niveau ${lvShort(id)} ?\n\n${own} séance(s) seront supprimées${shared ? ` et le niveau sera retiré de ${shared} cours commun(s)` : ''}.`)) return;
      commit(st => {
        st.levels = st.levels.filter(l => l.id !== id);
        st.sessions = st.sessions.filter(s => !(s.levels.length === 1 && s.levels[0] === id));
        st.sessions.forEach(s => { s.levels = s.levels.filter(L => L !== id); });
      }, 'Niveau supprimé');
    },
  };
  function sortRooms(st) {
    const order = { Amphi: 0, SM: 1, TD: 2 };
    st.rooms.sort((a, b) => (order[a.type] ?? 3) - (order[b.type] ?? 3) || a.id.localeCompare(b.id, 'fr', { numeric: true }));
  }
  const parseGroups = v => [...new Set(v.split(/[,;+\s]+/).map(x => x.trim().toUpperCase()).filter(Boolean).map(x => /^\d+$/.test(x) ? 'G' + x : x))];

  // Changements dans les formulaires de gestion
  const CHG = {
    'room-type': el => commit(st => { st.rooms.find(r => r.id === el.dataset.room).type = el.value; sortRooms(st); }),
    'room-cap': el => commit(st => { st.rooms.find(r => r.id === el.dataset.room).capacity = +el.value || null; }),
    'room-auto': el => commit(st => { st.rooms.find(r => r.id === el.dataset.room).auto = el.checked; }),
    'lv-short': el => el.value.trim() && commit(st => { st.levels.find(l => l.id === el.dataset.level).short = el.value.trim(); }),
    'lv-name': el => commit(st => { st.levels.find(l => l.id === el.dataset.level).name = el.value.trim(); }),
    'lv-size': el => commit(st => { st.levels.find(l => l.id === el.dataset.level).groupSize = +el.value || null; }),
    'lv-notes': el => commit(st => { st.levels.find(l => l.id === el.dataset.level).notes = el.value.trim(); }),
    'lv-groups': el => {
      const id = el.dataset.level; const groups = parseGroups(el.value);
      if (!groups.length) { toast('Un niveau doit avoir au moins un groupe', 'err'); return refresh(); }
      const orphans = state.sessions.filter(s => s.levels.includes(id) && s.groups.some(g => !groups.includes(g)));
      if (orphans.length && !confirm(`${orphans.length} séance(s) utilisent un groupe que vous retirez. Elles garderont ce groupe (à corriger à la main). Continuer ?`)) return refresh();
      commit(st => { st.levels.find(l => l.id === id).groups = groups; });
    },
    meta: el => commit(st => { st.meta[el.dataset.key] = el.value; }),
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT' && el.type === 'checkbox' && el.dataset.act !== 'toggle-old') return;
    if (el.dataset.act === 'toggle-old') return;
    const fn = ACT[el.dataset.act];
    if (fn) { fn(el, e); }
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset && el.dataset.act === 'toggle-old') return ACT['toggle-old'](el);
    if (el.dataset && el.dataset.change && CHG[el.dataset.change]) CHG[el.dataset.change](el);
  });
  $('#import-file').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const st = JSON.parse(r.result);
        if (!valid(st)) throw new Error('fichier non reconnu');
        if (!confirm(`Importer cette sauvegarde (${st.sessions.length} séances, ${st.rooms.length} salles, ${st.levels.length} niveaux) ?\nL'état actuel sera remplacé (Ctrl+Z possible).`)) return;
        commit(cur => { const u = upgrade(st); Object.keys(cur).forEach(k => delete cur[k]); Object.assign(cur, u); }, 'Sauvegarde importée');
      } catch (err) { toast('Import impossible : ' + err.message, 'err'); }
      e.target.value = '';
    };
    r.readAsText(f);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('#modal-root').innerHTML) return closeModal();
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  });

  function toast(msg, kind = '') {
    const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg;
    $('#toasts').appendChild(t); setTimeout(() => t.remove(), kind === 'err' ? 6000 : 3200);
  }

  refresh();
})();
