/* =====================================================================
   Exports hors-ligne : Word (.docx), Excel (.xlsx), JSON.
   Un mini-ZIP (sans compression) suffit à produire des fichiers Office valides.
   ===================================================================== */
(function (root) {
  const E = root.EDT_ENGINE;

  /* ---------------- ZIP (méthode "store") ---------------- */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

  function zip(files) { // files: [{name, data:string}]
    const enc = new TextEncoder();
    const parts = []; const central = []; let offset = 0;
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (const f of files) {
      const name = enc.encode(f.name); const data = enc.encode(f.data); const crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint16(10, 0, true); c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  const x = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function download(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ---------------- Aides communes ---------------- */
  function levelSessions(state, levelId) { return state.sessions.filter(s => s.levels.includes(levelId)); }
  function sessionLines(state, s, levelId) {
    const shared = s.levels.length > 1 ? ' (' + s.levels.map(id => (state.levels.find(l => l.id === id) || { short: id }).short).join(' + ') + ')' : '';
    const g = s.groups.length ? ' ' + s.groups.join('+') : '';
    return [s.module + shared, `${s.type}${g} — ${s.room || 'salle ?'}`, s.teacher || ''].filter(Boolean);
  }
  function usedSpan(state, sessions) {
    const days = [...new Set(sessions.map(s => s.day))].sort((a, b) => a - b);
    const maxSlot = Math.max(4, ...sessions.map(s => s.slot));
    return { days: days.length ? days : [0, 1, 2, 3, 4], slots: [...Array(maxSlot + 1).keys()] };
  }

  /* ---------------- WORD (.docx) ---------------- */
  const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  function wRun(text, o = {}) {
    return `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}${o.hl ? '<w:highlight w:val="yellow"/>' : ''}<w:sz w:val="${o.sz || 18}"/></w:rPr><w:t xml:space="preserve">${x(text)}</w:t></w:r>`;
  }
  function wPara(runs, o = {}) {
    return `<w:p><w:pPr><w:spacing w:before="${o.before || 0}" w:after="${o.after || 0}" w:line="240" w:lineRule="auto"/><w:jc w:val="${o.jc || 'center'}"/></w:pPr>${runs}</w:p>`;
  }
  function wCell(width, paras, o = {}) {
    return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${o.span ? `<w:gridSpan w:val="${o.span}"/>` : ''}${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr>${paras || wPara('')}</w:tc>`;
  }
  const BORDERS = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(b => `<w:${b} w:val="single" w:sz="6" w:space="0" w:color="000000"/>`).join('') + '</w:tblBorders>';

  function docxLevel(state, level, opts) {
    const m = state.meta;
    const sessions = levelSessions(state, level.id);
    const { days, slots } = usedSpan(state, sessions);
    const changedIds = opts.changedRooms || new Set();
    const total = 15704; const dayW = 1500; const colW = Math.floor((total - dayW) / slots.length);

    // En-tête (2 colonnes)
    const leftW = 9000, rightW = total - leftW;
    let out = `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/>${BORDERS}<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="${leftW}"/><w:gridCol w:w="${rightW}"/></w:tblGrid><w:tr>`;
    out += wCell(leftW, wPara(wRun(m.university, { b: true, sz: 20 })) + wPara(wRun(m.faculty, { sz: 20 })) + wPara(wRun(`${m.department} — Année universitaire ${m.year}`, { sz: 20 })));
    out += wCell(rightW, wPara(wRun(`Emploi du temps ${m.semester}`, { b: true, sz: 26 })) + wPara(wRun(`Niveau : ${level.name}`, { b: true, sz: 20 })) + wPara(wRun(`Groupes : ${level.groups.map(g => g.replace('G', '')).join('+')}`, { sz: 20 })));
    out += '</w:tr></w:tbl>' + wPara('', { after: 120 });

    // Grille
    out += `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/>${BORDERS}<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="${dayW}"/>${slots.map(() => `<w:gridCol w:w="${colW}"/>`).join('')}</w:tblGrid>`;
    out += '<w:tr><w:trPr><w:tblHeader/></w:trPr>' + wCell(dayW, wPara(wRun('Horaires', { b: true, sz: 20 })), { fill: 'D9D9D9' }) +
      slots.map(t => wCell(colW, wPara(wRun(E.SLOTS[t], { b: true, sz: 20 })), { fill: 'D9D9D9' })).join('') + '</w:tr>';
    for (const d of days) {
      out += `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="1100"/></w:trPr>` + wCell(dayW, wPara(wRun(E.DAYS[d], { b: true, sz: 20 })), { fill: 'F2F2F2' });
      for (const t of slots) {
        const list = sessions.filter(s => s.day === d && s.slot === t)
          .sort((a, b) => (a.type === 'Cours' ? -1 : 0) - (b.type === 'Cours' ? -1 : 0) || (a.groups[0] || '').localeCompare(b.groups[0] || ''));
        let paras = '';
        list.forEach((s, i) => {
          const [mod, info, teacher] = sessionLines(state, s, level.id);
          const hl = changedIds.has(s.id);
          paras += wPara(wRun(mod, { b: true }), { before: i ? 100 : 0 });
          paras += wPara(wRun(info, { hl }));
          if (teacher) paras += wPara(wRun(teacher, { i: true }));
        });
        out += wCell(colW, paras);
      }
      out += '</w:tr>';
    }
    out += '</w:tbl>';
    if (level.notes) out += wPara(wRun('NB : ', { b: true, sz: 20 }) + wRun(level.notes, { sz: 20 }), { jc: 'left', before: 160 });
    if (opts.changedRooms && sessions.some(s => changedIds.has(s.id)))
      out += wPara(wRun('Les salles surlignées en jaune ont été modifiées.', { i: true, sz: 18 }), { jc: 'left', before: 80 });
    return out;
  }

  function exportDocx(state, levelIds, opts = {}) {
    const levels = state.levels.filter(l => levelIds.includes(l.id));
    const body = levels.map((l, i) => (i ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : '') + docxLevel(state, l, opts)).join('');
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W_NS}><w:body>${body}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="567" w:right="567" w:bottom="567" w:left="567" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
      { name: 'word/document.xml', data: doc },
    ];
    const name = levels.length === 1 ? `EDT_${levels[0].short.replace(/\s+/g, '_')}_${state.meta.semester}.docx` : `EDT_tous_niveaux_${state.meta.semester}.docx`;
    download(zip(files), name);
  }

  /* ---------------- EXCEL (.xlsx) ---------------- */
  // styles : 0 normal | 1 cellule bordée | 2 en-tête gris gras | 3 titre gras | 4 bordée surlignée (modif) | 5 bordée rouge (conflit) | 6 bordée gris clair gras
  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="13"/><name val="Calibri"/></font></fonts>
<fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2B3"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF8CBCB"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

  const colName = n => { let s = ''; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

  // rows: [[{v, s}|string, ...], ...]  opts: {widths:[], merges:['A1:F1'], heights:{rowIdx:pts}}
  function sheetXml(rows, opts = {}) {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>';
    if (opts.widths) xml += '<cols>' + opts.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>';
    xml += '<sheetData>';
    rows.forEach((row, r) => {
      const cells = row.map(c => (c && typeof c === 'object') ? c : { v: c, s: 0 });
      const lines = Math.max(1, ...cells.map(c => String(c.v == null ? '' : c.v).split('\n').length));
      const ht = (opts.heights && opts.heights[r]) || (lines > 1 ? lines * 13.5 + 4 : null);
      xml += `<row r="${r + 1}"${ht ? ` ht="${ht}" customHeight="1"` : ''}>`;
      cells.forEach((c, ci) => {
        const ref = colName(ci) + (r + 1);
        if (c.v === '' || c.v == null) { xml += `<c r="${ref}" s="${c.s || 0}"/>`; return; }
        if (typeof c.v === 'number') xml += `<c r="${ref}" s="${c.s || 0}"><v>${c.v}</v></c>`;
        else xml += `<c r="${ref}" s="${c.s || 0}" t="inlineStr"><is><t xml:space="preserve">${x(c.v)}</t></is></c>`;
      });
      xml += '</row>';
    });
    xml += '</sheetData>';
    if (opts.merges && opts.merges.length) xml += `<mergeCells count="${opts.merges.length}">${opts.merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`;
    xml += '<pageMargins left="0.4" right="0.4" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>';
    return xml;
  }

  function exportXlsx(state, analysis, diffList, opts = {}) {
    const sheets = [];
    const changed = new Set(diffList.filter(d => d.kind !== 'deleted' && (d.kind === 'added' || d.fields.includes('room'))).map(d => d.id));
    const conflictIds = new Set(analysis.conflicts.flatMap(c => c.ids));
    const m = state.meta;

    // 1 feuille par niveau
    for (const l of state.levels) {
      const ss = levelSessions(state, l.id);
      const { slots } = usedSpan(state, ss);
      const days = [0, 1, 2, 3, 4, 5].filter(d => ss.some(s => s.day === d));
      const ncol = slots.length + 1;
      const rows = [
        [{ v: `${m.university} — ${m.faculty} — ${m.department}`, s: 3 }],
        [{ v: `Emploi du temps ${m.semester} ${m.year} — ${l.name} (groupes ${l.groups.join(', ')})`, s: 3 }],
        [],
        [{ v: 'Horaires', s: 2 }, ...slots.map(t => ({ v: E.SLOTS[t], s: 2 }))],
      ];
      for (const d of days) {
        const row = [{ v: E.DAYS[d], s: 6 }];
        for (const t of slots) {
          const list = ss.filter(s => s.day === d && s.slot === t);
          const txt = list.map(s => sessionLines(state, s, l.id).join('\n')).join('\n\n');
          const st = list.some(s => conflictIds.has(s.id)) ? 5 : (opts.highlight && list.some(s => changed.has(s.id)) ? 4 : 1);
          row.push({ v: txt, s: st });
        }
        rows.push(row);
      }
      if (l.notes) { rows.push([]); rows.push([{ v: 'NB : ' + l.notes, s: 0 }]); }
      sheets.push({ name: l.short, xml: sheetXml(rows, { widths: [12, ...slots.map(() => 30)], merges: [`A1:${colName(ncol - 1)}1`, `A2:${colName(ncol - 1)}2`] }) });
    }

    // Occupation des salles
    {
      const rooms = state.rooms;
      const rows = [[{ v: `Occupation des salles — ${m.department} — ${m.semester} ${m.year}`, s: 3 }], [],
        [{ v: 'Jour', s: 2 }, { v: 'Créneau', s: 2 }, ...rooms.map(r => ({ v: r.id, s: 2 }))]];
      for (let d = 0; d < 6; d++) for (let t = 0; t < 6; t++) {
        const row = [{ v: E.DAYS[d], s: 6 }, { v: E.SLOTS[t], s: 6 }];
        for (const r of rooms) {
          const list = state.sessions.filter(s => s.day === d && s.slot === t && s.room === r.id);
          const blocked = r.blocked.includes(d + '-' + t);
          const txt = (blocked ? '[INDISPONIBLE]\n' : '') + list.map(s => `${s.levels.map(id => (state.levels.find(l => l.id === id) || { short: id }).short).join('+')} ${s.module}${s.groups.length ? ' ' + s.groups.join('+') : ''}`).join('\n');
          row.push({ v: txt, s: list.length > 1 || (blocked && list.length) ? 5 : (opts.highlight && list.some(s => changed.has(s.id)) ? 4 : 1) });
        }
        rows.push(row);
      }
      sheets.push({ name: 'Occupation salles', xml: sheetXml(rows, { widths: [11, 14, ...rooms.map(() => 18)] }) });
    }

    // Liste des séances
    {
      const rows = [[...['Niveau(x)', 'Jour', 'Créneau', 'Module', 'Type', 'Groupes', 'Salle', 'Enseignant', 'Salle d\'origine', 'Statut']].map(v => ({ v, s: 2 }))];
      const orig = Object.fromEntries((opts.original ? opts.original.sessions : []).map(s => [s.id, s]));
      const sorted = state.sessions.slice().sort((a, b) => a.day - b.day || a.slot - b.slot || a.room.localeCompare(b.room));
      for (const s of sorted) {
        const o = orig[s.id];
        const st = conflictIds.has(s.id) ? 'CONFLIT' : (!o ? 'Ajoutée' : (o.room !== s.room ? 'Salle modifiée' : ''));
        const style = conflictIds.has(s.id) ? 5 : (st ? 4 : 1);
        rows.push([s.levels.map(id => (state.levels.find(l => l.id === id) || { short: id }).short).join(' + '), E.DAYS[s.day], E.SLOTS[s.slot], s.module, s.type,
          s.groups.join('+') || 'Tous', s.room, s.teacher, o ? o.room : '', st].map(v => ({ v, s: style })));
      }
      sheets.push({ name: 'Liste des séances', xml: sheetXml(rows, { widths: [14, 11, 14, 36, 8, 9, 8, 16, 12, 14] }) });
    }

    // Modifications
    {
      const rows = [[...['Niveau(x)', 'Jour', 'Créneau', 'Module', 'Groupes', 'Changement', 'Avant', 'Après']].map(v => ({ v, s: 2 }))];
      for (const d of diffList) {
        const s = d.now || d.before;
        const lv = s.levels.map(id => (state.levels.find(l => l.id === id) || { short: id }).short).join(' + ');
        if (d.kind === 'added') rows.push([lv, E.DAYS[s.day], E.SLOTS[s.slot], s.module, s.groups.join('+') || 'Tous', 'Séance ajoutée', '', s.room].map(v => ({ v, s: 1 })));
        else if (d.kind === 'deleted') rows.push([lv, E.DAYS[s.day], E.SLOTS[s.slot], s.module, s.groups.join('+') || 'Tous', 'Séance supprimée', s.room, ''].map(v => ({ v, s: 1 })));
        else for (const f of d.fields) {
          const fmt = (o) => f === 'day' ? E.DAYS[o.day] : f === 'slot' ? E.SLOTS[o.slot] : Array.isArray(o[f]) ? o[f].join('+') : o[f];
          const fname = { room: 'Salle', day: 'Jour', slot: 'Créneau', teacher: 'Enseignant', module: 'Module', type: 'Type', groups: 'Groupes', levels: 'Niveaux' }[f];
          rows.push([lv, E.DAYS[d.before.day], E.SLOTS[d.before.slot], d.before.module, d.before.groups.join('+') || 'Tous', fname, fmt(d.before) || '(vide)', fmt(d.now)].map(v => ({ v, s: f === 'room' ? 4 : 1 })));
        }
      }
      sheets.push({ name: 'Modifications', xml: sheetXml(rows, { widths: [14, 11, 14, 36, 9, 16, 12, 12] }) });
    }

    const files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        sheets.map((s, i) => `<sheet name="${x(s.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', data: STYLES },
      ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: s.xml })),
    ];
    download(zip(files), `EDT_${state.meta.semester}_${state.meta.year}_complet.xlsx`);
  }

  function exportJson(state) {
    download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }),
      `EDT_sauvegarde_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`);
  }

  root.EDT_EXPORT = { exportDocx, exportXlsx, exportJson, zip, download };
})(window);
