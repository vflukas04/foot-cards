// Foot Cards – Regel-Engine (ältere Version: Verteidiger deckt zuerst auf)
// Reiner Zustand: alle Funktionen geben neue Zustände zurück (structuredClone).
(function (root) {
  'use strict';

  const ZONES = ['LO', 'ZO', 'RO', 'ZM', 'LD', 'ZD', 'RD'];
  const MIRROR = { LO: 'RD', ZO: 'ZD', RO: 'LD', ZM: 'ZM', LD: 'RO', ZD: 'ZO', RD: 'LO' };
  const LATERAL = {
    LO: ['ZO', 'ZM'], ZO: ['LO', 'RO'], RO: ['ZO', 'ZM'],
    ZM: ['LO', 'LD', 'RO', 'RD'],
    LD: ['ZD', 'ZM'], ZD: ['LD', 'RD'], RD: ['ZD', 'ZM'],
  };
  const FORWARD = { LD: 'LO', ZD: 'ZM', ZM: 'ZO', RD: 'RO' };
  const BACKWARD = { LO: 'LD', ZO: 'ZM', ZM: 'ZD', RO: 'RD' };
  const ZONE_NAME = {
    LO: 'links offensiv', ZO: 'zentral offensiv', RO: 'rechts offensiv', ZM: 'Mittelfeld',
    LD: 'links defensiv', ZD: 'zentral defensiv', RD: 'rechts defensiv',
  };
  const PASSES = ['Querpass', 'Rückpass', 'Steilpass', 'Flanke', 'Vorlage'];
  const DRIBBLES = ['Dribbling', 'Dribbling (R)', '--'];

  // Torschuss-Tabelle (Würfel 1–6). 'X' = vorbei, 'NW:K' = Neuwurf in Spalte K.
  const SHOT_TABLE = {
    Z: ['NW:L', 'NW:L', 'NW:R', 'NW:R', 'Z', 'Z'],
    R: ['X', 'Z', 'NW:RU', 'NW:RO', 'RU', 'RO'],
    L: ['X', 'Z', 'NW:LU', 'NW:LO', 'LU', 'LO'],
    RO: ['X', 'X', 'RU', 'RO', 'RO', 'RO'],
    RU: ['X', 'X', 'RO', 'RU', 'RU', 'RU'],
    LO: ['X', 'X', 'LU', 'LO', 'LO', 'LO'],
    LU: ['X', 'X', 'LO', 'LU', 'LU', 'LU'],
  };
  const SHOT_DIRS = ['LO', 'L', 'LU', 'Z', 'RO', 'R', 'RU'];
  const SHOT_DIR_NAME = { Z: 'zentral', R: 'rechts', L: 'links', RO: 'rechts oben', RU: 'rechts unten', LO: 'links oben', LU: 'links unten' };
  const AFTER_TIE = { Z: 'ZO', RO: 'RO', RU: 'RO', LO: 'LO', LU: 'LO' };

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

  function emptyStats() { return { turns: 0, shots: 0, onTarget: 0, won: 0, lost: 0, passes: 0, yellow: 0, out: 0 }; }
  function setOut(st, k, text) { if (st.cur) st.cur.out = { k, t: text }; }
  function emptyTeam() {
    return { squad: [], gk: null, pile: [], discard: [], exhausted: [], yellow: {}, out: [], tok: { R: false, G: false, B: false } };
  }

  function newGame(opts) {
    opts = opts || {};
    const st = {
      v: 1, seq: 0, phase: 'draft', mode: opts.mode || 'random',
      names: opts.names || { A: 'Spieler A', B: 'Spieler B' },
      teams: { A: emptyTeam(), B: emptyTeam() },
      pool: [], pickOrder: [],
      poss: 'A', ball: 'ZM', minute: 0, half: 1, kickoff: 'A', goals: { A: 0, B: 0 },
      cur: null, flank: false, lastShot: null, log: [], result: null, turn: 0, prev: null, scorers: [],
      stats: { A: emptyStats(), B: emptyStats() },
    };
    const gks = shuffle(DATA.gks.map(g => g.id));
    st.teams.A.gk = gks[0];
    st.teams.B.gk = gks[1];
    st.kickoff = Math.random() < 0.5 ? 'A' : 'B';
    if (st.mode === 'draft') {
      st.pool = DATA.players.map(p => p.id);
      const order = [];
      for (let i = 0; i < 10; i++) order.push(...(i % 2 === 0 ? ['A', 'B'] : ['B', 'A']));
      st.pickOrder = order;
      log(st, `Draft beginnt. ${st.names.A} wählt zuerst.`);
    } else {
      const ids = shuffle(DATA.players.map(p => p.id));
      st.teams.A.squad = ids.slice(0, 10);
      st.teams.B.squad = ids.slice(10, 20);
      startMatch(st);
    }
    return st;
  }

  function log(st, text, kind) {
    st.log.push({ m: st.minute, t: text, k: kind || '' });
    if (st.log.length > 400) st.log.splice(0, st.log.length - 400);
  }

  function startMatch(st) {
    for (const s of ['A', 'B']) {
      const t = st.teams[s];
      t.pile = shuffle(t.squad);
      t.discard = [];
    }
    st.poss = st.kickoff;
    st.ball = 'ZM';
    st.minute = 0;
    st.half = 1;
    log(st, `Anpfiff. ${st.names[st.poss]} hat Anstoß.`, 'whistle');
    beginTurn(st);
  }

  // ---------- Kartenstapel ----------
  function draw(st, s) {
    const t = st.teams[s];
    if (t.pile.length === 0) {
      t.pile = shuffle(t.discard.filter(id => !t.out.includes(id)));
      t.discard = [];
      if (t.pile.length) log(st, `${st.names[s]}: Stapel durchgespielt, neu gemischt.`, 'info');
    }
    return t.pile.shift() || null;
  }

  function beginTurn(st) {
    st.lastShot = st.phase === 'shot_done' ? st.lastShot : st.lastShot;
    const def = other(st.poss);
    const id = draw(st, def);
    st.turn = (st.turn || 0) + 1;
    st.cur = {
      turn: st.turn, possStart: st.poss, ballStart: st.ball, minute: st.minute, out: null,
      def: { id, alt: null, opt: null, pay: null, fresh: false, zone: MIRROR[st.ball] },
      att: null,
    };
    st.phase = 'def';
  }

  function zoneRow(id, zone, role) {
    const z = card(id).z[zone];
    if (role === 'def') return { opts: z.d.map(a => ({ a, g: 0 })), tok: z.dt };
    return { opts: z.a.map(([a, g]) => ({ a, g })), tok: z.at };
  }

  // Wer muss gerade entscheiden?
  function actor(st) {
    switch (st.phase) {
      case 'draft': return st.pickOrder[0];
      case 'def': case 'def_pick2': case 'gk': return other(st.poss);
      case 'att': case 'move': case 'shot': return st.poss;
      default: return null;
    }
  }

  function canPay(st, s, role, side) {
    const t = st.teams[s];
    const cid = side.id;
    const tokenKey = role === 'def' ? 'B' : 'R';
    return {
      exhaust: !t.exhausted.includes(cid) && !side.fresh,
      token: t.tok[tokenKey] && !(role === 'def' && side.usedBlue2),
    };
  }

  function legal(st, s) {
    if (actor(st) !== s) return [];
    const acts = [];
    const ph = st.phase;
    if (ph === 'draft') {
      st.pool.forEach(id => acts.push({ type: 'pick', id }));
      return acts;
    }
    if (ph === 'def' || ph === 'att') {
      const role = ph;
      const side = st.cur[role];
      const t = st.teams[s];
      if (!side.id) { acts.push({ type: 'choose', opt: 0 }); return acts; }
      if (role === 'def' && t.tok.B && !side.usedBlue2) acts.push({ type: 'blue2' });
      if (t.exhausted.includes(side.id) && t.tok.G && !side.fresh) acts.push({ type: 'green' });
      const row = zoneRow(side.id, side.zone, role);
      acts.push({ type: 'choose', opt: 0 });
      if (row.opts.length > 1) {
        const p = canPay(st, s, role, side);
        if (p.exhaust) acts.push({ type: 'choose', opt: 1, pay: 'exhaust' });
        if (p.token) acts.push({ type: 'choose', opt: 1, pay: 'token' });
      }
      return acts;
    }
    if (ph === 'def_pick2') {
      acts.push({ type: 'keep', id: st.cur.def.id });
      acts.push({ type: 'keep', id: st.cur.def.alt });
      return acts;
    }
    if (ph === 'move') {
      st.cur.targets.forEach(z => acts.push({ type: 'move', zone: z }));
      return acts;
    }
    if (ph === 'gk') {
      [1, 2, 3, 4].forEach(n => acts.push({ type: 'gk', n }));
      return acts;
    }
    if (ph === 'shot') {
      const boost = st.teams[s].tok.R && !st.cur.att.usedRed;
      SHOT_DIRS.forEach(d => {
        acts.push({ type: 'shoot', dir: d, boost: false });
        if (boost) acts.push({ type: 'shoot', dir: d, boost: true });
      });
      return acts;
    }
    return acts;
  }

  function sameAct(a, b) {
    return a.type === b.type && a.opt === b.opt && a.pay === b.pay && a.id === b.id && a.zone === b.zone && a.n === b.n && a.dir === b.dir && !!a.boost === !!b.boost;
  }

  function apply(st0, s, act) {
    if (!legal(st0, s).some(a => sameAct(a, act))) throw new Error('Unzulässiger Zug: ' + JSON.stringify(act));
    const st = structuredClone(st0);
    st.seq++;
    switch (act.type) {
      case 'pick': {
        st.teams[s].squad.push(act.id);
        st.pool = st.pool.filter(x => x !== act.id);
        st.pickOrder.shift();
        log(st, `${st.names[s]} wählt ${card(act.id).name} (${card(act.id).pos}).`, 'info');
        if (!st.pickOrder.length) startMatch(st);
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
        side.id = act.id;
        side.alt = null;
        side.fresh = false;
        st.teams[s].pile.push(drop); // unter den Stapel
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
        if (side.id) {
          const row = zoneRow(side.id, side.zone, role);
          side.action = row.opts[act.opt].a;
          side.green = !!row.opts[act.opt].g;
          if (act.pay === 'exhaust') t.exhausted.push(side.id);
          if (act.pay === 'token') { t.tok[role === 'def' ? 'B' : 'R'] = false; if (role === 'att') side.usedRed = true; }
          const got = [];
          for (const k of row.tok) { if (!t.tok[k]) { t.tok[k] = true; got.push(k); } }
          side.gotTok = got;
          const how = act.pay === 'exhaust' ? ' (erschöpft)' : act.pay === 'token' ? ' (Token)' : '';
          log(st, `${role === 'def' ? 'Abwehr' : 'Angriff'} ${st.names[s]}: ${card(side.id).name} – ${side.action}${side.green ? ' (grün)' : ''}${how}.`, role);
        } else {
          side.action = '--'; side.green = false; side.gotTok = [];
        }
        if (role === 'def') {
          const att = st.poss;
          const id = draw(st, att);
          st.cur.att = { id, opt: null, pay: null, fresh: false, zone: st.ball };
          st.phase = 'att';
        } else {
          resolve(st);
        }
        break;
      }
      case 'move': {
        setOut(st, 'ok', `${st.cur.moveLabel} gelingt`);
        st.ball = act.zone;
        log(st, `Ball nach ${ZONE_NAME[act.zone]}.`, 'move');
        endTurn(st, false);
        break;
      }
      case 'gk': {
        st.cur.gk = act.n;
        st.phase = 'shot';
        log(st, `${st.names[s]} hat die Torwartaktion verdeckt gewählt.`, 'info');
        break;
      }
      case 'shoot': {
        shoot(st, act.dir, act.boost);
        break;
      }
    }
    return st;
  }

  function resolve(st) {
    const d = st.cur.def, a = st.cur.att;
    const defS = other(st.poss), attS = st.poss;
    let act = a.action;
    const wasFlank = st.flank;
    st.flank = false;
    if (act === 'Kopfball' && !wasFlank) {
      log(st, 'Kopfball ohne vorherige Flanke zählt als „--“.', 'info');
      act = '--';
    }
    a.eff = act;
    const da = d.action;
    // 1. Ballverlust
    if (act === 'Ballverlust') return change(st, 'Ballverlust');
    // 2. Gelbe Karte
    if (da === 'Gelbe Karte') {
      const t = st.teams[defS];
      t.yellow[d.id] = (t.yellow[d.id] || 0) + 1;
      if (t.yellow[d.id] >= 2) {
        t.out.push(d.id);
        log(st, `Gelb-Rot für ${card(d.id).name}! Er fliegt vom Platz.`, 'card');
        d.sentOff = true;
        st.stats[defS].out++;
        setOut(st, 'red', `Gelb-Rot für ${card(d.id).name}!`);
      } else {
        log(st, `Gelbe Karte für ${card(d.id).name}. Foul, ${st.names[attS]} bleibt am Ball.`, 'card');
        setOut(st, 'yellow', `Foul: Gelbe Karte für ${card(d.id).name}`);
      }
      st.stats[defS].yellow++;
      return endTurn(st, false);
    }
    // 3. Ball sichern
    if (act === 'Ball sichern') { log(st, 'Ball gesichert.', 'ok'); setOut(st, 'keep', 'Ball gesichert'); return endTurn(st, false); }
    // 4. Verteidigung
    if (da === 'Ballgewinn' && !a.green) return change(st, 'Ballgewinn');
    if (da === 'Passabfangen' && PASSES.includes(act)) return change(st, 'Pass abgefangen');
    if (da === 'Tackling' && DRIBBLES.includes(act)) return change(st, 'Tackling');
    if (da === 'Schuss blocken' && act === 'Schuss') return change(st, 'Schuss geblockt');
    if (da === 'Kopfball blocken' && act === 'Kopfball') return change(st, 'Kopfball geblockt');
    // 5. Erfolg
    const z = st.ball;
    switch (act) {
      case '--': log(st, 'Ball bleibt in der Zone.', 'ok'); setOut(st, 'keep', da === '--' ? 'Nichts passiert, Ball bleibt' : 'Ball bleibt in der Zone'); return endTurn(st, false);
      case 'Querpass': return offerMove(st, LATERAL[z], 'Querpass');
      case 'Dribbling': return offerMove(st, [z, ...(FORWARD[z] ? [FORWARD[z]] : []), ...LATERAL[z]], 'Dribbling');
      case 'Dribbling (R)': return offerMove(st, [z, ...[...(FORWARD[z] ? [FORWARD[z]] : []), ...LATERAL[z]].filter(x => x[0] === 'R')], 'Dribbling nach rechts');
      case 'Steilpass': return offerMove(st, FORWARD[z] ? [FORWARD[z]] : [z], 'Steilpass');
      case 'Rückpass': return offerMove(st, BACKWARD[z] ? [BACKWARD[z]] : [z], 'Rückpass');
      case 'Flanke': st.flank = true; st.ball = 'ZO'; st.stats[attS].passes++; log(st, 'Flanke kommt an. Ball zentral vor dem Tor.', 'ok'); setOut(st, 'ok', 'Flanke kommt an – Kopfball möglich'); return endTurn(st, false);
      case 'Vorlage': st.ball = 'ZO'; st.stats[attS].passes++; log(st, 'Vorlage. Ball zentral vor dem Tor.', 'ok'); setOut(st, 'ok', 'Vorlage in den Strafraum'); return endTurn(st, false);
      case 'Schuss': case 'Kopfball':
        st.cur.shooter = a.id;
        st.cur.shotKind = act;
        st.cur.fern = act === 'Schuss' && st.ball !== 'ZO';
        st.phase = 'gk';
        log(st, `${act}! ${card(a.id).name} kommt zum Abschluss${st.cur.fern ? ' (Fernschuss)' : ''}.`, 'shot');
        return;
    }
    log(st, `Unbekannte Aktion „${act}“, Ball bleibt.`, 'info');
    endTurn(st, false);
  }

  function offerMove(st, targets, label) {
    targets = [...new Set(targets)];
    if (label !== 'Dribbling' && label !== 'Dribbling nach rechts') st.stats[st.poss].passes++;
    if (targets.length === 1) {
      st.ball = targets[0];
      log(st, `${label} gelingt. Ball nach ${ZONE_NAME[st.ball]}.`, 'ok');
      setOut(st, 'ok', `${label} gelingt`);
      return endTurn(st, false);
    }
    st.cur.targets = targets;
    st.cur.moveLabel = label;
    st.phase = 'move';
    log(st, `${label} gelingt.`, 'ok');
  }

  function change(st, why) {
    const from = st.poss;
    if (why === 'Ballverlust') { st.stats[from].lost++; setOut(st, 'change', 'Ballverlust!'); }
    else { st.stats[other(from)].won++; setOut(st, 'change', why + '!'); }
    st.poss = other(from);
    st.ball = MIRROR[st.ball];
    st.flank = false;
    log(st, `${why}: Ballbesitz wechselt zu ${st.names[st.poss]}.`, 'change');
    endTurn(st, true);
  }

  function rollShot(dir) {
    const rolls = [];
    let col = dir, res;
    for (let guard = 0; guard < 10; guard++) {
      const r = rnd(6) + 1;
      res = SHOT_TABLE[col][r - 1];
      rolls.push({ col, r, res });
      if (res.startsWith('NW:')) { col = res.slice(3); continue; }
      break;
    }
    return { rolls, res };
  }

  function shoot(st, dir, boost) {
    const attS = st.poss, defS = other(attS);
    const sh = card(st.cur.shooter);
    const gk = card(st.teams[defS].gk);
    const gopt = gk.opts[st.cur.gk - 1];
    if (boost) { st.teams[attS].tok.R = false; }
    const roll = rollShot(dir);
    const shot = { dir, boost, rolls: roll.rolls, res: roll.res, gkN: st.cur.gk, shooter: sh.id, gk: gk.id, kind: st.cur.shotKind, fern: st.cur.fern };
    st.lastShot = shot;
    log(st, `${sh.name} zielt ${SHOT_DIR_NAME[dir]}${boost ? ' (+1 roter Token)' : ''}. Würfel: ${roll.rolls.map(r => r.r + (r.res.startsWith('NW') ? ' → Neuwurf ' + SHOT_DIR_NAME[r.res.slice(3)] : '')).join(', ')}.`, 'shot');
    st.cur.att.usedRed = st.cur.att.usedRed || boost;
    st.cur.shotDone = true;
    st.stats[attS].shots++;
    if (roll.res !== 'X') st.stats[attS].onTarget++;
    if (roll.res === 'X') {
      shot.outcome = 'vorbei';
      log(st, 'Vorbei! Abstoß.', 'change');
      setOut(st, 'miss', 'Vorbei!');
      st.poss = defS; st.ball = 'ZD'; st.flank = false;
      return endTurn(st, true);
    }
    const area = roll.res;
    const sv = (sh.shot[area] || 0) + (boost ? 1 : 0);
    const gv = (gopt[area] || 0) + (shot.fern ? gopt.fern : 0);
    shot.area = area; shot.sv = sv; shot.gv = gv;
    log(st, `Torbereich ${SHOT_DIR_NAME[area]}: Schütze ${sv} gegen Torwart ${gv} (Aktion ${st.cur.gk}${shot.fern && gopt.fern ? ', +' + gopt.fern + ' Fernschuss' : ''}).`, 'shot');
    if (sv > gv) {
      shot.outcome = 'tor';
      st.goals[attS]++;
      st.scorers.push({ id: sh.id, s: attS, m: st.minute + 1 });
      setOut(st, 'goal', 'TOR!');
      log(st, `TOR für ${st.names[attS]}! ${st.goals.A}:${st.goals.B}`, 'goal');
      st.poss = defS; st.ball = 'ZM'; st.flank = false;
      return endTurn(st, true);
    }
    if (sv < gv) {
      shot.outcome = 'parade';
      log(st, `Parade von ${gk.name}! Abstoß.`, 'change');
      setOut(st, 'save', `Parade von ${gk.name}!`);
      st.poss = defS; st.ball = 'ZD'; st.flank = false;
      return endTurn(st, true);
    }
    shot.outcome = 'gleich';
    setOut(st, 'keep', 'Gleichstand – Angreifer bleibt am Ball');
    st.ball = AFTER_TIE[area];
    log(st, `Gleichstand. ${st.names[attS]} bleibt am Ball (${ZONE_NAME[st.ball]}).`, 'ok');
    endTurn(st, false);
  }

  function snapSide(x) {
    if (!x) return null;
    return { id: x.id, action: x.action, eff: x.eff, green: x.green, pay: x.pay, gotTok: x.gotTok || [], zone: x.zone, sentOff: !!x.sentOff, usedBlue2: !!x.usedBlue2, fresh: !!x.fresh };
  }
  function endTurn(st, changed) {
    const c = st.cur;
    if (c) {
      st.stats[c.possStart].turns++;
      st.prev = {
        turn: c.turn, minute: c.minute, possStart: c.possStart, ballStart: c.ballStart, possEnd: st.poss, ballEnd: st.ball,
        def: snapSide(c.def), att: snapSide(c.att), out: c.out || { k: 'keep', t: 'Ball bleibt' },
        shot: c.shotDone ? st.lastShot : null, whistle: null, flank: st.flank,
      };
    }
    // Karten ablegen
    for (const role of ['def', 'att']) {
      const side = st.cur && st.cur[role];
      if (!side || !side.id) continue;
      const s = role === 'def' ? (changed ? st.poss : other(st.poss)) : (changed ? other(st.poss) : st.poss);
      if (side.sentOff) continue;
      st.teams[s].discard.push(side.id);
    }
    st.minute++;
    const total = st.goals.A + st.goals.B;
    if (st.half === 1 && ((st.minute >= 45 && changed) || st.minute >= 50)) {
      log(st, `Halbzeitpfiff (${st.minute}. Minute). ${st.goals.A}:${st.goals.B}`, 'whistle');
      if (st.prev) st.prev.whistle = 'Halbzeit';
      st.half = 2;
      st.minute = 45;
      st.poss = other(st.kickoff);
      st.ball = 'ZM';
      st.flank = false;
      log(st, `Anpfiff zweite Halbzeit. ${st.names[st.poss]} hat Anstoß.`, 'whistle');
    } else if (st.half === 2 && st.minute >= 90 + total && changed) {
      st.phase = 'over';
      st.cur = null;
      const r = st.goals.A === st.goals.B ? 'Unentschieden' : `Sieg ${st.names[st.goals.A > st.goals.B ? 'A' : 'B']}`;
      st.result = r;
      if (st.prev) st.prev.whistle = 'Abpfiff';
      log(st, `Abpfiff (${st.minute}. Minute). Endstand ${st.goals.A}:${st.goals.B}. ${r}.`, 'whistle');
      return;
    }
    beginTurn(st);
  }

  // ---------- einfacher Bot ----------
  function botAct(st, s) {
    const acts = legal(st, s);
    if (!acts.length) return null;
    const ph = st.phase;
    const pick = arr => arr[rnd(arr.length)];
    if (ph === 'draft') {
      return pick(acts);
    }
    if (ph === 'def' || ph === 'att') {
      const side = st.cur[ph];
      if (acts.some(a => a.type === 'green')) return { type: 'green' };
      if (ph === 'def' && acts.some(a => a.type === 'blue2') && Math.random() < 0.3) return { type: 'blue2' };
      const row = side.id ? zoneRow(side.id, side.zone, ph) : null;
      const score = a => {
        if (!row || a.type !== 'choose') return -1;
        const o = row.opts[a.opt];
        const val = ph === 'def'
          ? ({ 'Ballgewinn': 5, 'Passabfangen': 3, 'Tackling': 3, 'Schuss blocken': 3, 'Kopfball blocken': 2, '--': 0, 'Gelbe Karte': 1 })[o.a] ?? 1
          : ({ 'Schuss': 5, 'Kopfball': 4, 'Vorlage': 4, 'Flanke': 3, 'Steilpass': 3, 'Dribbling': 3, 'Dribbling (R)': 3, 'Querpass': 2, 'Ball sichern': 2, 'Rückpass': 1, '--': 0, 'Ballverlust': -3 })[o.a] ?? 1;
        const cost = a.pay === 'exhaust' ? 1.5 : a.pay === 'token' ? 1 : 0;
        return val + (o.g ? 1 : 0) - cost + Math.random();
      };
      return acts.filter(a => a.type === 'choose').sort((x, y) => score(y) - score(x))[0];
    }
    if (ph === 'def_pick2') {
      const z = st.cur.def.zone;
      const val = id => { const d = card(id).z[z].d; return Math.max(...d.map(a => ({ 'Ballgewinn': 5, 'Passabfangen': 3, 'Tackling': 3 })[a] || 0)); };
      const [a, b] = acts;
      return val(a.id) >= val(b.id) ? a : b;
    }
    if (ph === 'move') {
      const rank = { ZO: 6, LO: 5, RO: 5, ZM: 3, LD: 1, RD: 1, ZD: 0 };
      return acts.sort((x, y) => rank[y.zone] - rank[x.zone] + (Math.random() - 0.5))[0];
    }
    if (ph === 'gk') return pick(acts);
    if (ph === 'shot') {
      const sh = card(st.cur.shooter).shot;
      const best = Object.entries(sh).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0][0];
      const boost = acts.some(a => a.boost);
      return Math.random() < 0.6 ? { type: 'shoot', dir: best, boost } : pick(acts);
    }
    return pick(acts);
  }

  const api = { ZONES, MIRROR, LATERAL, FORWARD, BACKWARD, ZONE_NAME, SHOT_TABLE, SHOT_DIRS, SHOT_DIR_NAME, setData, card, other, newGame, legal, apply, actor, zoneRow, canPay, botAct };
  if (typeof module !== 'undefined') module.exports = api; else root.FC = api;
})(typeof window !== 'undefined' ? window : globalThis);
