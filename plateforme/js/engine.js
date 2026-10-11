/* =====================================================================
   Moteur : détection des conflits + résolution automatique des salles.
   Règle d'or de la résolution : on ne change QUE les salles.
   Jours, horaires, enseignants et groupes ne sont jamais modifiés.
   ===================================================================== */
(function (root) {
  const DAYS = ['Samedi', 'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi'];
  const SLOTS = ['08:00 - 09:30', '09:30 - 11:00', '11:00 - 12:30', '12:30 - 14:00', '14:00 - 15:30', '15:30 - 17:00'];

  const clone = o => JSON.parse(JSON.stringify(o));
  const normKey = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  /** Normalise un nom de salle saisi à la main : "a 04", "Amphi-4" → "A-4", "s5" → "S05", "sm3" → "SM-3". */
  function normRoom(r) {
    let s = (r || '').toUpperCase().replace(/\s+/g, '').replace(/^AMPHI-?/, 'A-');
    let m;
    if ((m = s.match(/^SM-?0*(\d+)$/))) return 'SM-' + m[1];
    if ((m = s.match(/^A-?0*(\d+)$/))) return 'A-' + m[1];
    if ((m = s.match(/^S-?0*(\d+)$/))) return 'S' + m[1].padStart(2, '0');
    return s;
  }

  const slotKey = (d, t) => d + '-' + t;
  const levelOf = (state, id) => state.levels.find(l => l.id === id);
  const roomOf = (state, id) => state.rooms.find(r => r.id === id);

  function groupsFor(state, s, levelId) {
    if (s.groups && s.groups.length) return s.groups;
    const l = levelOf(state, levelId);
    return l ? l.groups : [];
  }

  /** Deux séances au même créneau touchent-elles les mêmes étudiants ? */
  function studentsOverlap(state, a, b) {
    for (const L of a.levels) {
      if (!b.levels.includes(L)) continue;
      if (!a.groups.length || !b.groups.length) return true; // cours = tout le niveau
      const gb = groupsFor(state, b, L);
      if (groupsFor(state, a, L).some(g => gb.includes(g))) return true;
    }
    return false;
  }

  function studentsNeeded(state, s) {
    let total = 0;
    for (const L of s.levels) {
      const l = levelOf(state, L);
      if (!l || !l.groupSize) return null;
      total += l.groupSize * (s.groups.length ? s.groups.length : l.groups.length);
    }
    return total;
  }

  function label(state, s) {
    const lv = s.levels.map(id => (levelOf(state, id) || { short: id }).short).join(' + ');
    const g = s.groups.length ? ' ' + s.groups.join('+') : '';
    return `${lv} · ${s.module} (${s.type}${g})`;
  }

  /**
   * Analyse complète.
   * conflicts : bloquants (salle double, salle indisponible, enseignant double, groupe double)
   * warnings  : à vérifier (salle absente, salle inconnue, capacité, couverture des TD)
   */
  function analyze(state) {
    const conflicts = [];
    const warnings = [];
    const bySession = {};
    const mark = (ids, idx) => ids.forEach(id => (bySession[id] = bySession[id] || []).push(idx));
    const roomIds = new Set(state.rooms.map(r => r.id));

    const bySlot = {};
    for (const s of state.sessions) (bySlot[slotKey(s.day, s.slot)] = bySlot[slotKey(s.day, s.slot)] || []).push(s);

    for (const k of Object.keys(bySlot)) {
      const list = bySlot[k];
      const [d, t] = k.split('-').map(Number);
      const when = `${DAYS[d]} ${SLOTS[t]}`;

      // 1. Salle occupée deux fois
      const byRoom = {};
      for (const s of list) if (s.room) (byRoom[s.room] = byRoom[s.room] || []).push(s);
      for (const r of Object.keys(byRoom)) {
        if (byRoom[r].length > 1) {
          const ids = byRoom[r].map(s => s.id);
          conflicts.push({ kind: 'room', day: d, slot: t, room: r, ids,
            message: `Salle ${r} occupée ${ids.length} fois — ${when}` });
          mark(ids, conflicts.length - 1);
        }
      }
      // 2. Salle marquée indisponible
      for (const s of list) {
        const room = s.room && roomOf(state, s.room);
        if (room && room.blocked && room.blocked.includes(k)) {
          conflicts.push({ kind: 'blocked', day: d, slot: t, room: s.room, ids: [s.id],
            message: `Salle ${s.room} indisponible — ${when}` });
          mark([s.id], conflicts.length - 1);
        }
      }
      // 3. Enseignant à deux endroits
      const byT = {};
      for (const s of list) { const tk = normKey(s.teacher); if (tk) (byT[tk] = byT[tk] || []).push(s); }
      for (const tk of Object.keys(byT)) {
        if (byT[tk].length > 1) {
          const ids = byT[tk].map(s => s.id);
          conflicts.push({ kind: 'teacher', day: d, slot: t, teacher: byT[tk][0].teacher, ids,
            message: `Enseignant ${byT[tk][0].teacher} dans ${ids.length} séances — ${when}` });
          mark(ids, conflicts.length - 1);
        }
      }
      // 4. Même groupe d'étudiants dans deux séances
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        if (studentsOverlap(state, list[i], list[j])) {
          const ids = [list[i].id, list[j].id];
          conflicts.push({ kind: 'group', day: d, slot: t, ids,
            message: `Mêmes étudiants dans 2 séances — ${when}` });
          mark(ids, conflicts.length - 1);
        }
      }
      // Alertes
      for (const s of list) {
        if (!s.room) {
          warnings.push({ kind: 'noroom', day: d, slot: t, ids: [s.id], message: `Salle manquante — ${when}` });
        } else if (!roomIds.has(s.room)) {
          warnings.push({ kind: 'unknownroom', day: d, slot: t, ids: [s.id], message: `Salle « ${s.room} » absente de la liste des salles — ${when}` });
        } else {
          const room = roomOf(state, s.room); const need = studentsNeeded(state, s);
          if (room.capacity && need && need > room.capacity)
            warnings.push({ kind: 'capacity', day: d, slot: t, ids: [s.id], message: `Capacité ${s.room} (${room.capacity}) < effectif estimé (${need}) — ${when}` });
        }
      }
    }
    for (let i = 0; i < warnings.length; i++) {
      warnings[i].ids.forEach(id => (bySession[id] = bySession[id] || []).push('w' + i));
    }

    // 5. Couverture des TD : chaque groupe doit avoir le même nombre de séances par module
    for (const l of state.levels) {
      if (l.groups.length < 2) continue;
      const mods = {};
      for (const s of state.sessions) {
        if (s.type === 'Cours' || !s.levels.includes(l.id) || !s.groups.length) continue;
        const m = (mods[normKey(s.module)] = mods[normKey(s.module)] || { name: s.module, count: {}, ids: [] });
        s.groups.forEach(g => (m.count[g] = (m.count[g] || 0) + 1));
        m.ids.push(s.id);
      }
      for (const k of Object.keys(mods)) {
        const m = mods[k];
        const counts = l.groups.map(g => m.count[g] || 0);
        if (new Set(counts).size > 1) {
          const detail = l.groups.map((g, i) => `${g}: ${counts[i]}`).join(', ');
          warnings.push({ kind: 'coverage', ids: m.ids, level: l.id,
            message: `${l.short} · ${m.name} — nombre de TD différent selon les groupes (${detail})` });
        }
      }
    }

    const count = kind => conflicts.filter(c => c.kind === kind).length;
    return {
      conflicts, warnings, bySession,
      counts: { room: count('room'), blocked: count('blocked'), teacher: count('teacher'), group: count('group'),
        total: conflicts.length, warnings: warnings.length },
    };
  }

  /* ---------------------------------------------------------------------
     Résolution automatique des conflits de salles
     --------------------------------------------------------------------- */
  const CAT_FALLBACK = { TD: ['TD', 'SM', 'Amphi'], SM: ['SM', 'Amphi', 'TD'], Amphi: ['Amphi', 'SM', 'TD'] };

  /**
   * Retourne { changes:[{id, from, to, reason}], unresolved:[...], after } sans modifier `state`.
   * options.fillMissing : attribuer aussi une salle aux séances qui n'en ont pas.
   */
  function resolveRooms(state, options = {}) {
    const fillMissing = options.fillMissing !== false;
    const work = clone(state);
    const S = work.sessions;
    const byId = Object.fromEntries(S.map(s => [s.id, s]));
    const rooms = work.rooms;
    const roomIndex = Object.fromEntries(rooms.map((r, i) => [r.id, i]));
    const levelIndex = Object.fromEntries(work.levels.map((l, i) => [l.id, i]));
    const changes = [];
    const unresolved = [];
    const skip = new Set();
    const levelsKey = s => s.levels.slice().sort().join('+');

    // Salles déjà fréquentées par chaque niveau (état de départ) → on les préfère
    const usedByLevel = {};
    for (const s of state.sessions) if (s.room) for (const L of s.levels) (usedByLevel[L] = usedByLevel[L] || new Set()).add(s.room);

    const occupants = (d, t, r) => S.filter(s => s.day === d && s.slot === t && s.room === r);
    const isFree = (d, t, r) => {
      const room = rooms[roomIndex[r]];
      if (!room || room.blocked.includes(slotKey(d, t))) return false;
      return occupants(d, t, r).length === 0;
    };

    function problemSet() {
      const set = new Map(); // id -> raison
      const buckets = {};
      for (const s of S) {
        if (!s.room) { if (fillMissing) set.set(s.id, 'missing'); continue; }
        const k = slotKey(s.day, s.slot) + '|' + s.room;
        (buckets[k] = buckets[k] || []).push(s);
        const room = rooms[roomIndex[s.room]];
        if (room && room.blocked.includes(slotKey(s.day, s.slot))) set.set(s.id, 'blocked');
      }
      for (const k of Object.keys(buckets)) if (buckets[k].length > 1) buckets[k].forEach(s => { if (!set.has(s.id)) set.set(s.id, 'room'); });
      return set;
    }

    // Séances contiguës (même niveau, même jour, même salle) autour de s
    function run(s, filter) {
      const same = S.filter(x => x.id !== s.id && x.day === s.day && x.slot !== s.slot && levelsKey(x) === levelsKey(s) &&
        x.room === s.room && (s.room || normKey(x.module) === normKey(s.module)) && filter(x));
      const slots = new Map(same.map(x => [x.slot, x]));
      const out = [s];
      for (let t = s.slot - 1; slots.has(t); t--) out.unshift(slots.get(t));
      for (let t = s.slot + 1; slots.has(t); t++) out.push(slots.get(t));
      return out;
    }

    function categoryOf(s) {
      const r = s.room && rooms[roomIndex[s.room]];
      if (r) return r.type;
      return s.type === 'Cours' ? 'Amphi' : 'TD';
    }

    // Meilleure salle libre pour TOUTES les séances de l'unité
    function bestRoom(unit) {
      const cat = categoryOf(unit[0]);
      const order = CAT_FALLBACK[cat] || ['TD', 'SM', 'Amphi'];
      const lv = unit[0].levels;
      let best = null;
      for (const r of rooms) {
        if (r.auto === false || r.id === unit[0].room) continue;
        if (!unit.every(s => isFree(s.day, s.slot, r.id))) continue;
        const need = Math.max(0, ...unit.map(s => studentsNeeded(work, s) || 0));
        if (r.capacity && need && need > r.capacity) continue;
        const catRank = order.indexOf(r.type) < 0 ? 9 : order.indexOf(r.type);
        const familiar = lv.some(L => usedByLevel[L] && usedByLevel[L].has(r.id)) ? 0 : 1;
        const score = [catRank, familiar, roomIndex[r.id]];
        if (!best || cmp(score, best.score) < 0) best = { room: r.id, score, rank: catRank * 2 + familiar };
      }
      return best;
    }
    const cmp = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };

    for (let iter = 0; iter < 1000; iter++) {
      const P = problemSet();
      // premier problème non ignoré, dans l'ordre jour → créneau → salle
      const pending = [...P.keys()].map(id => byId[id])
        .filter(s => !skip.has(s.id))
        // les vrais conflits d'abord, les salles manquantes ensuite
        .sort((a, b) => (P.get(a.id) === 'missing') - (P.get(b.id) === 'missing') ||
          a.day - b.day || a.slot - b.slot || (a.room || '').localeCompare(b.room || '') || a.id.localeCompare(b.id));
      if (!pending.length) break;
      const first = pending[0];
      const why = P.get(first.id);

      let candidates;
      if (why === 'room') candidates = occupants(first.day, first.slot, first.room);
      else candidates = [first];
      const movable = candidates.filter(c => !c.locked);

      const options2 = [];
      for (const c of movable) {
        const block = run(c, () => true);
        // On essaie d'abord de déplacer ensemble les séances consécutives en conflit (même salle
        // pour toute la matinée) ; on ne déplace une séance seule que si c'est impossible.
        const unitFull = run(c, x => P.has(x.id) && !x.locked);
        for (const unit of (unitFull.length > 1 ? [unitFull, [c]] : [[c]])) {
          const br = bestRoom(unit);
          if (!br) continue;
          options2.push({
            unit, room: br.room,
            // ordre de préférence : déplacer un TD plutôt qu'un cours, moins de séances déplacées,
            // ne pas couper une série, salle de même catégorie / déjà connue, niveau le plus avancé
            score: [c.type === 'Cours' && why === 'room' && movable.some(o => o.type !== 'Cours') ? 1 : 0,
              unit.length, unit.length < block.length ? 1 : 0, br.rank,
              -Math.max(...c.levels.map(L => levelIndex[L] ?? 0))],
          });
          break;
        }
      }
      // Pour un conflit de salle, l'une des séances doit rester : on ne déplace qu'une unité à la fois
      options2.sort((a, b) => cmp(a.score, b.score));
      const pick = options2[0];
      if (!pick) {
        const ids = candidates.map(c => c.id);
        unresolved.push({ day: first.day, slot: first.slot, room: first.room, ids, reason: why,
          message: movable.length ? 'Aucune salle libre compatible à ce créneau' : 'Toutes les séances concernées sont verrouillées' });
        ids.forEach(id => skip.add(id));
        continue;
      }
      for (const s of pick.unit) {
        const reasonKind = P.get(s.id) || why;
        const others = occupants(s.day, s.slot, s.room).filter(o => o.id !== s.id);
        let reason;
        if (reasonKind === 'missing') reason = 'Salle absente dans le document d\'origine';
        else if (reasonKind === 'blocked') reason = `Salle ${s.room} marquée indisponible`;
        else if (others.length) reason = `Salle ${s.room} déjà occupée par ${others.map(o => label(work, o)).join(', ')}`;
        else reason = `Continuité : même salle que les séances voisines déplacées`;
        changes.push({ id: s.id, day: s.day, slot: s.slot, from: s.room, to: pick.room, reason, label: label(work, s) });
        s.room = pick.room;
      }
    }

    changes.sort((a, b) => a.day - b.day || a.slot - b.slot || a.label.localeCompare(b.label));
    const after = analyze(work);
    return { changes, unresolved, after, state: work };
  }

  /** Salles libres à un créneau (ordre : même catégorie, salles familières du niveau). */
  function freeRooms(state, day, slot, exceptId) {
    const k = slotKey(day, slot);
    return state.rooms.filter(r => !r.blocked.includes(k) &&
      !state.sessions.some(s => s.id !== exceptId && s.day === day && s.slot === slot && s.room === r.id));
  }

  /** Différences entre l'état d'origine et l'état courant. */
  function diff(original, current) {
    const fields = ['levels', 'day', 'slot', 'module', 'type', 'groups', 'room', 'teacher'];
    const o = Object.fromEntries(original.sessions.map(s => [s.id, s]));
    const c = Object.fromEntries(current.sessions.map(s => [s.id, s]));
    const out = [];
    for (const s of current.sessions) {
      if (!o[s.id]) { out.push({ kind: 'added', id: s.id, now: s }); continue; }
      const changed = fields.filter(f => JSON.stringify(o[s.id][f]) !== JSON.stringify(s[f]));
      if (changed.length) out.push({ kind: 'modified', id: s.id, before: o[s.id], now: s, fields: changed });
    }
    for (const s of original.sessions) if (!c[s.id]) out.push({ kind: 'deleted', id: s.id, before: s });
    return out;
  }

  const api = { DAYS, SLOTS, analyze, resolveRooms, freeRooms, diff, normRoom, normKey, label, clone, studentsNeeded, slotKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EDT_ENGINE = api;
})(typeof window !== 'undefined' ? window : globalThis);
