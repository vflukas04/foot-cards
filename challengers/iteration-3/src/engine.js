// Foot Cards – Regel-Engine Version 3 (wie Version 2; neu: Kader 10 + 3, Halbzeit mit bis zu 3 Wechseln und frischem Deck; Passabfangen schlägt „--“, aber keine grünen Pässe; Schuss blocken schlägt „--“; Gewinner des Präsenz-Duells spielt den Zug)
(function (root) {
  'use strict';

  const ZONES = ['LO', 'ZO', 'RO', 'ZM', 'LD', 'ZD', 'RD'];
  const MIRROR = { LO: 'RD', ZO: 'ZD', RO: 'LD', ZM: 'ZM', LD: 'RO', ZD: 'ZO', RD: 'LO' };
  // Dribbling: seitlich wie bisher
  const LATERAL = {
    LO: ['ZO', 'ZM'], ZO: ['LO', 'RO'], RO: ['ZO', 'ZM'],
    ZM: ['LO', 'LD', 'RO', 'RD'],
    LD: ['ZD', 'ZM'], ZD: ['LD', 'RD'], RD: ['ZD', 'ZM'],
  };
  // Querpass: nicht ins ZO
  const QUER = {
    LO: ['ZM'], ZO: ['LO', 'RO'], RO: ['ZM'],
    ZM: ['LO', 'LD', 'RO', 'RD'],
    LD: ['ZD', 'ZM'], ZD: ['LD', 'RD'], RD: ['ZD', 'ZM'],
  };
  const FORWARD = { LD: 'LO', ZD: 'ZM', ZM: 'ZO', RD: 'RO' };
  const BACKWARD = { LO: 'LD', ZO: 'ZM', ZM: 'ZD', RO: 'RD' };
  // Diagonalball: auf den gegenüberliegenden Flügel nach vorn
  const DIAG = { LD: ['RO'], RD: ['LO'], ZD: ['LO', 'RO'], ZM: ['LO', 'RO'], LO: ['RO'], RO: ['LO'], ZO: ['LO', 'RO'] };
  const ZONE_NAME = {
    LO: 'links offensiv', ZO: 'zentral offensiv', RO: 'rechts offensiv', ZM: 'Mittelfeld',
    LD: 'links defensiv', ZD: 'zentral defensiv', RD: 'rechts defensiv',
  };
  const CORNERS = ['links', 'Mitte', 'rechts'];
  const PASSES = ['Querpass', 'Rückpass', 'Steilpass', 'Flanke', 'Vorlage', 'Diagonalball'];
  const NOTHING = a => a === '--' || a === '-- und erschöpft' || a === '-- und Regeneriert';

  let DATA = null;
  let byId = {};
  function setData(d) {
    DATA = d;
    byId = {};
    d.players.forEach(p => (byId[p.id] = p));
    d.gks.forEach(p => (byId[p.id] = p));
    // Vereine aus den Kartendaten (neue Mannschaften aus dem Editor erscheinen so automatisch)
    if (Array.isArray(d.clubs)) d.clubs.forEach(c => { CLUB_NAMES[c.k] = c.name; });
  }
  const card = id => byId[id];
  const power = id => { const c = byId[id]; return c.tempo + c.praesenz + c.assist + c.kopf + c.schuss; };
  const other = s => (s === 'A' ? 'B' : 'A');
  function rnd(n) { return Math.floor(Math.random() * n); }
  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function emptyTeam() {
    // squad: alle 13 Spieler · lineup: die 10 im Spiel · bench: Ersatzbank · subOut/subIn: Wechsel in der Halbzeit
    return { squad: [], lineup: [], bench: [], subOut: [], subIn: [], name: '', gk: null, pile: [], discard: [], exhausted: [], yellow: {}, out: [], tok: { R: false, G: false, B: false } };
  }
  function emptyStats() { return { turns: 0, shots: 0, onTarget: 0, won: 0, lost: 0, passes: 0, yellow: 0, out: 0, duels: 0, xg: 0 }; }
  // Standard: alle 26 Karten → 13 pro Team (10 im Spiel + 3 Bank). Mit kleinerem Pool entsprechend weniger Bank.
  const SQUAD = 13, LINEUP = 10, MAX_SUBS = 3, MARKET = 5;
  const CLUB_NAMES = { vfl: 'VfL Osnabrück', s04: 'FC Schalke 04', dfb: 'Deutschland', dfbf: 'Deutschland (Frauen)', flu: 'Union Flutlicht 05', asche: 'SV Ascheplatz' };
  const squadOf = st => st.squadSize || SQUAD;
  // Spielgröße: 10 Feldspieler und 2 × 45 Minuten, im Turnier auch 6 bzw. 8 Feldspieler (9 Durchgänge durch den Stapel)
  const lineupOf = st => st.lineupSize || LINEUP;
  const halfOf = st => st.halfLen || 45;
  // Im Turnier hat jede Mannschaft ihren eigenen Kader: Bank = Kader minus Aufstellung
  const benchOf = (st, s) => Math.max(0, (s && (st.mode === 'tour' || st.mode === 'mwt') ? st.teams[s].squad.length : squadOf(st)) - lineupOf(st));
  function setOut(st, k, text, extra) { if (st.cur) st.cur.out = Object.assign({ k, t: text }, st.cur.duel && st.cur.duel.kind !== 'Präsenz' ? { duel: st.cur.duel } : {}, extra || {}); }

  function newGame(opts) {
    opts = opts || {};
    const st = {
      v: 2, seq: 0, gid: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), start: Date.now(), phase: 'draft', mode: opts.mode || 'random', squadSize: SQUAD, poolSize: 0, deck: [],
      names: opts.names || { A: 'Heim', B: 'Gast' },
      teams: { A: emptyTeam(), B: emptyTeam() },
      pool: [], pickOrder: [],
      poss: 'A', ball: 'ZM', minute: 0, half: 1, kickoff: 'A', goals: { A: 0, B: 0 },
      cur: null, flank: false, lastShot: null, log: [], result: null, turn: 0, prev: null, scorers: [],
      holder: null, stats: { A: emptyStats(), B: emptyStats() }, track: [], ps: {}, ready: { A: false, B: false }, halfStats: null,
    };
    st.kickoff = Math.random() < 0.5 ? 'A' : 'B';
    // Vereine: Karten ohne „club“ gehören zum VfL Osnabrück
    const clubOf = id => (byId[id] && byId[id].club) || 'vfl';
    const pickGks = clubs => {
      const pool = DATA.gks.filter(g => clubs.includes(g.club || 'vfl')).map(g => g.id);
      return shuffle(pool.length >= 2 ? pool : DATA.gks.map(g => g.id));
    };
    if (opts.mode === 'tour') return tourNew(st, opts);
    if (opts.mode === 'mwt') return mwtNew(st, opts);
    if (opts.mode === 'club') {
      // Vereinsduell: Die Scouts kennen den Kader des Gegners (Schalke oder Deutschland; 13 zufällige Karten, Startelf und Bank stehen fest).
      // Danach wählt Heim seine 13 aus allen VfL-Karten (Phase „scout“), dann Name und Bank wie gewohnt.
      const own = c => shuffle(DATA.players.filter(p => clubOf(p.id) === c).map(p => p.id));
      const opp = CLUB_NAMES[opts.opp] && opts.opp !== 'vfl' ? opts.opp : 's04';
      const va = DATA.players.filter(p => clubOf(p.id) === 'vfl').map(p => p.id), sb = own(opp);
      const n = Math.min(SQUAD, va.length, sb.length);
      st.mode = 'club'; st.opp = opp; st.squadSize = n; st.poolSize = va.length + n;
      st.vflPool = va;
      const B = st.teams.B;
      B.squad = sb.slice(0, n);
      B.bench = B.squad.slice().sort((x, y) => power(x) - power(y)).slice(0, Math.max(0, n - LINEUP));
      B.lineup = B.squad.filter(id => !B.bench.includes(id));
      B.name = CLUB_NAMES[opp]; st.names.B = B.name;
      const gv = pickGks(['vfl']), gs = DATA.gks.filter(g => g.club === opp).map(g => g.id);
      st.teams.A.gk = gv[0];
      // Stärkster Torhüter des Gegners steht im Tor (niedrigste Eckenwerte): Karius bzw. ter Stegen
      const gsum = id => byId[id].fields.reduce((x, y) => x + y, 0);
      B.gk = gs.length ? gs.slice().sort((x, y) => gsum(x) - gsum(y))[0] : gv[1];
      st.opts = { mode: 'club', opp, pool: null, poolIds: null, chaseRule: normChase(opts.chaseRule), botLevel: opts.botLevel || 'normal' };
      st.phase = 'scout';
      log(st, `Vereinsduell: Die Scouts erwarten ${B.name} mit ${B.lineup.map(id => card(id).name).join(', ')}. Bank: ${B.bench.map(id => card(id).name).join(', ')}.`, 'info');
      return st;
    }
    // Kartenpool: alle Karten oder eine zufällige Auswahl (gerade Anzahl, mindestens 2 × LINEUP); höchstens 13 pro Mannschaft
    // Benutzerdefiniert: nur die angehakten Karten (mindestens 2 × LINEUP, sonst alle)
    const ids = DATA.players.map(p => p.id);
    const custom = Array.isArray(opts.poolIds) ? opts.poolIds.filter(id => ids.includes(id)) : null;
    const all = shuffle(custom && custom.length >= 2 * LINEUP ? custom : ids);
    const want = Math.max(2 * LINEUP, Math.min(all.length, opts.pool || all.length));
    const pool = all.slice(0, want - (want % 2));
    st.opts = { mode: st.mode, pool: opts.pool || null, poolIds: custom && custom.length >= 2 * LINEUP ? custom : null, chaseRule: normChase(opts.chaseRule), botLevel: opts.botLevel || 'normal' };
    st.poolSize = pool.length; st.squadSize = Math.min(SQUAD, pool.length / 2);   // größerer Pool: Karten bleiben übrig
    // Torhüter: nur von Vereinen, deren Karten im Pool sind
    const gks = pickGks([...new Set(pool.map(clubOf))]);
    st.teams.A.gk = gks[0];
    st.teams.B.gk = gks[1];
    const order = [];
    for (let i = 0; i < st.squadSize; i++) order.push(...(i % 2 === 0 ? ['A', 'B'] : ['B', 'A']));
    if (st.mode === 'draft') {
      // Kompletter Draft: alle Karten des Pools liegen offen
      st.pool = pool; st.pickOrder = order;
      log(st, `Draft beginnt (${st.poolSize} Karten). ${st.names.A} wählt zuerst.`);
    } else if (st.mode === 'market') {
      // Offener Markt: 5 Karten liegen offen, für jede gewählte wird eine vom verdeckten Stapel aufgedeckt
      st.pool = pool.slice(0, MARKET); st.deck = pool.slice(MARKET); st.pickOrder = order;
      log(st, `Offener Markt beginnt (${st.poolSize} Karten, ${MARKET} offen). ${st.names.A} wählt zuerst.`);
    } else {
      st.mode = 'random';
      st.teams.A.squad = pool.slice(0, st.squadSize);
      st.teams.B.squad = pool.slice(st.squadSize, 2 * st.squadSize);
      startSetup(st);
    }
    return st;
  }
  function log(st, text, kind) {
    st.log.push({ m: st.minute, t: text, k: kind || '' });
    if (st.log.length > 1500) st.log.splice(0, st.log.length - 1500);   // reicht für ein ganzes Spiel (Archiv)
  }
  // Nach dem Draft: Jede Mannschaft gibt sich einen Namen und wählt 3 Ersatzspieler
  function startSetup(st) {
    st.phase = 'setup'; st.ready = { A: false, B: false };
    log(st, 'Kader komplett. Beide Mannschaften wählen Namen und Ersatzbank.', 'info');
  }
  function startMatch(st) {
    for (const s of ['A', 'B']) { const t = st.teams[s]; t.pile = shuffle(t.lineup); t.discard = []; }
    st.poss = st.kickoff; st.ball = 'ZM'; st.minute = 0; st.half = 1;
    log(st, `Anpfiff. ${st.names[st.poss]} hat Anstoß.`, 'whistle');
    beginTurn(st);
  }
  function draw(st, s) {
    const t = st.teams[s];
    if (t.pile.length === 0) {
      t.pile = shuffle(t.discard.filter(id => !t.out.includes(id)));
      t.discard = [];
      if (t.pile.length) log(st, `${st.names[s]}: Stapel durchgespielt, neu gemischt.`, 'info');
      // Letztes Mischen der regulären Spielzeit: Der neue Stapel reicht bis zum Ende der zweiten Halbzeit
      if (t.pile.length && st.half === 2 && !st.finalPhase && st.minute + t.pile.length >= 2 * halfOf(st)) {
        st.finalPhase = true; log(st, 'Schlussphase: Die Stapel werden zum letzten Mal gemischt.', 'whistle');
      }
    }
    return t.pile.shift() || null;
  }
  // Angreifer deckt zuerst auf
  function beginTurn(st) {
    const att = st.poss;
    const id = draw(st, att);
    st.turn = (st.turn || 0) + 1;
    st.cur = {
      turn: st.turn, possStart: st.poss, ballStart: st.ball, minute: st.minute, out: null, header: st.flank, through: st.through || null, presence: !!st.presence, volley: !!st.volley,
      att: { id, alt: null, opt: null, pay: null, fresh: false, zone: st.ball },
      def: null,
    };
    st.phase = 'att';
    // Die Abwehr zieht ihre Karte gleich zu Beginn und sieht sie schon, während der Angriff überlegt.
    // Seit 19.11. (Issue #44) auch beim Direktschuss nach Vorlage: Die Abwehr kann ihn wie jeden Schuss stoppen.
    {
      const defS = other(att);
      const did = draw(st, defS);
      st.cur.def = { id: did, alt: null, opt: null, pay: null, fresh: false, zone: MIRROR[st.ball], open: !!st.cur.presence };
    }
    // Tempo-Duell nach Steilpass: wird sofort entschieden. Gewinnt der Angreifer, kommt der Ball an und
    // dieselbe Karte macht ihre Aktion (keine neue Karte). Die Abwehr ist überlaufen (siehe chaseRule).
    if (st.cur.through) {
      const c = st.cur, to = c.through.to, defS = other(att), did = c.def && c.def.id;
      st.through = null;
      c.att.action = 'Steilpass-Lauf'; if (c.def) c.def.action = 'Hinterherlaufen';
      if (!id) { st.ball = to; return change(st, 'Steilpass abgelaufen'); }
      const r = duel(id, did, 'tempo', 'praesenz');
      c.duel = r; st.stats[r.win === 'def' ? defS : att].duels++;
      log(st, `Tempo-Duell nach Steilpass: ${duelText(r)}.`, 'duel');
      if (r.win === 'att') { ratePt(st, id, .5); ratePt(st, did, -.5); } else if (r.win === 'def') { ratePt(st, did, .5); ratePt(st, id, -.5); }
      if (r.win === 'def') { st.ball = to; return change(st, 'Steilpass abgelaufen', r); }
      if (r.win === 'tie') { setOut(st, 'keep', 'Gleichstand im Tempo-Duell – Ball bleibt'); return endTurn(st, false); }
      st.ball = to; st.stats[att].passes++;
      c.chase = true; c.att.action = null; c.att.zone = to;
      if (c.def) { c.def.action = null; c.def.zone = MIRROR[to]; c.def.open = true; }
      log(st, `Steilpass kommt an: ${card(id).name} ist schneller und macht seine Aktion in ${ZONE_NAME[to]}.`, 'ok');
      return;
    }
    // Kerze: Der Ball war hoch in der Luft. Die beiden neuen Karten springen zum Kopfball (Kopfball, bei Gleichstand
    // Präsenz). Wer gewinnt, hat den Ball; die Karten sind verbraucht, danach beginnt ein neuer Zug.
    if (st.kerze) {
      const c = st.cur, defS = other(att), did = c.def && c.def.id;
      st.kerze = false; c.kerze = true;
      c.att.action = 'Kopfball nach Kerze'; if (c.def) c.def.action = 'Kopfball nach Kerze';
      if (!id || !did) { setOut(st, 'keep', 'Der Ball kommt herunter – niemand geht hin'); return endTurn(st, false); }
      const r = duel(id, did, 'kopf', 'praesenz');
      c.duel = r; st.stats[r.win === 'def' ? defS : att].duels++;
      log(st, `Kopfballduell nach der Kerze: ${duelText(r)}.`, 'duel');
      if (r.win === 'att') { ratePt(st, id, .5); ratePt(st, did, -.5); } else if (r.win === 'def') { ratePt(st, did, .5); ratePt(st, id, -.5); }
      if (r.win === 'def') return change(st, 'Kerze verloren', r);
      setOut(st, 'keep', r.win === 'att' ? `${card(id).name} holt die Kerze herunter` : 'Gleichstand – der Ball bleibt', { duel: r });
      return endTurn(st, false);
    }
    // Präsenz-Duell: die Abwehrkarte liegt offen, bevor der Angreifer wählt
    if (st.cur.presence) {
      st.presence = false;
      const defS = other(att);
      const did = st.cur.def.id;
      if (!id || !did) { st.cur.presence = false; return; }
      const r = duel(id, did, 'praesenz', 'tempo', auraBonus(st, att));
      st.cur.duel = r; st.stats[r.win === 'def' ? defS : att].duels++;
      log(st, `Präsenz-Duell: ${duelText(r)}.`, 'duel');
      if (r.win === 'att') { ratePt(st, id, .5); ratePt(st, did, -.5); } else if (r.win === 'def') { ratePt(st, did, .5); ratePt(st, id, -.5); }
      if (r.win === 'def') {
        // Version 3: Der Ball war frei. Gewinnt die Abwehr, wird sie zum Angreifer und spielt den Zug
        // mit ihrer gerade gezogenen Karte; der Verlierer verteidigt mit seiner. Beide Karten liegen offen.
        const c = st.cur;
        st.stats[defS].won++;
        c.possOrig = att;
        st.poss = defS; st.ball = MIRROR[st.ball]; st.holder = null;
        c.possStart = defS; c.ballStart = st.ball;
        c.att = { id: did, alt: null, opt: null, pay: null, fresh: false, zone: st.ball };
        c.def = { id, alt: null, opt: null, pay: null, fresh: false, zone: MIRROR[st.ball], open: true };
        c.duel = { kind: r.kind, a: r.d, d: r.a, kind2: r.kind2, a2: r.d2, d2: r.a2, win: 'att', swapped: true };
        log(st, `${card(did).name} kommt zuerst an den Ball: ${st.names[defS]} greift jetzt an und sieht die Karte von ${card(id).name}.`, 'change');
        return;
      }
      log(st, `${st.names[att]} bleibt am Ball und sieht die Karte der Abwehr.`, 'info');
    }
  }
  // Token gehören zu einer Aktion: ato/dto = Token je Option (z. B. ["", "BGR"] = nur die Option hinter „/“).
  // Ältere Karten ohne ato/dto: Token der Zeile gehen an die einzige Option bzw. an die Option hinter „/“.
  function optTok(list, per, rowTok, i){
    if (Array.isArray(per)) return per[i] || '';
    if (!rowTok) return '';
    return i === list.length - 1 ? rowTok : '';
  }
  function zoneRow(id, zone, role) {
    const z = card(id).z[zone];
    if (role === 'def') return { opts: z.d.map((a, i) => ({ a, g: 0, tok: optTok(z.d, z.dto, z.dt, i) })), tok: z.dt };
    return { opts: z.a.map(([a, g], i) => ({ a, g, tok: optTok(z.a, z.ato, z.at, i) })), tok: z.at };
  }
  function actor(st) {
    switch (st.phase) {
      case 'draft': return st.pickOrder[0];
      case 'scout': return 'A';
      case 'tdraft': return st.tour.toMove;
      case 'tsteal': return st.tour.steal.by;
      case 'mmarket': return st.mwt.step === 'sell' ? other(st.mwt.buyer) : st.mwt.step === 'name' ? st.mwt.active : st.mwt.buyer;
      case 'mfinal': return !st.mwt.ready.A ? 'A' : !st.mwt.ready.B ? 'B' : null;
      case 'setup': case 'half': return !st.ready.A ? 'A' : !st.ready.B ? 'B' : null;
      case 'def': case 'def_pick2': case 'gk': return other(st.poss);
      case 'att': case 'move': case 'dist': case 'shot': return st.poss;
      default: return null;
    }
  }
  const chaseRule = st => (st.opts && st.opts.chaseRule) || 'pay';
  // Testregel nach verlorenem Tempo-Duell: 'pay' = überlaufen (nur gegen Kosten), 'free' = normal, 'none' = Abwehr unmöglich
  function normChase(r) { return r === 'free' || r === 'none' ? r : 'pay'; }
  function canPay(st, s, role, side) {
    const t = st.teams[s];
    return {
      exhaust: !t.exhausted.includes(side.id) && !side.fresh,
      token: t.tok[role === 'def' ? 'B' : 'R'] && !(role === 'def' && side.usedBlue2),
    };
  }
  function distributions(n) {
    const out = [];
    for (let a = 0; a <= n; a++) for (let b = 0; b <= n - a; b++) out.push([a, b, n - a - b]);
    return out;
  }
  function legal(st, s) {
    // Mannschaft und Halbzeit: beide Seiten handeln unabhängig voneinander, jede einmal
    if (st.phase === 'setup' || st.phase === 'half') return st.ready[s] ? [] : [{ type: st.phase === 'setup' ? 'team' : 'ready' }];
    if (st.phase === 'scout') return s === 'A' ? [{ type: 'squad' }] : [];
    if (st.phase === 'tdraft') return tourPicks(st, s);
    if (st.phase === 'tsteal') { const T = st.tour; return T.steal.by === s ? [...T.col[T.steal.from].f, ...T.col[T.steal.from].g].map(id => ({ type: 'tsteal', id })) : []; }
    if (st.phase === 'over' && st.tour) return [{ type: 'tnext' }];
    if (st.phase === 'mmarket') return mwtLegal(st, s);
    if (st.phase === 'mfinal') return st.mwt.ready[s] ? [] : [{ type: 'mfinal' }];
    if (st.phase === 'over' && st.mwt) return [{ type: 'mnext' }];
    if (actor(st) !== s) return [];
    const acts = [];
    const ph = st.phase;
    if (ph === 'draft') { st.pool.forEach(id => acts.push({ type: 'pick', id })); return acts; }
    if (ph === 'att' || ph === 'def') {
      const side = st.cur[ph];
      const t = st.teams[s];
      if (!side.id) { acts.push({ type: 'choose', opt: 0 }); return acts; }
      if (st.cur.header || (st.cur.through && !st.cur.chase) || (st.cur.volley && ph === 'att')) { acts.push({ type: 'choose', opt: 0 }); return acts; }
      // Abwehr nach verlorenem Tempo-Duell (Testregel „überlaufen“): nur gegen Kosten.
      // Option vor „/“: erschöpfen ODER blauer Token · Option hinter „/“: beides · sonst „nicht verteidigen“
      // Testregel „Abwehr unmöglich“: nach verlorenem Tempo-Duell kann die Abwehr gar nicht eingreifen
      if (ph === 'def' && st.cur.chase && chaseRule(st) === 'none') { acts.push({ type: 'nodef' }); return acts; }
      if (ph === 'def' && st.cur.chase && chaseRule(st) === 'pay') {
        acts.push({ type: 'nodef' });
        const row = zoneRow(side.id, side.zone, ph);
        const ex = !t.exhausted.includes(side.id) && !side.fresh, tk = t.tok.B;
        if (ex) acts.push({ type: 'choose', opt: 0, pay: 'exhaust' });
        if (tk) acts.push({ type: 'choose', opt: 0, pay: 'token' });
        if (row.opts.length > 1 && ex && tk) acts.push({ type: 'choose', opt: 1, pay: 'both' });
        if (t.exhausted.includes(side.id) && t.tok.G && !side.fresh) acts.push({ type: 'green' });
        return acts;
      }
      if (ph === 'def' && t.tok.B && !side.usedBlue2) acts.push({ type: 'blue2' });
      if (t.exhausted.includes(side.id) && t.tok.G && !side.fresh) acts.push({ type: 'green' });
      const row = zoneRow(side.id, side.zone, ph);
      acts.push({ type: 'choose', opt: 0 });
      if (row.opts.length > 1) {
        const p = canPay(st, s, ph, side);
        if (p.exhaust) acts.push({ type: 'choose', opt: 1, pay: 'exhaust' });
        if (p.token) acts.push({ type: 'choose', opt: 1, pay: 'token' });
      }
      return acts;
    }
    if (ph === 'def_pick2') { acts.push({ type: 'keep', id: st.cur.def.id }, { type: 'keep', id: st.cur.def.alt }); return acts; }
    if (ph === 'move') { st.cur.targets.forEach(z => acts.push({ type: 'move', zone: z })); return acts; }
    if (ph === 'dist') {
      const sh = st.cur.shot;
      distributions(sh.points).forEach(add => acts.push({ type: 'dist', add, boost: false }));
      if (st.teams[s].tok.R && !st.cur.att.usedRed) distributions(sh.points + 1).forEach(add => acts.push({ type: 'dist', add, boost: true }));
      return acts;
    }
    if (ph === 'gk') { [0, 1, 2].forEach(n => acts.push({ type: 'gk', n })); return acts; }
    if (ph === 'shot') { [0, 1, 2].forEach(n => acts.push({ type: 'aim', n })); return acts; }
    return acts;
  }
  function sameAct(a, b) {
    return a.type === b.type && a.opt === b.opt && (a.pay || null) === (b.pay || null) && a.id === b.id && a.zone === b.zone && a.n === b.n &&
      !!a.boost === !!b.boost && JSON.stringify(a.add || null) === JSON.stringify(b.add || null);
  }

  // Freie Eingaben (Name, Ersatzbank, Wechsel) werden einzeln geprüft
  function validFree(st, s, act) {
    const t = st.teams[s];
    if (!legal(st, s).some(a => a.type === act.type)) return false;
    if (act.type === 'team') {
      const b = act.bench;
      return Array.isArray(b) && b.length === benchOf(st, s) && new Set(b).size === b.length && b.every(id => t.squad.includes(id)) && typeof (act.name || '') === 'string'
        && (act.gk == null || (t.gks || []).includes(act.gk));
    }
    if (act.type === 'tnext') return st.phase === 'over' && !!st.tour;
    if (act.type === 'mnext') return st.phase === 'over' && !!st.mwt;
    if (act.type === 'mfinal') return st.phase === 'mfinal' && mwtFinalOk(st, s, act);
    if (act.type === 'squad') {
      const ids = act.ids;
      return Array.isArray(ids) && ids.length === squadOf(st) && new Set(ids).size === ids.length && ids.every(id => (st.vflPool || []).includes(id));
    }
    if (act.type === 'ready') {
      const subs = act.subs || [];
      if (!Array.isArray(subs) || subs.length > MAX_SUBS) return false;
      const outs = subs.map(x => x[0]), ins = subs.map(x => x[1]);
      return new Set(outs).size === outs.length && new Set(ins).size === ins.length &&
        outs.every(id => t.lineup.includes(id) && !t.out.includes(id)) && ins.every(id => t.bench.includes(id));
    }
    return false;
  }
  function apply(st0, s, act) {
    const free = act && (act.type === 'team' || act.type === 'ready' || act.type === 'squad' || act.type === 'tnext' || act.type === 'mnext' || act.type === 'mfinal');
    if (free ? !validFree(st0, s, act) : !legal(st0, s).some(a => sameAct(a, act))) throw new Error('Unzulässiger Zug: ' + JSON.stringify(act));
    const st = structuredClone(st0);
    st.seq++;
    switch (act.type) {
      case 'pick': {
        st.teams[s].squad.push(act.id);
        st.pool = st.pool.filter(x => x !== act.id);
        st.pickOrder.shift();
        log(st, `${st.names[s]} wählt ${card(act.id).name}.`, 'info');
        // Offener Markt: Lücke vom verdeckten Stapel auffüllen
        if (st.deck && st.deck.length) { const nx = st.deck.shift(); st.pool.push(nx); st.lastReveal = nx; } else st.lastReveal = null;
        // Die letzte Karte ist keine echte Wahl: Sie geht automatisch an die Mannschaft, die noch dran wäre
        if (st.pickOrder.length === 1 && st.pool.length === 1 && !(st.deck && st.deck.length)) {
          const last = st.pickOrder.shift(), id = st.pool.pop();
          st.teams[last].squad.push(id);
          log(st, `${st.names[last]} bekommt die letzte Karte: ${card(id).name}.`, 'info');
        }
        if (!st.pickOrder.length) startSetup(st);
        break;
      }
      case 'tpick': {
        const T = st.tour, o = other(s), k = isGk(act.id) ? 'g' : 'f';
        if (T.market[o].includes(act.id)) { T.tokens[s]--; T.market[o] = T.market[o].filter(x => x !== act.id); if (T.deck.length) T.market[o].push(T.deck.shift()); }
        else if (T.market[s].includes(act.id)) { T.market[s] = T.market[s].filter(x => x !== act.id); if (T.deck.length) T.market[s].push(T.deck.shift()); }
        else T.gkMarket = T.gkMarket.filter(x => x !== act.id);
        T.col[s][k].push(act.id); if (k === 'g') T.gkTaken[s]++;
        T.picksLeft[s]--;
        T.lastPick = { s, id: act.id };
        log(st, `${st.names[s]} draftet ${card(act.id).name}.`, 'info');
        tourAfterPick(st);
        break;
      }
      case 'tsteal': tourSteal(st, s, act.id); break;
      case 'tnext': tourNext(st); break;
      case 'mstack': case 'mbuy': case 'msell': mwtApply(st, s, act); break;
      case 'mnext': mwtNext(st); break;
      case 'mfinal': mwtFinalPick(st, s, act); break;
      case 'squad': {
        // Vereinsduell: Heim hat seine 13 gewählt; Schalke steht schon
        st.teams.A.squad = act.ids.slice();
        log(st, `${st.names.A} wählt den Kader: ${act.ids.map(id => card(id).name).join(', ')}.`, 'info');
        startSetup(st);
        st.ready.B = true;
        break;
      }
      case 'team': {
        const t = st.teams[s];
        t.name = String(act.name || '').trim().slice(0, 24) || (s === 'A' ? 'Heim' : 'Gast');
        if (act.gk) t.gk = act.gk;
        if (st.tour) st.tour.names[s] = t.name;
        if (st.mwt) st.mwt.names[s] = t.name;
        st.names[s] = t.name;
        t.bench = act.bench.slice();
        t.lineup = t.squad.filter(id => !t.bench.includes(id));
        st.ready[s] = true;
        log(st, `${t.name} steht. Auf der Bank: ${t.bench.map(id => card(id).name).join(', ')}.`, 'info');
        if (st.ready.A && st.ready.B) startMatch(st);
        break;
      }
      case 'ready': {
        const t = st.teams[s];
        for (const [o, i] of act.subs || []) {
          t.lineup = t.lineup.map(x => x === o ? i : x);
          t.bench = t.bench.filter(x => x !== i);
          t.subOut.push(o); t.subIn.push(i);
          t.exhausted = t.exhausted.filter(x => x !== i);
          log(st, `Wechsel bei ${t.name || st.names[s]}: ${card(i).name} kommt für ${card(o).name}.`, 'info');
        }
        st.ready[s] = true;
        if (st.ready.A && st.ready.B) startSecondHalf(st);
        break;
      }
      case 'nodef': {
        const side = st.cur.def;
        side.action = 'keine Abwehr'; side.opt = null; side.pay = null; side.gotTok = []; side.tired = false;
        log(st, `Abwehr ${st.names[s]}: ${side.id ? card(side.id).name : 'niemand'} ist überlaufen und greift nicht ein.`, 'def');
        resolve(st);
        break;
      }
      case 'blue2': {
        const side = st.cur.def;
        st.teams[s].tok.B = false;
        side.usedBlue2 = true;
        side.alt = draw(st, s);
        log(st, `${st.names[s]} setzt den blauen Token ein und zieht einen zweiten Verteidiger.`, 'token');
        if (side.alt) st.phase = 'def_pick2';
        break;
      }
      case 'keep': {
        const side = st.cur.def;
        const drop = act.id === side.id ? side.alt : side.id;
        side.id = act.id; side.alt = null; side.fresh = false;
        st.teams[s].pile.push(drop);
        st.phase = 'def';
        break;
      }
      case 'green': {
        const role = st.phase;
        const side = st.cur[role];
        const t = st.teams[s];
        t.tok.G = false;
        t.exhausted = t.exhausted.filter(x => x !== side.id);
        side.fresh = true;
        log(st, `${st.names[s]} setzt den grünen Token ein: ${card(side.id).name} ist wieder frisch.`, 'token');
        break;
      }
      case 'choose': {
        const role = st.phase;
        const side = st.cur[role];
        const t = st.teams[s];
        side.opt = act.opt;
        side.pay = act.pay || null;
        side.gotTok = [];
        side.tired = !!side.id && t.exhausted.includes(side.id);   // spielt außer Atem (für Geräusch und Anzeige)
        if (!side.id) { side.action = '--'; side.green = false; }
        else if (st.cur.volley && role === 'att') {
          side.action = 'Direktschuss'; side.green = false;
          log(st, `Angriff ${st.names[s]}: ${card(side.id).name} schießt direkt nach der Vorlage (Schusswert ${card(side.id).schuss}).`, role);
        }
        else if (st.cur.through && !st.cur.chase) {
          side.action = role === 'att' ? 'Steilpass-Lauf' : 'Hinterherlaufen'; side.green = false;
          log(st, `${role === 'att' ? 'Angriff' : 'Abwehr'} ${st.names[s]}: ${card(side.id).name} läuft (Tempo ${card(side.id).tempo}).`, role);
        }
        else if (st.cur.header) {
          side.action = role === 'att' ? 'Kopfball' : 'Kopfballduell'; side.green = false;
          log(st, `${role === 'att' ? 'Angriff' : 'Abwehr'} ${st.names[s]}: ${card(side.id).name} geht zum Kopfball (Wert ${card(side.id).kopf}).`, role);
        } else {
          const row = zoneRow(side.id, side.zone, role);
          side.action = row.opts[act.opt].a;
          side.green = !!row.opts[act.opt].g;
          if (act.pay === 'exhaust' || act.pay === 'both') t.exhausted.push(side.id);
          if (act.pay === 'both') t.tok.B = false;
          if (act.pay === 'token') { t.tok[role === 'def' ? 'B' : 'R'] = false; if (role === 'att') side.usedRed = true; }
          if (side.action === '-- und erschöpft' && !t.exhausted.includes(side.id)) t.exhausted.push(side.id);
          if (side.action === '-- und Regeneriert') t.exhausted = t.exhausted.filter(x => x !== side.id);
          for (const k of row.opts[act.opt].tok) { if (!t.tok[k]) { t.tok[k] = true; side.gotTok.push(k); } }   // nur die Token der gewählten Aktion
          const how = act.pay === 'exhaust' ? ' (erschöpft)' : act.pay === 'token' ? ' (Token)' : '';
          log(st, `${role === 'def' ? 'Abwehr' : 'Angriff'} ${st.names[s]}: ${card(side.id).name} – ${side.action}${side.green ? ' (grün)' : ''}${how}.`, role);
        }
        if (role === 'att' && st.cur.volley && !side.id) {
          st.flank = false; st.through = null; st.presence = false; st.volley = false; st.kerze = false;
          setOut(st, 'keep', 'Keine Karte – kein Schuss'); endTurn(st, false); break;
        } else if (role === 'att') {
          if (!st.cur.def) {
            const defS = other(st.poss);
            const id = draw(st, defS);
            st.cur.def = { id, alt: null, opt: null, pay: null, fresh: false, zone: MIRROR[st.ball] };
          }
          st.phase = 'def';
        } else {
          resolve(st);
        }
        break;
      }
      case 'move': {
        setOut(st, 'ok', `${st.cur.moveLabel} gelingt`, st.cur.duel && st.cur.duel.kind !== 'Präsenz' ? { duel: st.cur.duel } : null);
        st.ball = act.zone;
        log(st, `Ball nach ${ZONE_NAME[act.zone]}.`, 'move');
        endTurn(st, false);
        break;
      }
      case 'dist': {
        const sh = st.cur.shot;
        sh.add = act.add.slice();
        sh.boost = !!act.boost;
        if (act.boost) { st.teams[s].tok.R = false; st.cur.att.usedRed = true; }
        const f = sh.gkBase.map((v, i) => v + sh.add[i]);
        sh.fields = f;
        sh.xg = shotGame(f).v;   // erwartetes Tor vor der Wahl der Ecken
        log(st, `${card(sh.shooter).name} verteilt ${sh.points + (act.boost ? 1 : 0)} Punkte: Torwartfelder jetzt ${f.join(' · ')}.`, 'shot');
        st.phase = 'gk';
        break;
      }
      case 'gk': {
        st.cur.shot.gkN = act.n;
        st.phase = 'shot';
        log(st, `${st.names[s]} hat verdeckt gewählt, wohin der Torwart springt.`, 'info');
        break;
      }
      case 'aim': {
        shoot(st, act.n);
        break;
      }
    }
    return st;
  }

  // Duell: zuerst Wert a, bei Gleichstand Wert b
  function duel(attId, defId, first, second, bonus) {
    const A = card(attId), D = defId ? card(defId) : null;
    const key = { tempo: 'Tempo', praesenz: 'Präsenz', kopf: 'Kopfball' };
    const ba = (bonus && bonus.a) || 0, bd = (bonus && bonus.d) || 0;
    const av = A[first] + ba, dv = (D ? D[first] : 0) + bd;
    const res = { kind: key[first], a: av, d: dv };
    if (ba) res.auraA = ba; if (bd) res.auraD = bd;
    if (av !== dv) { res.win = av > dv ? 'att' : 'def'; return res; }
    const av2 = A[second], dv2 = D ? D[second] : 0;
    res.kind2 = key[second]; res.a2 = av2; res.d2 = dv2;
    res.win = av2 === dv2 ? 'tie' : av2 > dv2 ? 'att' : 'def';
    return res;
  }
  // Ausstrahlung des Torhüters: Bei Präsenz-Duellen in der eigenen Abwehrmitte bekommt der eigene Spieler +Ausstrahlung
  // (Ball beim Angreifer in ZD = vor dessen Tor; Ball in ZO = vor dem Tor der Abwehr)
  function auraBonus(st, attS) {
    const gkA = st.teams[attS].gk, gkD = st.teams[other(attS)].gk;
    if (st.ball === 'ZD' && gkA && card(gkA).aura) return { a: card(gkA).aura, d: 0 };
    if (st.ball === 'ZO' && gkD && card(gkD).aura) return { a: 0, d: card(gkD).aura };
    return null;
  }
  function duelText(r) {
    let t = `${r.kind} ${r.a}:${r.d}`;
    if (r.auraA || r.auraD) t += ` (inkl. +${r.auraA || r.auraD} Ausstrahlung des Torhüters)`;
    if (r.kind2) t += `, dann ${r.kind2} ${r.a2}:${r.d2}`;
    return t;
  }

  function resolve(st) {
    const d = st.cur.def, a = st.cur.att;
    const defS = other(st.poss), attS = st.poss;
    st.flank = false; st.through = null; st.presence = false; st.volley = false; st.kerze = false;
    // Tempo-Duell nach Steilpass: die nächsten beiden Karten laufen, ihre Aktionen entfallen
    if (st.cur.through && !st.cur.chase) {
      const to = st.cur.through.to;
      const r = duel(a.id, d.id, 'tempo', 'praesenz');
      st.cur.duel = r; st.stats[r.win === 'def' ? defS : attS].duels++;
      log(st, `Tempo-Duell nach Steilpass: ${duelText(r)}.`, 'duel');
      if (r.win === 'att') { st.ball = to; st.stats[attS].passes++; log(st, `Steilpass kommt an. Ball nach ${ZONE_NAME[to]}.`, 'ok'); setOut(st, 'ok', 'Steilpass kommt an'); return endTurn(st, false); }
      if (r.win === 'def') { st.ball = to; return change(st, 'Steilpass abgelaufen', r); }
      setOut(st, 'keep', 'Gleichstand im Tempo-Duell – Ball bleibt'); return endTurn(st, false);
    }
    // Kopfballduell nach Flanke: nur die Kopfballwerte zählen, die Abwehraktion entfällt
    if (st.cur.header) {
      const r = duel(a.id, d.id, 'kopf', 'praesenz');
      st.cur.duel = r; st.stats[r.win === 'att' ? attS : defS].duels++;
      log(st, `Kopfballduell: ${duelText(r)}.`, 'duel');
      if (r.win === 'att') return startShot(st, 'Kopfball');
      return change(st, r.win === 'tie' ? 'Kopfballduell unentschieden, Abwehr klärt' : 'Kopfballduell verloren', r);
    }
    let act = a.action;
    if (NOTHING(act)) act = '--';
    if (act === 'Fehlpass') act = 'Ballverlust';
    a.eff = act;
    let da = d.action;
    if (NOTHING(da)) da = '--';
    if (da === 'Gelb') da = 'Gelbe Karte';
    // Überlaufene Abwehr ohne (bezahlte) Aktion: keine Gegenwehr, auch kein Präsenz-Duell
    if (st.cur.chase && (da === '--' || da === 'keine Abwehr')) da = null;
    // 1. Ballverlust / Fehlpass
    if (act === 'Ballverlust') return change(st, a.action === 'Fehlpass' ? 'Fehlpass' : 'Ballverlust');
    // 2. Gelbe Karte
    if (da === 'Gelbe Karte') {
      const t = st.teams[defS];
      t.yellow[d.id] = (t.yellow[d.id] || 0) + 1;
      st.stats[defS].yellow++;
      if (t.yellow[d.id] >= 2) {
        t.out.push(d.id); d.sentOff = true; st.stats[defS].out++;
        log(st, `Gelb-Rot für ${card(d.id).name}! Er fliegt vom Platz.`, 'card');
        setOut(st, 'red', `Gelb-Rot für ${card(d.id).name}!`);
      } else {
        log(st, `Gelbe Karte für ${card(d.id).name}. Foul, ${st.names[attS]} bleibt am Ball.`, 'card');
        setOut(st, 'yellow', `Foul: Gelbe Karte für ${card(d.id).name}`);
      }
      return endTurn(st, false);
    }
    // Direktschuss nach Vorlage: wie ein Schuss zu verteidigen (Block, Schuss blocken, Ballgewinn; Gelb s. o.)
    if (act === 'Direktschuss') {
      if (da === 'Block' || da === 'Schuss blocken') return change(st, 'Direktschuss geblockt');
      if (da === 'Ballgewinn') return change(st, 'Ballgewinn');
      return startShot(st, 'Schuss');
    }
    // 3. Ball sichern
    if (act === 'Ball sichern') { log(st, 'Ball gesichert.', 'ok'); setOut(st, 'keep', 'Ball gesichert'); return endTurn(st, false); }
    const z = st.ball;
    // 4. Steilpass und Sprint: Tempo-Duell
    if (act === 'Steilpass') {
      if (da === 'Passabfangen' && !a.green) return change(st, 'Pass abgefangen');
      if (da === 'Ballgewinn' && !a.green) return change(st, 'Ballgewinn');
      st.flank = false; st.through = { to: FORWARD[z] || z };
      log(st, 'Steilpass gespielt. Im nächsten Zug entscheidet das Tempo der nächsten beiden Karten.', 'ok');
      setOut(st, 'ok', 'Steilpass gespielt – jetzt zählt das Tempo der nächsten Karten');
      return endTurn(st, false);
    }
    // Kerze: Ball hoch in die Luft, die Abwehraktion zählt nicht. Im nächsten Zug Kopfballduell der neuen Karten.
    if (act === 'Kerze') {
      st.kerze = true;
      log(st, 'Kerze! Der Ball steigt hoch in die Luft. Im nächsten Zug entscheidet ein Kopfballduell der neuen Karten.', 'ok');
      setOut(st, 'ok', 'Kerze – gleich kommt das Kopfballduell');
      return endTurn(st, false);
    }
    // Befreiungsschlag: aus der Abwehr gerade nach vorn, danach hat immer der Gegner den Ball (tief in seiner Hälfte).
    // Grün kommt er sicher an; sonst kann Passabfangen ihn direkt vor dem eigenen Tor abfangen.
    if (act === 'Befreiungsschlag') {
      if (da === 'Passabfangen' && !a.green) return change(st, 'Befreiungsschlag abgefangen');
      st.ball = ({ LD: 'LO', ZD: 'ZO', RD: 'RO' })[z] || FORWARD[z] || z;
      st.stats[attS].passes++;
      log(st, `Befreiungsschlag nach ${ZONE_NAME[st.ball]}.`, 'ok');
      return change(st, 'Befreiungsschlag');
    }
    // Slapstick: Der Ballführende stolpert sich durch. Die Abwehraktion zählt nicht; Präsenz-Duell der gespielten Karten
    // (bei Gleichstand Tempo). Gewonnen: Ball eine Zone weiter (nicht stehen bleiben); verloren: Ballbesitzwechsel.
    if (act === 'Slapstick') {
      const targets = [...(FORWARD[z] ? [FORWARD[z]] : []), ...LATERAL[z]];
      if (da === null || !d || !d.id) return offerMove(st, targets, 'Slapstick');
      const r = duel(a.id, d.id, 'praesenz', 'tempo', auraBonus(st, attS));
      st.cur.duel = r; st.stats[r.win === 'def' ? defS : attS].duels++;
      log(st, `Slapstick, Präsenz-Duell: ${duelText(r)}.`, 'duel');
      if (r.win === 'def') return change(st, 'Slapstick misslungen', r);
      if (r.win === 'tie') { setOut(st, 'keep', 'Slapstick – der Ball bleibt irgendwie liegen', { duel: r }); return endTurn(st, false); }
      return offerMove(st, targets, 'Slapstick');
    }
    if (act === 'Sprint' && da !== null) {
      const r = duel(a.id, d.id, 'tempo', 'praesenz');
      st.cur.duel = r; st.stats[r.win === 'def' ? defS : attS].duels++;
      log(st, `Tempo-Duell: ${duelText(r)}.`, 'duel');
      if (r.win === 'def') return change(st, `${act === 'Sprint' ? 'Sprint' : 'Steilpass'} abgelaufen`, r);
      if (r.win === 'tie') { setOut(st, 'keep', 'Gleichstand im Tempo-Duell – Ball bleibt', { duel: r }); return endTurn(st, false); }
      if (act === 'Steilpass') return offerMove(st, FORWARD[z] ? [FORWARD[z]] : [z], 'Steilpass');
      return offerMove(st, [z, ...(FORWARD[z] ? [FORWARD[z]] : []), ...LATERAL[z]], 'Sprint');
    }
    // 5. „--“ gegen „--“: im nächsten Zug entscheidet die Präsenz der nächsten beiden Karten
    if (act === '--' && da === '--') {
      st.presence = true;
      log(st, '„--“ gegen „--“: Im nächsten Zug entscheidet die Präsenz der nächsten beiden Karten.', 'ok');
      setOut(st, 'keep', '„--“ gegen „--“ – im nächsten Zug zählt die Präsenz der nächsten Karten');
      return endTurn(st, false);
    }
    // 6. Verteidigung
    if (da === 'Ballgewinn' && !a.green) return change(st, 'Ballgewinn');
    if (da === 'Passabfangen' && PASSES.includes(act) && !a.green) return change(st, 'Pass abgefangen');
    if (da === 'Passabfangen' && act === '--') return change(st, 'Ball abgefangen');
    if (da === 'Tackling' && (act === 'Dribbling' || act === '--')) return change(st, 'Tackling');
    if (da === 'Block' && (act === 'Schuss' || act === 'Kopfball')) return change(st, 'Geblockt');
    if (da === 'Schuss blocken' && act === 'Schuss') return change(st, 'Schuss geblockt');
    if (da === 'Schuss blocken' && act === '--') return change(st, 'Ball erobert');
    // 7. Erfolg
    switch (act) {
      case '--': log(st, 'Ball bleibt in der Zone.', 'ok'); setOut(st, 'keep', 'Ball bleibt in der Zone'); return endTurn(st, false);
      case 'Querpass': return offerMove(st, QUER[z], 'Querpass');
      case 'Dribbling': return offerMove(st, [z, ...(FORWARD[z] ? [FORWARD[z]] : []), ...LATERAL[z]], 'Dribbling');
      case 'Sprint': return offerMove(st, [z, ...(FORWARD[z] ? [FORWARD[z]] : []), ...LATERAL[z]], 'Sprint');
      case 'Rückpass': return offerMove(st, BACKWARD[z] ? [BACKWARD[z]] : [z], 'Rückpass');
      case 'Diagonalball': return offerMove(st, DIAG[z] || [z], 'Diagonalball');
      case 'Flanke': st.flank = true; st.ball = 'ZO'; st.stats[attS].passes++; log(st, 'Flanke kommt an. Nächster Zug: Kopfball.', 'ok'); setOut(st, 'ok', 'Flanke kommt an – nächster Zug ist ein Kopfball'); return endTurn(st, false);
      case 'Vorlage': st.ball = 'ZO'; st.volley = true; st.stats[attS].passes++; log(st, 'Vorlage. Im nächsten Zug folgt der Direktschuss.', 'ok'); setOut(st, 'ok', 'Vorlage – jetzt folgt der Direktschuss'); return endTurn(st, false);
      case 'Schuss': return startShot(st, act);   // Kopfball gibt es nur im Kopfballduell nach einer Flanke
    }
    log(st, `Unbekannte Aktion „${act}“, Ball bleibt.`, 'info');
    setOut(st, 'keep', 'Ball bleibt');
    endTurn(st, false);
  }

  // Torschuss als Spiel zwischen Schütze und Keeper: Beide wählen gleichzeitig eine Ecke,
  // gleiche Ecke = Parade, sonst Treffer mit Wahrscheinlichkeit p_i = (Feldwert − 1) / 6 (höchstens 1).
  // Wert v = Torchance, wenn beide optimal mischen (Nash-Gleichgewicht). Der Keeper springt in Ecke i
  // mit q_i = 1 − v/p_i, der Schütze zielt auf Ecke i mit x_i ∝ 1/p_i – jeweils nur auf den stärksten Ecken.
  function shotProb(v) { return Math.max(0, Math.min(1, (v - 1) / 6)); }
  function shotGame(fields) {
    const p = fields.map(shotProb);
    const order = [0, 1, 2].sort((i, j) => p[j] - p[i]);
    let best = { v: 0, k: 1 };
    for (let k = 2; k <= 3; k++) {
      const S = order.slice(0, k);
      if (S.some(i => p[i] <= 0)) break;
      const v = (k - 1) / S.reduce((a, i) => a + 1 / p[i], 0);
      if (v > best.v) best = { v, k };
    }
    const S = order.slice(0, best.k);
    const x = [0, 0, 0], q = [0, 0, 0];
    if (best.v > 0) {
      const inv = S.reduce((a, i) => a + 1 / p[i], 0);
      S.forEach(i => { x[i] = (1 / p[i]) / inv; q[i] = 1 - best.v / p[i]; });
    } else { x[order[0]] = 1; q[order[0]] = 1; }
    return { v: best.v, p, x, q };
  }
  // Bot-Regel: ein Feld nur über 7, wenn alle anderen schon mindestens 7 haben (ab 7 trifft der Wurf sicher)
  function distOk(fields) { return fields.every((v, i) => v <= 7 || fields.every((w, j) => j === i || w >= 7)); }
  function pickMix(w) { let r = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0 && w[i] > 0) return i; } return w.indexOf(Math.max(...w)); }

  function startShot(st, kind) {
    const a = st.cur.att, attS = st.poss, defS = other(attS);
    const sh = card(a.id);
    const base = kind === 'Kopfball' ? sh.kopf : sh.schuss;
    const h = st.holder;
    const assistId = h && h.s === attS && h.id !== a.id ? h.id : null;
    const assist = assistId ? card(assistId).assist : 0;
    const fern = kind === 'Schuss' && st.ball !== 'ZO';
    const gk = card(st.teams[defS].gk);
    // Torhüter: Distanz (Fernschuss), 1 gegen 1 (Schuss aus der Mitte vorne, auch Direktschuss), Strafraumbeherrschung (Kopfball)
    const ded = kind === 'Kopfball' ? { k: 'box', name: 'Strafraumbeherrschung', v: gk.box || 0 }
      : fern ? { k: 'dist', name: 'Distanz', v: gk.dist == null ? 1 : gk.dist } : { k: 'ovo', name: '1 gegen 1', v: gk.ovo || 0 };
    const points = Math.max(0, base + assist - ded.v);
    st.cur.shot = { shooter: a.id, kind, base, assist, assistId, fern, ded, points, gkBase: gk.fields.slice(), gk: gk.id, add: [0, 0, 0] };
    st.stats[attS].shots++;
    log(st, `${kind}! ${sh.name} kommt zum Abschluss: ${kind === 'Kopfball' ? 'Kopfball' : 'Schuss'}wert ${base}${assist ? ` + Assist ${assist} (${card(assistId).name})` : ''}${ded.v ? ` − ${ded.name} ${ded.v} (${gk.name})` : ''} = ${points} Punkte.`, 'shot');
    st.phase = 'dist';
  }

  function shoot(st, aim) {
    const attS = st.poss, defS = other(attS);
    const sh = st.cur.shot;
    sh.aim = aim;
    const shooter = card(sh.shooter), gk = card(sh.gk);
    st.cur.shotDone = true;
    if (sh.xg == null) sh.xg = shotGame(sh.fields).v;
    st.stats[attS].xg = (st.stats[attS].xg || 0) + sh.xg;
    log(st, `Schuss nach ${CORNERS[aim]}, Torwart springt nach ${CORNERS[sh.gkN]}.`, 'shot');
    if (aim === sh.gkN) {
      sh.outcome = 'parade';
      st.stats[attS].onTarget++;
      log(st, `Richtige Ecke: Parade von ${gk.name}! Abstoß.`, 'change');
      setOut(st, 'save', `${gk.name} ist in der richtigen Ecke!`);
      st.lastShot = sh; st.poss = defS; st.ball = 'ZD'; st.flank = false; st.through = null; st.presence = false; st.volley = false; st.kerze = false; st.holder = null;
      return endTurn(st, true);
    }
    const need = sh.fields[aim];
    const roll = rnd(6) + 1;
    sh.roll = roll; sh.need = need;
    st.lastShot = sh;
    if (roll < need) {
      sh.outcome = 'tor';
      st.stats[attS].onTarget++;
      st.goals[attS]++;
      st.scorers.push({ id: sh.shooter, s: attS, m: st.minute + 1, assist: sh.assistId });
      log(st, `Würfel ${roll} < ${need}: TOR für ${st.names[attS]}! ${st.goals.A}:${st.goals.B}`, 'goal');
      setOut(st, 'goal', 'TOR!');
      st.poss = defS; st.ball = 'ZM'; st.flank = false; st.through = null; st.presence = false; st.volley = false; st.kerze = false; st.holder = null;
      return endTurn(st, true);
    }
    sh.outcome = 'vorbei';
    log(st, `Würfel ${roll}, gebraucht unter ${need}: daneben. Abstoß.`, 'change');
    setOut(st, 'miss', 'Daneben!');
    st.poss = defS; st.ball = 'ZD'; st.flank = false; st.through = null; st.presence = false; st.volley = false; st.kerze = false; st.holder = null;
    endTurn(st, true);
  }

  function offerMove(st, targets, label) {
    targets = [...new Set(targets)];
    if (!['Dribbling', 'Sprint', 'Slapstick'].includes(label)) st.stats[st.poss].passes++;
    if (targets.length === 1) {
      st.ball = targets[0];
      log(st, `${label} gelingt. Ball nach ${ZONE_NAME[st.ball]}.`, 'ok');
      setOut(st, 'ok', `${label} gelingt`, st.cur.duel && st.cur.duel.kind !== 'Präsenz' ? { duel: st.cur.duel } : null);
      return endTurn(st, false);
    }
    st.cur.targets = targets;
    st.cur.moveLabel = label;
    st.phase = 'move';
    log(st, `${label} gelingt.`, 'ok');
  }

  function change(st, why, duelRes) {
    const from = st.poss;
    if (why === 'Ballverlust' || why === 'Fehlpass') { st.stats[from].lost++; setOut(st, 'change', why + '!'); }
    else { st.stats[other(from)].won++; setOut(st, 'change', why + '!', duelRes ? { duel: duelRes } : null); }
    st.poss = other(from);
    st.ball = MIRROR[st.ball];
    st.flank = false; st.through = null; st.presence = false; st.volley = false; st.kerze = false;
    st.holder = null;
    log(st, `${why}: Ballbesitz wechselt zu ${st.names[st.poss]}.`, 'change');
    endTurn(st, true);
  }

  // ---------- Bewertung: Punkte je Spieler, daraus die Schulnote ----------
  function psOf(st, id){ return st.ps[id] || (st.ps[id] = { n: 0, p: 0 }); }
  function ratePt(st, id, v){ if (id) psOf(st, id).p += v; }
  function rateTurn(st, c){
    const a = c.att, d = c.def, out = c.out || { k: 'keep' }, k = out.k;
    const aId = a && a.id, dId = d && d.id;
    if (aId) psOf(st, aId).n++;
    if (dId) psOf(st, dId).n++;
    const aa = a ? (a.eff || a.action || '--') : '--', da = d ? (d.action || '--') : '--';
    const active = x => x && !/^--/.test(x) && x !== 'Präsenz-Duell';
    const sh = c.shotDone ? c.shot : null;
    if (sh) {
      psOf(st, sh.gk).n++;
      if (sh.outcome === 'tor') { ratePt(st, sh.shooter, 3); ratePt(st, sh.assistId, 1.5); ratePt(st, sh.gk, -1); }
      else if (sh.outcome === 'parade') { ratePt(st, sh.shooter, -.5); ratePt(st, sh.gk, 1.5); }
      else { ratePt(st, sh.shooter, -.5); ratePt(st, sh.gk, .5); }
      return;
    }
    if (k === 'ok') { ratePt(st, aId, 1); if (active(da) && da !== 'Gelb') ratePt(st, dId, -.5); }
    else if (k === 'keep') { if (aa === 'Ball sichern') ratePt(st, aId, .5); }
    else if (k === 'change') {
      if (aa === 'Ballverlust' || aa === 'Fehlpass') ratePt(st, aId, -1.5);
      else { ratePt(st, aId, -1); ratePt(st, dId, 1.5); }
    }
    else if (k === 'yellow') { ratePt(st, dId, -1); ratePt(st, aId, .5); }
    else if (k === 'red') { ratePt(st, dId, -2.5); ratePt(st, aId, .5); }
  }
  // Schulnote 1 (sehr gut) bis 6 (ungenügend), auf halbe Noten gerundet; ohne Einsatz: null
  function gradeOf(o){
    if (!o || !o.n) return null;
    // Pro Einsatz wird ein kleiner Grundertrag erwartet; wer darüber liegt, wird besser als 3,5, wer darunter liegt, schlechter
    const g = 3.5 - 1.1 * (o.p - .3 * o.n) / Math.sqrt(o.n);
    return Math.max(1, Math.min(6, Math.round(g * 2) / 2));
  }
  function grades(st, s, ps){
    const t = st.teams[s], src = ps || st.ps, res = {};
    for (const id of [...t.squad, t.gk]) res[id] = gradeOf(src[id]);
    return res;
  }
  // Zweite Halbzeit: frisch gemischtes Deck aus den 10 Spielern im Spiel (ohne Gelb-Rot), Ablage leer
  function startSecondHalf(st) {
    for (const s of ['A', 'B']) {
      const t = st.teams[s];
      t.pile = shuffle(t.lineup.filter(id => !t.out.includes(id)));
      t.discard = [];
    }
    log(st, `Anpfiff zweite Halbzeit. ${st.names[st.poss]} hat Anstoß.`, 'whistle');
    beginTurn(st);
  }
  function snapSide(x) {
    if (!x) return null;
    return { id: x.id, action: x.action, eff: x.eff, green: x.green, pay: x.pay, gotTok: x.gotTok || [], zone: x.zone, sentOff: !!x.sentOff, usedBlue2: !!x.usedBlue2, fresh: !!x.fresh, tired: !!x.tired };
  }
  function endTurn(st, changed) {
    const c = st.cur;
    // Für Halbzeit und Abpfiff zählt, ob der Ball am Ende bei der anderen Mannschaft ist als vor dem Präsenz-Duell
    const turnover = c && c.possOrig ? st.poss !== c.possOrig : changed;
    if (c) {
      st.stats[c.possStart].turns++;
      if (!changed && c.att && c.att.id) st.holder = { s: c.possStart, id: c.att.id };
      st.prev = {
        turn: c.turn, minute: c.minute, possStart: c.possStart, ballStart: c.ballStart, possEnd: st.poss, ballEnd: st.ball,
        def: snapSide(c.def), att: snapSide(c.att), out: c.out || { k: 'keep', t: 'Ball bleibt' },
        shot: c.shotDone ? c.shot : null, whistle: null, flank: st.flank, header: !!c.header, half: st.half,
      };
      st.track = st.track || [];
      const sh = c.shotDone && c.shot ? c.shot : null;
      st.track.push({
        m: c.minute, h: st.half, ps: c.possStart, bs: c.ballStart, pe: st.poss, be: st.ball, k: (c.out && c.out.k) || 'keep', g: [st.goals.A, st.goals.B],
        sk: sh ? sh.kind : null, aim: sh ? sh.aim : null, gkN: sh ? sh.gkN : null,
        ai: c.att ? c.att.id : null, di: c.def ? c.def.id : null, aa: c.att ? (c.att.eff || c.att.action) : null, da: c.def ? c.def.action : null,
        hd: !!c.header, vo: !!c.volley, pr: !!c.presence, th: c.through ? c.through.to : null, th2: st.through ? st.through.to : null, fl: !!st.flank,
      });
      rateTurn(st, c);
      for (const role of ['att', 'def']) {
        const side = c[role];
        if (!side || !side.id || side.sentOff) continue;
        const s = role === 'att' ? c.possStart : other(c.possStart);
        st.teams[s].discard.push(side.id);
      }
    }
    st.minute++;
    const total = st.goals.A + st.goals.B;
    const H = halfOf(st), extra = Math.max(2, Math.round(H / 9));
    if (st.half === 1 && ((st.minute >= H && turnover) || st.minute >= H + extra)) {
      log(st, `Halbzeitpfiff (${st.minute}. Minute). ${st.goals.A}:${st.goals.B}`, 'whistle');
      if (st.prev) st.prev.whistle = 'Halbzeit';
      st.half = 2; st.minute = H; st.poss = other(st.kickoff); st.ball = 'ZM'; st.flank = false; st.through = null; st.presence = false; st.volley = false; st.kerze = false; st.holder = null;
      // Halbzeitpause: Statistik festhalten, beide können wechseln und melden sich dann bereit
      st.phase = 'half'; st.cur = null; st.ready = { A: false, B: false };
      st.halfStats = structuredClone(st.stats); st.halfPs = structuredClone(st.ps);
      return;
    // Sicherung: Bleibt der Ball endlos bei einer Mannschaft (z. B. nur „--“ gegen „--“ bei kleinen Kadern), wird 10 Minuten nach der Mindest-Nachspielzeit abgepfiffen
    } else if (st.half === 2 && st.minute >= 2 * H + total && (turnover || st.minute >= 2 * H + total + 10)) {
      st.phase = 'over'; st.cur = null;
      const r = st.goals.A === st.goals.B ? 'Unentschieden' : `Sieg ${st.names[st.goals.A > st.goals.B ? 'A' : 'B']}`;
      st.result = r;
      if (st.prev) st.prev.whistle = 'Abpfiff';
      log(st, `Abpfiff (${st.minute}. Minute). Endstand ${st.goals.A}:${st.goals.B}. ${r}.`, 'whistle');
      if (st.tour) tourMatchOver(st);
      if (st.mwt) mwtMatchOver(st);
      return;
    }
    // Reguläre Spielzeit vorbei, das Spiel läuft weiter: Nachspielzeit (nach Toren länger, Abpfiff erst bei Ballwechsel)
    if (st.half === 2 && st.minute >= 2 * H && !st.stoppage) {
      st.stoppage = true; log(st, `Nachspielzeit${total ? `: mindestens ${total} ${total === 1 ? 'Minute' : 'Minuten'} (eine pro Tor)` : ''}. Abgepfiffen wird beim nächsten Ballbesitzwechsel.`, 'whistle');
    }
    beginTurn(st);
  }

  // ---------- Turnier (zwei Spielende, vier Spiele, Draft dazwischen) ----------
  // Stufen: 5. Liga (Union Flutlicht, SV Ascheplatz), VfL, Nationalmannschaften (Männer und Frauen gemischt)
  const tierOfClub = c => (c === 'flu' || c === 'asche') ? 't5' : (c === 'dfb' || c === 'dfbf') ? 'nat' : (!c || c === 'vfl') ? 'vfl' : 'x';
  const tierOf = id => tierOfClub(byId[id] && byId[id].club);
  const isGk = id => !!(byId[id] && byId[id].fields);
  const tierIds = (tier, kind) => (kind === 'g' ? DATA.gks : DATA.players).filter(p => tierOfClub(p.club) === tier).map(p => p.id);
  const TOUR_POINTS = [1, 2, 3, 4];
  const TOUR_STATIONS = [
    { lineup: 6, name: '7 gegen 7', rounds: [{ tier: 't5', picks: 7, gkMarket: true }] },
    { lineup: 8, name: '9 gegen 9', rounds: [{ tier: 'vfl', picks: 3 }] },
    { lineup: 10, name: '11 gegen 11', rounds: [{ tier: 'vfl', picks: 3 }] },
    { lineup: 10, name: 'Finale', rounds: [{ tier: 'vfl', picks: 2 }, { tier: 'nat', picks: 2 }] },
  ];
  const TOUR_MARKET = 3;
  const tourOwned = T => new Set([...T.col.A.f, ...T.col.A.g, ...T.col.B.f, ...T.col.B.g]);
  function tourRound(st) {
    const T = st.tour, R = TOUR_STATIONS[T.station].rounds[T.round], own = tourOwned(T);
    // Stapel: Feldspieler der Stufe, ab Station 2 auch die Torhüter der Stufe; im ersten Draft liegen die Keeper in einem eigenen Markt
    T.deck = shuffle([...tierIds(R.tier, 'f'), ...(R.gkMarket ? [] : tierIds(R.tier, 'g'))].filter(id => !own.has(id)));
    T.market = { A: T.deck.splice(0, TOUR_MARKET), B: T.deck.splice(0, TOUR_MARKET) };
    T.gkMarket = R.gkMarket ? shuffle(tierIds(R.tier, 'g').filter(id => !own.has(id))) : [];
    T.picksLeft = { A: R.picks, B: R.picks };
    T.toMove = T.start;
    log(st, `Turnier, Station ${T.station + 1} (${TOUR_STATIONS[T.station].name}): Draft ${R.tier === 't5' ? 'Fünftligisten' : R.tier === 'vfl' ? 'VfL' : 'Nationalspieler'}, je ${R.picks} Karten. ${st.names[T.start]} zieht zuerst.`, 'info');
  }
  function tourStation(st, i, start, bonus) {
    const T = st.tour;
    T.station = i; T.round = 0; T.start = start; T.tokens = { A: 1, B: 1 }; T.gkTaken = { A: 0, B: 0 };
    if (bonus) T.tokens[bonus]++;   // Beutezug: der Verlierer bekommt für die nächste Station einen zusätzlichen Draft-Token
    if (!bonus) T.lastSteal = null;   // kein Beutezug (Unentschieden): alte Meldung nicht wieder zeigen
    st.phase = 'tdraft'; st.cur = null;
    tourRound(st);
  }
  function tourNew(st, opts) {
    st.mode = 'tour'; st.opts = { mode: 'tour', chaseRule: normChase(opts.chaseRule), botLevel: opts.botLevel || 'normal' };
    st.tour = { station: 0, round: 0, points: { A: 0, B: 0 }, goals: { A: 0, B: 0 }, results: [], names: { A: st.names.A, B: st.names.B },
      col: { A: { f: [], g: [] }, B: { f: [], g: [] } }, tokens: { A: 1, B: 1 }, gkTaken: { A: 0, B: 0 }, deck: [], market: { A: [], B: [] }, gkMarket: [],
      picksLeft: { A: 0, B: 0 }, toMove: 'A', start: 'A', steal: null, lastSteal: null };
    st.teams.A.gk = st.teams.B.gk = null;
    tourStation(st, 0, Math.random() < .5 ? 'A' : 'B');
    return st;
  }
  // Aus dem eigenen Markt gratis, aus dem Markt des Gegners gegen einen Token, Keeper-Markt nur in Station 1.
  // Höchstens ein Torhüter pro Station; in Station 1 muss jeder genau einen Keeper ziehen.
  function tourPicks(st, s) {
    const T = st.tour, o = other(s), acts = [];
    if (T.toMove !== s || T.picksLeft[s] <= 0) return acts;
    const gkOk = T.gkTaken[s] === 0;
    const mustGk = T.gkMarket.length && gkOk && T.picksLeft[s] === 1;
    const can = id => isGk(id) ? gkOk : !mustGk;
    T.market[s].forEach(id => can(id) && acts.push({ type: 'tpick', id }));
    if (T.tokens[s] > 0) T.market[o].forEach(id => can(id) && acts.push({ type: 'tpick', id }));
    if (gkOk) T.gkMarket.forEach(id => acts.push({ type: 'tpick', id }));
    return acts;
  }
  function tourStartMatch(st) {
    const T = st.tour, S = TOUR_STATIONS[T.station];
    const gsum = id => byId[id].fields.reduce((x, y) => x + y, 0);
    st.phase = 'setup'; st.ready = { A: false, B: false };
    st.lineupSize = S.lineup; st.halfLen = S.lineup * 9 / 2;
    st.goals = { A: 0, B: 0 }; st.minute = 0; st.half = 1; st.turn = 0; st.cur = null; st.prev = null; st.scorers = []; st.result = null;
    st.stats = { A: emptyStats(), B: emptyStats() }; st.track = []; st.ps = {}; st.halfStats = null; st.halfPs = null; st.lastShot = null; st.holder = null;
    st.flank = false; st.through = null; st.presence = false; st.volley = false; st.kerze = false; st.finalPhase = false; st.stoppage = false;
    st.kickoff = Math.random() < .5 ? 'A' : 'B';
    for (const s of ['A', 'B']) {
      const t = st.teams[s] = emptyTeam();
      t.squad = T.col[s].f.slice(); t.gks = T.col[s].g.slice();
      t.gk = t.gks.slice().sort((x, y) => gsum(x) - gsum(y))[0] || null;
      t.name = T.names[s] || ''; st.names[s] = T.names[s] || st.names[s];
    }
    st.squadSize = Math.max(st.teams.A.squad.length, st.teams.B.squad.length);
    log(st, `Spiel ${T.station + 1} von 4: ${S.name}, ${S.lineup * 9} Minuten. Beide stellen auf.`, 'info');
  }
  function tourAfterPick(st) {
    const T = st.tour, R = TOUR_STATIONS[T.station].rounds;
    if (T.picksLeft.A > 0 || T.picksLeft.B > 0) { const o = other(T.toMove); if (T.picksLeft[o] > 0) T.toMove = o; return; }
    if (T.round + 1 < R.length) { T.round++; tourRound(st); return; }
    tourStartMatch(st);
  }
  // Spielende: Punkte (bei Unentschieden beide die volle Punktzahl) und Tordifferenz festhalten
  function tourMatchOver(st) {
    const T = st.tour, i = T.station, g = st.goals;
    const w = g.A === g.B ? null : g.A > g.B ? 'A' : 'B';
    for (const s of ['A', 'B']) { if (!w || w === s) T.points[s] += TOUR_POINTS[i]; T.goals[s] += g[s] - g[other(s)]; }
    T.results.push({ station: i, name: TOUR_STATIONS[i].name, goals: [g.A, g.B], winner: w, pts: TOUR_POINTS[i] });
    log(st, `Spiel ${i + 1}: ${w ? st.names[w] + ' gewinnt und bekommt ' + TOUR_POINTS[i] + (TOUR_POINTS[i] === 1 ? ' Punkt' : ' Punkte') : 'Unentschieden, beide bekommen ' + TOUR_POINTS[i] + (TOUR_POINTS[i] === 1 ? ' Punkt' : ' Punkte')}. Stand: ${T.points.A}:${T.points.B}.`, 'info');
  }
  function tourWinner(T) {
    if (T.points.A !== T.points.B) return T.points.A > T.points.B ? 'A' : 'B';
    const fin = T.results[3];
    if (fin && fin.winner) return fin.winner;
    if (T.goals.A !== T.goals.B) return T.goals.A > T.goals.B ? 'A' : 'B';
    return null;
  }
  function tourNext(st) {
    const T = st.tour, last = T.results[T.results.length - 1];
    if (T.station >= TOUR_STATIONS.length - 1) {
      st.phase = 'tover'; T.winner = tourWinner(T);
      log(st, `Turnierende: ${T.winner ? st.names[T.winner] + ' gewinnt das Turnier' : 'Unentschieden'} (${T.points.A}:${T.points.B} Punkte).`, 'info');
      return;
    }
    if (last && last.winner) { st.phase = 'tsteal'; T.steal = { by: last.winner, from: other(last.winner) }; return; }
    tourStation(st, T.station + 1, other(T.start));   // Unentschieden: Reihenfolge wechselt
  }
  function tourSteal(st, s, id) {
    const T = st.tour, o = T.steal.from, k = isGk(id) ? 'g' : 'f';
    T.col[o][k] = T.col[o][k].filter(x => x !== id); T.col[s][k].push(id);
    // Entschädigung: zufällige Karte derselben Stufe und Art aus dem Vorrat
    const own = tourOwned(T), pool = tierIds(tierOf(id), k).filter(x => !own.has(x));
    const comp = pool.length ? pool[rnd(pool.length)] : null;
    if (comp) T.col[o][k].push(comp);
    T.lastSteal = { by: s, from: o, id, comp };
    log(st, `Beutezug: ${st.names[s]} holt ${card(id).name}. ${st.names[o]} bekommt als Entschädigung ${comp ? card(comp).name : 'niemanden (Vorrat leer)'} und einen zusätzlichen Draft-Token.`, 'info');
    T.steal = null;
    tourStation(st, T.station + 1, o, o);   // Verlierer zieht zuerst und bekommt einen zusätzlichen Draft-Token
  }

  // ---------- Marktwert-Turnier (Lukas, Regeln: challengers/iteration-3/TURNIER-MW.md) ----------
  // Drei Vorrunden mit jeweils neuem Kader (4, 6, 8 Feldspieler plus Torhüter), Kauf zum Marktwert, Finale 11 gegen 11 aus allen drei Kadern.
  // Geld in Zehntel-Millionen (ganze Zahlen), damit nichts durch Rundung verloren geht.
  let MWV = {};
  function setMarketValues(m) { MWV = {}; if (m) for (const [id, v] of Object.entries(m)) MWV[id] = Math.round(v * 10); }
  const mwOf = id => MWV[id] != null ? MWV[id] : 50;
  const MWT_GROUPS = { t5: ['flu', 'asche'], ver: ['vfl', 's04'], nat: ['dfb', 'dfbf'] };
  const MWT_GROUP_NAME = { t5: 'Fünftligisten', ver: 'Vereinsstapel', nat: 'Nationalmannschaften' };
  // budget: Geld pro Spieler in dieser Runde; bonus: Siegerbonus für die nächste Runde (nach Runde 3 für das Finale)
  const MWT_ROUNDS = [
    { group: 't5', field: 4, budget: 180, bonus: 15 },
    { group: 'ver', field: 6, budget: 480, bonus: 23 },
    { group: 'nat', field: 8, budget: 800, bonus: 20 },
  ];
  const MWT_FINAL = { field: 10, budget: 850 };
  const MWT_OPEN = 3, MWT_REVEAL = 3;
  const mwtGroupOf = id => { const c = (byId[id] && byId[id].club) || 'vfl'; return Object.keys(MWT_GROUPS).find(g => MWT_GROUPS[g].includes(c)) || null; };
  const mwtIds = (g, kind) => (kind === 'g' ? DATA.gks : DATA.players).filter(p => mwtGroupOf(p.id) === g).map(p => p.id);
  const mwtOwned = M => new Set(M.teams.flatMap(t => [...t.A.f, ...t.B.f, t.A.g, t.B.g].filter(Boolean)));
  function mwtNew(st, opts) {
    st.mode = 'mwt'; st.opts = { mode: 'mwt', chaseRule: normChase(opts.chaseRule), botLevel: opts.botLevel || 'normal' };
    st.mwt = { round: 0, final: false, names: { A: st.names.A, B: st.names.B }, teams: [], results: [], budget: { A: 0, B: 0 }, bonus: { A: 0, B: 0 },
      decks: { t5: [], ver: [], nat: [] }, display: [], gkDisplay: [], active: 'A', start: 'A', step: 'name', buyer: 'A', need: 1, noRebuy: [], sellK: 0,
      pick: { A: null, B: null }, ready: { A: false, B: false }, last: null, winner: null };
    st.teams.A.gk = st.teams.B.gk = null;
    mwtRound(st, 0, Math.random() < .5 ? 'A' : 'B');
    return st;
  }
  function mwtRound(st, r, start) {
    const M = st.mwt, R = MWT_ROUNDS[r];
    M.round = r; M.start = M.active = start; M.teams[r] = { A: { f: [], g: null }, B: { f: [], g: null } };
    // Restgeld verfällt, Schulden (nur nach einem Notkauf) werden abgezogen
    for (const s of ['A', 'B']) { M.budget[s] = R.budget + (M.bonus[s] || 0) + (r > 0 ? Math.min(0, M.budget[s]) : 0); M.bonus[s] = 0; }
    const own = mwtOwned(M);
    for (const g of Object.keys(MWT_GROUPS)) M.decks[g] = shuffle(mwtIds(g, 'f').filter(id => !own.has(id)));
    M.display = M.decks[R.group].splice(0, MWT_OPEN);
    M.gkDisplay = mwtIds(R.group, 'g').filter(id => !own.has(id)).sort((x, y) => mwOf(y) - mwOf(x));
    M.step = 'name'; M.buyer = start; M.need = 1; M.noRebuy = []; M.sellK = 0; M.last = null;
    st.phase = 'mmarket'; st.cur = null; mwtClearBoard(st);
    log(st, `Marktwert-Turnier, Runde ${r + 1}: je ${R.field} Feldspieler und ein Torhüter, Budget ${mwtFmt(M.budget.A)} / ${mwtFmt(M.budget.B)}. Offen liegen 3 ${MWT_GROUP_NAME[R.group]}. ${st.names[start]} nennt zuerst einen Stapel.`, 'info');
  }
  // Anzeigetafel zwischen den Spielen leeren (sonst steht dort noch das letzte Ergebnis)
  function mwtClearBoard(st) { st.goals = { A: 0, B: 0 }; st.minute = 0; st.half = 1; st.stoppage = false; st.finalPhase = false; st.prev = null; }
  const mwtFmt = v => (v / 10).toFixed(1).replace('.', ',') + ' Mio.';
  const mwtTeam = (st, s) => st.mwt.teams[st.mwt.round][s];
  const mwtSlots = (st, s) => { const t = mwtTeam(st, s); return { f: MWT_ROUNDS[st.mwt.round].field - t.f.length, g: t.g ? 0 : 1 }; };
  // Kann s noch m Käufe machen (billigste Kombination, Platz im Kader beachtet)? excl: Karten, die s gerade verkauft hat
  function mwtCheapest(st, s, m, budget, extra) {
    const M = st.mwt, sl = mwtSlots(st, s);
    if (extra) { sl.f -= extra.f || 0; sl.g -= extra.g || 0; }
    if (m <= 0) return 0;
    const ex = new Set([...(M.noRebuy || []), ...((extra && extra.gone) || [])]);
    const fs = M.display.filter(id => !ex.has(id)).map(mwOf).sort((a, b) => a - b);
    const gs = M.gkDisplay.filter(id => !ex.has(id)).map(mwOf).sort((a, b) => a - b);
    let best = Infinity;
    if (m <= sl.f && fs.length >= m) best = Math.min(best, fs.slice(0, m).reduce((a, b) => a + b, 0));
    if (sl.g > 0 && gs.length && m - 1 <= sl.f && fs.length >= m - 1) best = Math.min(best, gs[0] + fs.slice(0, m - 1).reduce((a, b) => a + b, 0));
    return best;
  }
  const mwtFeasible = (st, s, m, budget, extra) => mwtCheapest(st, s, m, budget, extra) <= budget;
  function mwtBuys(st, s) {
    const M = st.mwt, sl = mwtSlots(st, s), out = [];
    const ok = (id, isG) => {
      const c = mwOf(id);
      if (c > M.budget[s] || (M.noRebuy || []).includes(id)) return false;
      return mwtFeasible(st, s, M.need - 1, M.budget[s] - c, { f: isG ? 0 : 1, g: isG ? 1 : 0, gone: [id] });
    };
    if (sl.f > 0) M.display.forEach(id => ok(id, false) && out.push({ type: 'mbuy', id }));
    if (sl.g > 0) M.gkDisplay.forEach(id => ok(id, true) && out.push({ type: 'mbuy', id }));
    return out;
  }
  // Zwangsverkauf: kleinste Zahl k von Feldspielern, deren Verkauf reicht; der Gegner wählt unter allen ausreichenden k-Gruppen
  function mwtSellOptions(st, s) {
    const M = st.mwt, t = mwtTeam(st, s), f = t.f;
    const combos = (arr, k, i = 0, cur = [], out = []) => { if (cur.length === k) { out.push(cur.slice()); return out; } for (let j = i; j < arr.length; j++) { cur.push(arr[j]); combos(arr, k, j + 1, cur, out); cur.pop(); } return out; };
    for (let k = 1; k <= f.length; k++) {
      const good = combos(f, k).filter(S => {
        const gain = S.reduce((a, id) => a + mwOf(id), 0);
        const save = { d: M.display, nr: M.noRebuy, f: t.f };
        M.display = [...M.display, ...S]; M.noRebuy = [...S]; t.f = f.filter(x => !S.includes(x));
        const okk = mwtFeasible(st, s, k + 1, M.budget[s] + gain);
        M.display = save.d; M.noRebuy = save.nr; t.f = save.f;
        return okk;
      });
      if (good.length) return { k, opts: good.map(S => S.slice().sort().join(',')) };
    }
    return { k: 0, opts: [] };
  }
  // Käufer an der Reihe: kann er nichts bezahlen, beginnt der Zwangsverkauf (der Gegner wählt)
  function mwtEnterBuy(st, s, need) {
    const M = st.mwt; M.buyer = s; M.need = need; M.step = 'buy';
    const sl = mwtSlots(st, s);
    if (sl.f + sl.g <= 0) { mwtAfterBuyer(st); return; }
    if (mwtBuys(st, s).length) return;
    const so = mwtSellOptions(st, s);
    if (so.k) { M.step = 'sell'; M.sellK = so.k; M.sellOpts = so.opts; log(st, `${st.names[s]} kann sich keine Karte leisten: Zwangsverkauf. ${st.names[other(s)]} wählt ${so.k === 1 ? 'einen Spieler' : so.k + ' Spieler'} aus, die zum Marktwert auf den Markt gehen.`, 'info'); return; }
    // Kein Torhüter bezahlbar, auch nicht nach Verkäufen: Platzwart Paule (billigster Torhüter) springt ein, für höchstens 0,5 Mio.
    if (sl.g > 0) {
      const paule = DATA.gks.map(g => g.id).sort((x, y) => mwOf(x) - mwOf(y))[0], c = Math.min(mwOf(paule), Math.max(0, M.budget[s]));
      const t = mwtTeam(st, s); t.g = paule; M.budget[s] -= c; M.gkDisplay = M.gkDisplay.filter(x => x !== paule); M.last = { kind: 'paule', s, id: paule };
      log(st, `${st.names[s]} kann sich keinen Torhüter leisten: ${card(paule).name} springt ein (${mwtFmt(c)}).`, 'info');
      M.need--; if (M.need > 0) mwtEnterBuy(st, s, M.need); else mwtAfterBuyer(st);
      return;
    }
    // Notfall (sollte mit den Budgets nicht vorkommen): billigste passende Karte trotzdem, Budget wird negativ
    const cand = [...(sl.f > 0 ? M.display : []), ...(sl.g > 0 ? M.gkDisplay : [])].sort((x, y) => mwOf(x) - mwOf(y));
    if (cand.length) { log(st, `${st.names[s]} kann auch mit Verkäufen nichts bezahlen und kauft ${card(cand[0]).name} auf Schulden. Das Minus wird vom nächsten Budget abgezogen.`, 'info'); mwtDoBuy(st, s, cand[0]); }
    else mwtAfterBuyer(st);
  }
  function mwtDoBuy(st, s, id) {
    const M = st.mwt, t = mwtTeam(st, s), g = isGk(id);
    M.budget[s] -= mwOf(id);
    if (g) { t.g = id; M.gkDisplay = M.gkDisplay.filter(x => x !== id); } else { t.f.push(id); M.display = M.display.filter(x => x !== id); }
    M.last = { kind: 'buy', s, id };
    log(st, `${st.names[s]} kauft ${card(id).name} für ${mwtFmt(mwOf(id))} (Rest ${mwtFmt(M.budget[s])}).`, 'info');
    M.need--;
    if (M.need > 0) { if (!mwtBuys(st, s).length) mwtEnterBuy(st, s, M.need); return; }
    mwtAfterBuyer(st);
  }
  function mwtAfterBuyer(st) {
    const M = st.mwt;
    M.noRebuy = [];
    if (M.buyer === M.active) { mwtEnterBuy(st, other(M.active), 1); return; }
    // Zugende: Älteste Karten kommen unter ihren Stapel, bis 3 offen liegen
    const drop = M.display.slice(0, Math.max(0, M.display.length - MWT_OPEN));
    M.display = M.display.slice(drop.length);
    drop.forEach(id => { const g = mwtGroupOf(id); if (g) M.decks[g].push(id); });
    if (drop.length) log(st, `Vom Markt (unter den Stapel): ${drop.map(id => card(id).name).join(', ')}.`, 'info');
    const full = s => { const sl = mwtSlots(st, s); return sl.f + sl.g <= 0; };
    if (full('A') && full('B')) { mwtStartMatch(st); return; }
    M.active = other(M.active); M.step = 'name'; M.buyer = M.active; M.need = 1;
  }
  function mwtLegal(st, s) {
    const M = st.mwt;
    if (M.step === 'name') return M.active === s ? Object.keys(MWT_GROUPS).filter(g => M.decks[g].length).map(g => ({ type: 'mstack', id: g })) : [];
    if (M.step === 'buy') return M.buyer === s ? mwtBuys(st, s) : [];
    if (M.step === 'sell') return other(M.buyer) === s ? M.sellOpts.map(k => ({ type: 'msell', id: k })) : [];
    return [];
  }
  function mwtApply(st, s, act) {
    const M = st.mwt;
    if (act.type === 'mstack') {
      const shown = M.decks[act.id].splice(0, MWT_REVEAL);
      M.display.push(...shown); M.last = { kind: 'reveal', s, g: act.id, ids: shown };
      log(st, `${st.names[s]} nennt ${MWT_GROUP_NAME[act.id]}: ${shown.map(id => card(id).name + ' (' + mwtFmt(mwOf(id)) + ')').join(', ')}.`, 'info');
      mwtEnterBuy(st, s, 1);
    } else if (act.type === 'mbuy') mwtDoBuy(st, s, act.id);
    else if (act.type === 'msell') {
      const v = M.buyer, t = mwtTeam(st, v), ids = act.id.split(','), gain = ids.reduce((a, id) => a + mwOf(id), 0);
      t.f = t.f.filter(x => !ids.includes(x)); M.budget[v] += gain; M.display.push(...ids); M.noRebuy = ids.slice();
      M.last = { kind: 'sell', s, v, ids };
      log(st, `Zwangsverkauf: ${st.names[s]} schickt ${ids.map(id => card(id).name).join(' und ')} von ${st.names[v]} auf den Markt (+${mwtFmt(gain)}). ${st.names[v]} kauft jetzt ${ids.length + 1} Karten.`, 'info');
      M.step = 'buy'; M.need = ids.length + 1;
    }
  }
  function mwtStartMatch(st) {
    const M = st.mwt, fin = M.final, n = fin ? MWT_FINAL.field : MWT_ROUNDS[M.round].field;
    st.phase = 'setup'; st.ready = { A: false, B: false };
    st.lineupSize = n; st.halfLen = n * 9 / 2;
    st.goals = { A: 0, B: 0 }; st.minute = 0; st.half = 1; st.turn = 0; st.cur = null; st.prev = null; st.scorers = []; st.result = null;
    st.stats = { A: emptyStats(), B: emptyStats() }; st.track = []; st.ps = {}; st.halfStats = null; st.halfPs = null; st.lastShot = null; st.holder = null;
    st.flank = false; st.through = null; st.presence = false; st.volley = false; st.kerze = false; st.finalPhase = false; st.stoppage = false;
    st.kickoff = Math.random() < .5 ? 'A' : 'B';
    for (const s of ['A', 'B']) {
      const t = st.teams[s] = emptyTeam(), src = fin ? M.pick[s] : { f: M.teams[M.round][s].f, g: M.teams[M.round][s].g };
      t.squad = src.f.slice(); t.gks = [src.g]; t.gk = src.g;
      t.name = M.names[s] || ''; st.names[s] = M.names[s] || st.names[s];
    }
    st.squadSize = n;
    log(st, fin ? 'Finale: 11 gegen 11. Beide stellen auf.' : `Spiel ${M.round + 1} von 3: ${n + 1} gegen ${n + 1}, ${n * 9} Minuten. Beide stellen auf.`, 'info');
  }
  function mwtMatchOver(st) {
    const M = st.mwt, g = st.goals, w = g.A === g.B ? null : g.A > g.B ? 'A' : 'B';
    M.results.push({ round: M.final ? 3 : M.round, goals: [g.A, g.B], winner: w });
    if (!M.final && w) M.bonus[w] = MWT_ROUNDS[M.round].bonus;
    log(st, `${M.final ? 'Finale' : 'Spiel ' + (M.round + 1)}: ${w ? st.names[w] + ' gewinnt' + (M.final ? '' : ' und bekommt ' + mwtFmt(MWT_ROUNDS[M.round].bonus) + ' Siegerbonus') : 'Unentschieden'}.`, 'info');
  }
  function mwtNext(st) {
    const M = st.mwt, last = M.results[M.results.length - 1];
    if (M.final) {
      const pre = M.results.filter(r => r.round < 3), wins = s => pre.filter(r => r.winner === s).length, gd = s => pre.reduce((a, r) => a + (s === 'A' ? r.goals[0] - r.goals[1] : r.goals[1] - r.goals[0]), 0);
      M.winner = last.winner || (wins('A') !== wins('B') ? (wins('A') > wins('B') ? 'A' : 'B') : gd('A') !== gd('B') ? (gd('A') > gd('B') ? 'A' : 'B') : null);
      M.winReason = last.winner ? 'Sieg im Finale' : wins('A') !== wins('B') ? `Finale unentschieden, mehr Siege in den Vorrunden (${wins('A')}:${wins('B')})` : gd('A') !== gd('B') ? `Finale unentschieden, bessere Tordifferenz in den Vorrunden (${gd('A') > 0 ? '+' : ''}${gd('A')} / ${gd('B') > 0 ? '+' : ''}${gd('B')})` : 'Finale unentschieden, Vorrunden ausgeglichen';
      st.phase = 'mover';
      log(st, `Turnierende: ${M.winner ? st.names[M.winner] + ' gewinnt das Marktwert-Turnier' : 'Unentschieden'}.`, 'info');
      return;
    }
    const start = last && last.winner ? other(last.winner) : other(M.start);
    if (M.round < MWT_ROUNDS.length - 1) { mwtRound(st, M.round + 1, start); return; }
    M.final = true; M.pick = { A: null, B: null }; M.ready = { A: false, B: false };
    for (const s of ['A', 'B']) { M.budget[s] = MWT_FINAL.budget + (M.bonus[s] || 0) + Math.min(0, M.budget[s]); M.bonus[s] = 0; }
    st.phase = 'mfinal'; st.cur = null; mwtClearBoard(st);
    log(st, `Finale: Jeder wählt 10 Feldspieler (mindestens einen aus jeder Runde) und einen Torhüter aus seinen drei Kadern. Budget ${mwtFmt(M.budget.A)} / ${mwtFmt(M.budget.B)}.`, 'info');
  }
  function mwtFinalOk(st, s, act) {
    const M = st.mwt, ids = act.ids, own = M.teams.map(t => t[s]);
    if (!Array.isArray(ids) || ids.length !== MWT_FINAL.field || new Set(ids).size !== ids.length) return false;
    if (!ids.every(id => own.some(t => t.f.includes(id))) || !own.every(t => t.f.some(id => ids.includes(id)))) return false;
    if (!own.some(t => t.g === act.gk)) return false;
    return ids.reduce((a, id) => a + mwOf(id), 0) + mwOf(act.gk) <= M.budget[s];
  }
  function mwtFinalPick(st, s, act) {
    const M = st.mwt;
    M.pick[s] = { f: act.ids.slice(), g: act.gk }; M.ready[s] = true;
    M.budget[s] -= act.ids.reduce((a, id) => a + mwOf(id), 0) + mwOf(act.gk);
    log(st, `${st.names[s]} hat die Final-Elf gewählt.`, 'info');
    if (M.ready.A && M.ready.B) mwtStartMatch(st);
  }
  // Bot fürs Marktwert-Turnier: einfach, zum Testen des Ablaufs
  function mwtBot(st, s, acts) {
    const M = st.mwt;
    if (st.phase === 'mfinal') {
      const own = M.teams.map(t => t[s]), all = own.flatMap(t => t.f), B = M.budget[s];
      const gk = own.map(t => t.g).sort((x, y) => mwOf(y) - mwOf(x)).find(g => mwOf(g) <= B * .15) || own.map(t => t.g).sort((x, y) => mwOf(x) - mwOf(y))[0];
      let pick = own.map(t => t.f.slice().sort((x, y) => mwOf(x) - mwOf(y))[0]);
      const rest = all.filter(id => !pick.includes(id)).sort((x, y) => mwOf(y) - mwOf(x));
      const cost = arr => arr.reduce((a, id) => a + mwOf(id), 0) + mwOf(gk);
      for (const id of rest) {
        if (pick.length >= MWT_FINAL.field) break;
        const need = MWT_FINAL.field - pick.length - 1, cheap = rest.filter(x => x !== id && !pick.includes(x)).map(mwOf).sort((a, b) => a - b).slice(0, need).reduce((a, b) => a + b, 0);
        if (cost([...pick, id]) + cheap <= B) pick.push(id);
      }
      return { type: 'mfinal', ids: pick, gk };
    }
    if (acts[0].type === 'mstack') {
      const sl = mwtSlots(st, s), per = M.budget[s] / Math.max(1, sl.f + sl.g), avg = g => { const d = M.decks[g]; return d.length ? d.reduce((a, id) => a + mwOf(id), 0) / d.length : 0; };
      const fit = acts.filter(a => avg(a.id) <= per * 1.15).sort((x, y) => avg(y.id) - avg(x.id));
      return fit[0] || acts.slice().sort((x, y) => avg(x.id) - avg(y.id))[0];
    }
    if (acts[0].type === 'msell') return acts.slice().sort((x, y) => y.id.split(',').reduce((a, id) => a + mwOf(id), 0) - x.id.split(',').reduce((a, id) => a + mwOf(id), 0))[0];
    const sl = mwtSlots(st, s), per = M.budget[s] / Math.max(1, sl.f + sl.g);
    const gks = acts.filter(a => isGk(a.id)), fs = acts.filter(a => !isGk(a.id));
    const wantG = gks.length && (!fs.length || Math.random() < 1 / (sl.f + sl.g));
    const pool = wantG ? gks : fs;
    const under = pool.filter(a => mwOf(a.id) <= per * 1.3).sort((x, y) => mwOf(y.id) - mwOf(x.id));
    return under[0] || pool.slice().sort((x, y) => mwOf(x.id) - mwOf(y.id))[0];
  }

  // ---------- Bot ----------
  const DEF_BEATS = (da, aa, green) => {
    if (aa === 'Direktschuss') aa = 'Schuss';
    if (aa === 'Ball sichern') return false;
    if (da === 'Gelb') return true;
    if (aa === 'Steilpass') return (da === 'Passabfangen' || da === 'Ballgewinn') && !green;
    if (aa === 'Sprint' || aa === 'Kerze' || aa === 'Slapstick') return false;
    if (aa === 'Befreiungsschlag') return da === 'Passabfangen' && !green;
    if (da === 'Ballgewinn') return !green;
    if (da === 'Passabfangen') return (PASSES.includes(aa) && !green) || NOTHING(aa);
    if (da === 'Tackling') return aa === 'Dribbling' || NOTHING(aa);
    if (da === 'Block') return aa === 'Schuss' || aa === 'Kopfball';
    if (da === 'Schuss blocken') return aa === 'Schuss' || NOTHING(aa);
    return false;
  };
  // Bot-Stufen: 'leicht' (trifft 40 % seiner Spielentscheidungen zufällig) und 'normal' (bisheriger Bot).
  // Eine stärkere Stufe ist in tools/bot-training erprobt, bringt aber bisher keinen gesicherten Vorteil.
  const botLevel = (st, s) => { const l = st.opts && st.opts.botLevel; return (l && typeof l === 'object' ? l[s] : l) || 'normal'; };
  function botAct(st, s) {
    const acts = legal(st, s);
    if (!acts.length) return null;
    const ph = st.phase;
    const lvl = botLevel(st, s);
    if (lvl === 'leicht' && (ph === 'att' || ph === 'def' || ph === 'move' || ph === 'gk' || ph === 'shot') && Math.random() < 0.4) return acts[rnd(acts.length)];
    const pick = arr => arr[rnd(arr.length)];
    if (ph === 'draft') return pick(acts);
    if (ph === 'tdraft') { const v = id => isGk(id) ? 40 - byId[id].fields.reduce((x, y) => x + y, 0) * 3 : power(id); const own = st.tour.market[s]; return acts.slice().sort((x, y) => (v(y.id) - (own.includes(y.id) || isGk(y.id) ? 0 : 3)) - (v(x.id) - (own.includes(x.id) || isGk(x.id) ? 0 : 3)))[0]; }
    if (ph === 'tsteal') return acts.slice().sort((x, y) => (isGk(y.id) ? 0 : power(y.id)) - (isGk(x.id) ? 0 : power(x.id)))[0];
    if (ph === 'over') return st.mwt ? { type: 'mnext' } : { type: 'tnext' };
    if (ph === 'mmarket' || ph === 'mfinal') return mwtBot(st, s, acts);
    if (ph === 'scout') return { type: 'squad', ids: st.vflPool.slice().sort((x, y) => power(y) - power(x)).slice(0, squadOf(st)) };
    if (ph === 'setup') {
      const t = st.teams[s];
      const bench = t.squad.slice().sort((x, y) => power(x) - power(y)).slice(0, benchOf(st, s));
      return { type: 'team', name: st.mode === 'club' ? (s === 'A' ? 'VfL Osnabrück' : CLUB_NAMES[st.opp || 's04']) : 'Bot-Elf', bench };
    }
    if (ph === 'half') {
      const t = st.teams[s], g = grades(st, s);
      const outs = t.lineup.filter(id => !t.out.includes(id) && g[id] != null && g[id] >= 4).sort((x, y) => g[y] - g[x]);
      const ins = t.bench.slice().sort((x, y) => power(y) - power(x));
      const subs = [];
      for (let i = 0; i < Math.min(MAX_SUBS, outs.length, ins.length); i++) subs.push([outs[i], ins[i]]);
      return { type: 'ready', subs };
    }
    if (ph === 'att' || ph === 'def') {
      const side = st.cur[ph];
      if (acts.some(a => a.type === 'green')) return { type: 'green' };
      const row = side.id && !(ph === 'att' && st.cur.header) ? zoneRow(side.id, side.zone, ph) : null;
      if (ph === 'def' && acts.some(a => a.type === 'blue2') && row && !row.opts.some(o => DEF_BEATS(o.a, st.cur.att.action, st.cur.att.green)) && Math.random() < 0.5) return { type: 'blue2' };
      const score = a => {
        if (!row || a.type !== 'choose') return a.type === 'choose' ? 0 : -9;
        const o = row.opts[a.opt];
        let val;
        if (ph === 'def') val = DEF_BEATS(o.a, st.cur.att.action, st.cur.att.green) ? 6 : 0;
        else val = ({ 'Schuss': 5, 'Kopfball': 4, 'Vorlage': 4, 'Flanke': 3, 'Steilpass': 3, 'Sprint': 3, 'Dribbling': 3, 'Diagonalball': 3, 'Querpass': 2, 'Ball sichern': 2, 'Rückpass': 1, 'Slapstick': 1.5, 'Kerze': 1, 'Befreiungsschlag': .5, 'Fehlpass': -3, 'Ballverlust': -3 })[o.a] ?? 0;
        const cost = a.pay === 'exhaust' ? 1.5 : a.pay === 'token' ? 1 : a.pay === 'both' ? 2.5 : 0;
        return val + (o.g ? 1 : 0) - cost + Math.random();
      };
      const best = acts.filter(a => a.type === 'choose').sort((x, y) => score(y) - score(x))[0];
      // Überlaufen: nur bezahlen, wenn die Aktion den Angriff wirklich stoppt
      if (acts.some(a => a.type === 'nodef') && (!best || score(best) < 3)) return { type: 'nodef' };
      return best;
    }
    if (ph === 'def_pick2') {
      const val = id => zoneRow(id, st.cur.def.zone, 'def').opts.some(o => DEF_BEATS(o.a, st.cur.att.action, st.cur.att.green)) ? 1 : 0;
      const [a, b] = acts;
      return val(a.id) >= val(b.id) ? a : b;
    }
    if (ph === 'move') {
      const rank = { ZO: 6, LO: 5, RO: 5, ZM: 3, LD: 1, RD: 1, ZD: 0 };
      return acts.slice().sort((x, y) => rank[y.zone] - rank[x.zone] + (Math.random() - 0.5))[0];
    }
    if (ph === 'dist') {
      const boost = acts.some(a => a.boost);
      const n = st.cur.shot.points + (boost ? 1 : 0);
      // Verteilung mit der besten Torchance (Spielwert), kein Feld über 7 (ab 7 trifft der Wurf sicher);
      // bei fast gleich guten Verteilungen zufällig wählen
      const base = st.cur.shot.gkBase;
      const cand = distributions(n).map(add => ({ add, f: base.map((v, i) => v + add[i]) })).filter(c => distOk(c.f));
      cand.forEach(c => { c.v = shotGame(c.f).v; });
      const top = Math.max(...cand.map(c => c.v));
      const good = cand.filter(c => c.v >= top - 0.005);
      return { type: 'dist', add: pick(good).add, boost };
    }
    if (ph === 'gk') {
      return { type: 'gk', n: pickMix(shotGame(st.cur.shot.fields).q) };
    }
    if (ph === 'shot') {
      // Gleichgewicht als Grundlage, pro Schuss mit „Bauchgefühl“ vermischt, damit der Bot nicht ablesbar ist:
      // Anteil λ zwischen 15 und 45 %, Bauchgefühl = zufällige Gewichte auf alle Ecken mit Trefferchance
      const g = shotGame(st.cur.shot.fields);
      const lam = 0.15 + 0.3 * Math.random();
      const gut = g.p.map(p => p > 0 ? -Math.log(1 - Math.random()) : 0);
      const gs = gut.reduce((a, b) => a + b, 0) || 1;
      return { type: 'aim', n: pickMix(g.x.map((x, i) => (1 - lam) * x + lam * gut[i] / gs)) };
    }
    return pick(acts);
  }

  const api = { MWT_ROUNDS, MWT_FINAL, MWT_GROUPS, MWT_GROUP_NAME, setMarketValues, mwOf, mwtGroupOf, mwtFmt, TOUR_STATIONS, TOUR_POINTS, tierOf, isGk, lineupOf, halfOf, CLUB_NAMES, ZONES, MIRROR, LATERAL, QUER, FORWARD, BACKWARD, DIAG, ZONE_NAME, CORNERS, SQUAD, LINEUP, MAX_SUBS, MARKET, squadOf, benchOf, setData, card, other, newGame, legal, apply, actor, zoneRow, canPay, botAct, shotGame, distOk, DEF_BEATS, duelText, grades };
  if (typeof module !== 'undefined') module.exports = api; else root.FC = api;
})(typeof window !== 'undefined' ? window : globalThis);
