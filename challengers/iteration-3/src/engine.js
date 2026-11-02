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
  }
  const card = id => byId[id];
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
  const squadOf = st => st.squadSize || SQUAD;
  const benchOf = st => Math.max(0, squadOf(st) - LINEUP);
  function setOut(st, k, text, extra) { if (st.cur) st.cur.out = Object.assign({ k, t: text }, st.cur.duel && st.cur.duel.kind !== 'Präsenz' ? { duel: st.cur.duel } : {}, extra || {}); }

  function newGame(opts) {
    opts = opts || {};
    const st = {
      v: 2, seq: 0, phase: 'draft', mode: opts.mode || 'random', squadSize: SQUAD, poolSize: 0, deck: [],
      names: opts.names || { A: 'Heim', B: 'Gast' },
      teams: { A: emptyTeam(), B: emptyTeam() },
      pool: [], pickOrder: [],
      poss: 'A', ball: 'ZM', minute: 0, half: 1, kickoff: 'A', goals: { A: 0, B: 0 },
      cur: null, flank: false, lastShot: null, log: [], result: null, turn: 0, prev: null, scorers: [],
      holder: null, stats: { A: emptyStats(), B: emptyStats() }, track: [], ps: {}, ready: { A: false, B: false }, halfStats: null,
    };
    const gks = shuffle(DATA.gks.map(g => g.id));
    st.teams.A.gk = gks[0];
    st.teams.B.gk = gks[1];
    st.kickoff = Math.random() < 0.5 ? 'A' : 'B';
    // Kartenpool: alle Karten oder eine zufällige Auswahl (gerade Anzahl, mindestens 2 × LINEUP)
    const all = shuffle(DATA.players.map(p => p.id));
    const want = Math.max(2 * LINEUP, Math.min(all.length, opts.pool || all.length));
    const pool = all.slice(0, want - (want % 2));
    st.poolSize = pool.length; st.squadSize = pool.length / 2;
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
      st.teams.B.squad = pool.slice(st.squadSize);
      startSetup(st);
    }
    return st;
  }
  function log(st, text, kind) {
    st.log.push({ m: st.minute, t: text, k: kind || '' });
    if (st.log.length > 400) st.log.splice(0, st.log.length - 400);
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
    // Beim Direktschuss nach Vorlage deckt die Abwehr keine Karte auf.
    if (!st.cur.volley) {
      const defS = other(att);
      const did = draw(st, defS);
      st.cur.def = { id: did, alt: null, opt: null, pay: null, fresh: false, zone: MIRROR[st.ball], open: !!st.cur.presence };
    }
    // Präsenz-Duell: die Abwehrkarte liegt offen, bevor der Angreifer wählt
    if (st.cur.presence) {
      st.presence = false;
      const defS = other(att);
      const did = st.cur.def.id;
      if (!id || !did) { st.cur.presence = false; return; }
      const r = duel(id, did, 'praesenz', 'tempo');
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
      case 'setup': case 'half': return !st.ready.A ? 'A' : !st.ready.B ? 'B' : null;
      case 'def': case 'def_pick2': case 'gk': return other(st.poss);
      case 'att': case 'move': case 'dist': case 'shot': return st.poss;
      default: return null;
    }
  }
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
    if (actor(st) !== s) return [];
    const acts = [];
    const ph = st.phase;
    if (ph === 'draft') { st.pool.forEach(id => acts.push({ type: 'pick', id })); return acts; }
    if (ph === 'att' || ph === 'def') {
      const side = st.cur[ph];
      const t = st.teams[s];
      if (!side.id) { acts.push({ type: 'choose', opt: 0 }); return acts; }
      if (st.cur.header || st.cur.through || st.cur.volley) { acts.push({ type: 'choose', opt: 0 }); return acts; }
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
      return Array.isArray(b) && b.length === benchOf(st) && new Set(b).size === b.length && b.every(id => t.squad.includes(id)) && typeof (act.name || '') === 'string';
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
    const free = act && (act.type === 'team' || act.type === 'ready');
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
      case 'team': {
        const t = st.teams[s];
        t.name = String(act.name || '').trim().slice(0, 24) || (s === 'A' ? 'Heim' : 'Gast');
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
        else if (st.cur.volley) {
          side.action = 'Direktschuss'; side.green = false;
          log(st, `Angriff ${st.names[s]}: ${card(side.id).name} schießt direkt nach der Vorlage (Schusswert ${card(side.id).schuss}).`, role);
        }
        else if (st.cur.through) {
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
          if (act.pay === 'exhaust') t.exhausted.push(side.id);
          if (act.pay === 'token') { t.tok[role === 'def' ? 'B' : 'R'] = false; if (role === 'att') side.usedRed = true; }
          if (side.action === '-- und erschöpft' && !t.exhausted.includes(side.id)) t.exhausted.push(side.id);
          if (side.action === '-- und Regeneriert') t.exhausted = t.exhausted.filter(x => x !== side.id);
          for (const k of row.opts[act.opt].tok) { if (!t.tok[k]) { t.tok[k] = true; side.gotTok.push(k); } }   // nur die Token der gewählten Aktion
          const how = act.pay === 'exhaust' ? ' (erschöpft)' : act.pay === 'token' ? ' (Token)' : '';
          log(st, `${role === 'def' ? 'Abwehr' : 'Angriff'} ${st.names[s]}: ${card(side.id).name} – ${side.action}${side.green ? ' (grün)' : ''}${how}.`, role);
        }
        if (role === 'att' && st.cur.volley) {
          st.flank = false; st.through = null; st.presence = false; st.volley = false;
          if (!side.id) { setOut(st, 'keep', 'Keine Karte – kein Schuss'); endTurn(st, false); break; }
          startShot(st, 'Schuss');
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
  function duel(attId, defId, first, second) {
    const A = card(attId), D = defId ? card(defId) : null;
    const key = { tempo: 'Tempo', praesenz: 'Präsenz', kopf: 'Kopfball' };
    const av = A[first], dv = D ? D[first] : 0;
    const res = { kind: key[first], a: av, d: dv };
    if (av !== dv) { res.win = av > dv ? 'att' : 'def'; return res; }
    const av2 = A[second], dv2 = D ? D[second] : 0;
    res.kind2 = key[second]; res.a2 = av2; res.d2 = dv2;
    res.win = av2 === dv2 ? 'tie' : av2 > dv2 ? 'att' : 'def';
    return res;
  }
  function duelText(r) {
    let t = `${r.kind} ${r.a}:${r.d}`;
    if (r.kind2) t += `, dann ${r.kind2} ${r.a2}:${r.d2}`;
    return t;
  }

  function resolve(st) {
    const d = st.cur.def, a = st.cur.att;
    const defS = other(st.poss), attS = st.poss;
    st.flank = false; st.through = null; st.presence = false; st.volley = false;
    // Tempo-Duell nach Steilpass: die nächsten beiden Karten laufen, ihre Aktionen entfallen
    if (st.cur.through) {
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
    // 3. Ball sichern
    if (act === 'Ball sichern') { log(st, 'Ball gesichert.', 'ok'); setOut(st, 'keep', 'Ball gesichert'); return endTurn(st, false); }
    const z = st.ball;
    // 4. Steilpass und Sprint: Tempo-Duell
    if (act === 'Steilpass') {
      if (da === 'Passabfangen' && !a.green) return change(st, 'Pass abgefangen');
      st.flank = false; st.through = { to: FORWARD[z] || z };
      log(st, 'Steilpass gespielt. Im nächsten Zug entscheidet das Tempo der nächsten beiden Karten.', 'ok');
      setOut(st, 'ok', 'Steilpass gespielt – jetzt zählt das Tempo der nächsten Karten');
      return endTurn(st, false);
    }
    if (act === 'Sprint') {
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
    if (da === 'Kopfball blocken' && act === 'Kopfball') return change(st, 'Kopfball geblockt');
    // 7. Erfolg
    switch (act) {
      case '--': log(st, 'Ball bleibt in der Zone.', 'ok'); setOut(st, 'keep', 'Ball bleibt in der Zone'); return endTurn(st, false);
      case 'Querpass': return offerMove(st, QUER[z], 'Querpass');
      case 'Dribbling': return offerMove(st, [z, ...(FORWARD[z] ? [FORWARD[z]] : []), ...LATERAL[z]], 'Dribbling');
      case 'Rückpass': return offerMove(st, BACKWARD[z] ? [BACKWARD[z]] : [z], 'Rückpass');
      case 'Diagonalball': return offerMove(st, DIAG[z] || [z], 'Diagonalball');
      case 'Flanke': st.flank = true; st.ball = 'ZO'; st.stats[attS].passes++; log(st, 'Flanke kommt an. Nächster Zug: Kopfball.', 'ok'); setOut(st, 'ok', 'Flanke kommt an – nächster Zug ist ein Kopfball'); return endTurn(st, false);
      case 'Vorlage': st.ball = 'ZO'; st.volley = true; st.stats[attS].passes++; log(st, 'Vorlage. Im nächsten Zug folgt der Direktschuss.', 'ok'); setOut(st, 'ok', 'Vorlage – jetzt folgt der Direktschuss'); return endTurn(st, false);
      case 'Schuss': case 'Kopfball': return startShot(st, act);
    }
    log(st, `Unbekannte Aktion „${act}“, Ball bleibt.`, 'info');
    setOut(st, 'keep', 'Ball bleibt');
    endTurn(st, false);
  }

  function startShot(st, kind) {
    const a = st.cur.att, attS = st.poss, defS = other(attS);
    const sh = card(a.id);
    const base = kind === 'Kopfball' ? sh.kopf : sh.schuss;
    const h = st.holder;
    const assistId = h && h.s === attS && h.id !== a.id ? h.id : null;
    const assist = assistId ? card(assistId).assist : 0;
    const fern = kind === 'Schuss' && st.ball !== 'ZO';
    const points = Math.max(0, base + assist - (fern ? 1 : 0));
    const gk = card(st.teams[defS].gk);
    st.cur.shot = { shooter: a.id, kind, base, assist, assistId, fern, points, gkBase: gk.fields.slice(), gk: gk.id, add: [0, 0, 0] };
    st.stats[attS].shots++;
    log(st, `${kind}! ${sh.name} kommt zum Abschluss: ${kind === 'Kopfball' ? 'Kopfball' : 'Schuss'}wert ${base}${assist ? ` + Assist ${assist} (${card(assistId).name})` : ''}${fern ? ' − 1 Fernschuss' : ''} = ${points} Punkte.`, 'shot');
    st.phase = 'dist';
  }

  function shoot(st, aim) {
    const attS = st.poss, defS = other(attS);
    const sh = st.cur.shot;
    sh.aim = aim;
    const shooter = card(sh.shooter), gk = card(sh.gk);
    st.cur.shotDone = true;
    log(st, `Schuss nach ${CORNERS[aim]}, Torwart springt nach ${CORNERS[sh.gkN]}.`, 'shot');
    if (aim === sh.gkN) {
      sh.outcome = 'parade';
      st.stats[attS].onTarget++;
      log(st, `Richtige Ecke: Parade von ${gk.name}! Abstoß.`, 'change');
      setOut(st, 'save', `${gk.name} ist in der richtigen Ecke!`);
      st.lastShot = sh; st.poss = defS; st.ball = 'ZD'; st.flank = false; st.through = null; st.presence = false; st.volley = false; st.holder = null;
      return endTurn(st, true);
    }
    sh.xg = 2 / 3 * Math.max(0, Math.min(1, (sh.fields[aim] - 1) / 6));
    st.stats[attS].xg = (st.stats[attS].xg || 0) + sh.xg;
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
      st.poss = defS; st.ball = 'ZM'; st.flank = false; st.through = null; st.presence = false; st.volley = false; st.holder = null;
      return endTurn(st, true);
    }
    sh.outcome = 'vorbei';
    log(st, `Würfel ${roll}, gebraucht unter ${need}: daneben. Abstoß.`, 'change');
    setOut(st, 'miss', 'Daneben!');
    st.poss = defS; st.ball = 'ZD'; st.flank = false; st.through = null; st.presence = false; st.volley = false; st.holder = null;
    endTurn(st, true);
  }

  function offerMove(st, targets, label) {
    targets = [...new Set(targets)];
    if (!['Dribbling', 'Sprint'].includes(label)) st.stats[st.poss].passes++;
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
    st.flank = false; st.through = null; st.presence = false; st.volley = false;
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
    if (dId && !c.volley) psOf(st, dId).n++;
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
    if (st.half === 1 && ((st.minute >= 45 && turnover) || st.minute >= 50)) {
      log(st, `Halbzeitpfiff (${st.minute}. Minute). ${st.goals.A}:${st.goals.B}`, 'whistle');
      if (st.prev) st.prev.whistle = 'Halbzeit';
      st.half = 2; st.minute = 45; st.poss = other(st.kickoff); st.ball = 'ZM'; st.flank = false; st.through = null; st.presence = false; st.volley = false; st.holder = null;
      // Halbzeitpause: Statistik festhalten, beide können wechseln und melden sich dann bereit
      st.phase = 'half'; st.cur = null; st.ready = { A: false, B: false };
      st.halfStats = structuredClone(st.stats); st.halfPs = structuredClone(st.ps);
      return;
    } else if (st.half === 2 && st.minute >= 90 + total && turnover) {
      st.phase = 'over'; st.cur = null;
      const r = st.goals.A === st.goals.B ? 'Unentschieden' : `Sieg ${st.names[st.goals.A > st.goals.B ? 'A' : 'B']}`;
      st.result = r;
      if (st.prev) st.prev.whistle = 'Abpfiff';
      log(st, `Abpfiff (${st.minute}. Minute). Endstand ${st.goals.A}:${st.goals.B}. ${r}.`, 'whistle');
      return;
    }
    beginTurn(st);
  }

  // ---------- Bot ----------
  const DEF_BEATS = (da, aa, green) => {
    if (aa === 'Ball sichern') return false;
    if (da === 'Gelb') return true;
    if (aa === 'Steilpass') return da === 'Passabfangen' && !green;
    if (aa === 'Sprint') return false;
    if (da === 'Ballgewinn') return !green;
    if (da === 'Passabfangen') return (PASSES.includes(aa) && !green) || NOTHING(aa);
    if (da === 'Tackling') return aa === 'Dribbling' || NOTHING(aa);
    if (da === 'Block') return aa === 'Schuss' || aa === 'Kopfball';
    if (da === 'Schuss blocken') return aa === 'Schuss' || NOTHING(aa);
    if (da === 'Kopfball blocken') return aa === 'Kopfball';
    return false;
  };
  function botAct(st, s) {
    const acts = legal(st, s);
    if (!acts.length) return null;
    const ph = st.phase;
    const pick = arr => arr[rnd(arr.length)];
    if (ph === 'draft') return pick(acts);
    const power = id => { const c = card(id); return c.tempo + c.praesenz + c.assist + c.kopf + c.schuss; };
    if (ph === 'setup') {
      const t = st.teams[s];
      const bench = t.squad.slice().sort((x, y) => power(x) - power(y)).slice(0, benchOf(st));
      return { type: 'team', name: 'Bot-Elf', bench };
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
        else val = ({ 'Schuss': 5, 'Kopfball': 4, 'Vorlage': 4, 'Flanke': 3, 'Steilpass': 3, 'Sprint': 3, 'Dribbling': 3, 'Diagonalball': 3, 'Querpass': 2, 'Ball sichern': 2, 'Rückpass': 1, 'Fehlpass': -3, 'Ballverlust': -3 })[o.a] ?? 0;
        const cost = a.pay === 'exhaust' ? 1.5 : a.pay === 'token' ? 1 : 0;
        return val + (o.g ? 1 : 0) - cost + Math.random();
      };
      return acts.filter(a => a.type === 'choose').sort((x, y) => score(y) - score(x))[0];
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
      const t = rnd(3), add = [0, 0, 0];
      // Hälfte auf ein Feld, Rest auf ein zweites
      const t2 = (t + 1 + rnd(2)) % 3;
      add[t] = Math.ceil(n / 2); add[t2] += n - add[t];
      return { type: 'dist', add, boost };
    }
    if (ph === 'gk') {
      const f = st.cur.shot.fields;
      const best = f.indexOf(Math.max(...f));
      return Math.random() < 0.55 ? { type: 'gk', n: best } : pick(acts);
    }
    if (ph === 'shot') {
      const f = st.cur.shot.fields;
      const w = f.map(v => Math.max(0.2, Math.min(5, v - 1)));
      let r = Math.random() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < 3; i++) { r -= w[i]; if (r <= 0) return { type: 'aim', n: i }; }
      return { type: 'aim', n: 2 };
    }
    return pick(acts);
  }

  const api = { ZONES, MIRROR, LATERAL, QUER, FORWARD, BACKWARD, DIAG, ZONE_NAME, CORNERS, SQUAD, LINEUP, MAX_SUBS, MARKET, squadOf, benchOf, setData, card, other, newGame, legal, apply, actor, zoneRow, canPay, botAct, DEF_BEATS, duelText, grades };
  if (typeof module !== 'undefined') module.exports = api; else root.FC = api;
})(typeof window !== 'undefined' ? window : globalThis);
