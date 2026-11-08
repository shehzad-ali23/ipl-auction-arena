(() => {
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = l => l >= 100 ? `₹${(l / 100).toFixed(2)} Cr` : `₹${l} L`;
const ROLE = { BAT: 'Batter', BOWL: 'Bowler', AR: 'All-Rounder', WK: 'Wicket-Keeper' };
const keyOf = c => 'iaa_token_' + c;

let S = null, ME = null, TEAMS = [], POOL = {}, offset = 0, tab = 'auction', code = null, socket = null, busy = false, lastBid = -1;
const TM = id => TEAMS.find(t => t.id === id);
const logo = (t, sz = '') => t ? `<span class="logo ${sz}" style="--c1:${t.c1};--c2:${t.c2}">${esc(t.short)}</span>` : '';
const btn = (a, label, cls = '', v = '') => `<button class="${cls}" data-a="${a}" data-v="${esc(v)}">${label}</button>`;

function toast(msg, bad) {
  const d = document.createElement('div'); d.className = 'toast' + (bad ? ' bad' : ''); d.textContent = msg;
  $('#toasts').append(d); setTimeout(() => d.remove(), 3400);
}
function act(ev, data, cb) {
  if (!socket || !socket.connected) return toast('Not connected', true);
  socket.emit(ev, data || {}, res => { if (res && res.error) toast(res.error, true); if (cb) cb(res); });
}

// ---------- connection ----------
function connect(c) {
  code = c.toUpperCase();
  if (socket) { doJoin(); return; }
  socket = io({ transports: ['websocket', 'polling'] });
  socket.on('connect', () => { if (code) doJoin(); });
  socket.on('disconnect', () => { $('#conn').hidden = false; render(); });
  socket.on('state', s => { S = s; offset = s.now - Date.now(); render(); });
  socket.on('pool', p => { POOL = {}; p.forEach(x => { POOL[x.id] = x; }); });
  socket.on('toast', m => toast(m));
  socket.on('kicked', () => { toast('You were removed from the room', true); leaveLocal(); });
}
function doJoin() {
  socket.emit('join', { code, name: localStorage.getItem('iaa_name') || '', token: localStorage.getItem(keyOf(code)) || '' }, res => {
    if (res.error) { toast(res.error, true); if (/not found/i.test(res.error)) localStorage.removeItem(keyOf(code)); S = null; render(); return; }
    $('#conn').hidden = true; ME = res.memberId; TEAMS = res.teams;
    localStorage.setItem(keyOf(code), res.token);
    if (location.pathname !== '/room/' + code) history.replaceState(null, '', '/room/' + code);
  });
}
function leaveLocal() {
  if (code) localStorage.removeItem(keyOf(code));
  code = null; S = null; ME = null; history.replaceState(null, '', '/'); render();
}

// ---------- views ----------
function home() {
  const nm = esc(localStorage.getItem('iaa_name') || '');
  const pre = location.pathname.startsWith('/room/') ? esc((location.pathname.split('/')[2] || '').toUpperCase()) : '';
  const teams = TEAMS.map(t => `<div class="glass tcard">${logo(t, 'lg')}<strong>${esc(t.name)}</strong></div>`).join('');
  return `
  <section class="hero">
    <div><h1>The <em>mega auction</em><br>in your friends' hands.</h1>
      <p>Create a private room, invite up to 9 friends, pick an IPL franchise each and bid live on real cricketers with a ₹100 Cr purse. Every bid is validated on the server.</p></div>
    <div class="glass pad">
      <label>Your name</label><input id="name" maxlength="20" placeholder="e.g. Rahul" value="${nm}" autocomplete="nickname">
      <div style="height:12px"></div>${btn('create', 'Create Private Room')}
      <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
      <label>Room code</label><input id="jcode" maxlength="6" placeholder="ABC123" value="${pre}" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:.2em;font-weight:800">
      <div style="height:12px"></div>${btn('join', 'Join Existing Room', 'ghost')}
    </div>
  </section>
  <section class="sec" id="how"><h2>How to play</h2><div class="cards">
    <div class="glass"><h3>1 · Create or join</h3><p>The host creates a room and shares the code or invite link. Friends join from any phone.</p></div>
    <div class="glass"><h3>2 · Pick a franchise</h3><p>One player per team. Taken teams are locked for everyone else.</p></div>
    <div class="glass"><h3>3 · Bid live</h3><p>Tap bid buttons before the 7-second timer ends. Every bid resets it.</p></div>
    <div class="glass"><h3>4 · Build your squad</h3><p>Manage your purse, fill your squad of up to 15 and compare in the results.</p></div></div></section>
  <section class="sec"><h2>Features</h2><div class="cards">
    <div class="glass"><h3>Server-authoritative</h3><p>Timer, purse and ownership are decided only by the server. No double sales, no overspending.</p></div>
    <div class="glass"><h3>Reconnect-safe</h3><p>Your identity and host role survive refreshes and dropped connections.</p></div>
    <div class="glass"><h3>Host controls</h3><p>Pause, resume, skip, mark unsold, restart, end, and configure rules.</p></div>
    <div class="glass"><h3>CSV export</h3><p>Download the complete auction summary when it ends.</p></div></div></section>
  <section class="sec" id="teams"><h2>Available franchises</h2><div class="teamgrid">${teams}</div></section>
  <section class="sec" id="rules"><h2>Auction rules</h2><div class="glass pad"><ul style="padding-left:18px;display:grid;gap:6px;color:var(--mute)">
    <li>Starting purse ₹100 Cr per team (host can change it)</li><li>Max squad size 15</li><li>7-second timer, reset on every valid bid</li>
    <li>First bid is at base price; later bids add the chosen increment</li><li>You cannot bid above your purse or with a full squad</li>
    <li>Unsold players can be brought back in one unsold round</li></ul></div></section>
  <footer>IPL Auction Arena · fan-made game, not affiliated with the BCCI or the IPL.</footer>`;
}

function lobby() {
  const isHost = S.hostId === ME, me = S.members.find(m => m.id === ME), c = S.config;
  const link = `${location.origin}/room/${S.code}`;
  const tc = S.teams.map(t => {
    const T = TM(t.id), mine = t.ownerId === ME;
    return `<button class="tcard ${t.ownerId ? 'taken' : ''} ${mine ? 'mine' : ''}" data-a="team" data-v="${t.id}">${logo(T, 'lg')}<strong>${esc(T.name)}</strong>
      <span class="own">${t.owner ? esc(t.owner) : 'Available'}</span><span class="badge ${t.ownerId ? 'ready' : 'open'}">${mine ? '✓ YOUR TEAM' : t.ownerId ? 'READY' : 'OPEN'}</span></button>`;
  }).join('');
  const mem = S.members.map(m => `<div class="mem"><span class="dot ${m.connected ? 'on' : ''}"></span><span class="nm">${esc(m.name)}${m.id === ME ? ' (you)' : ''}</span>
    ${m.teamId ? logo(TM(m.teamId), 'sm') : '<small>no team</small>'}${m.id === S.hostId ? '<span class="host">HOST</span>' : ''}
    ${isHost && m.id !== ME ? `<button class="ghost sm" data-a="transfer" data-v="${m.id}">Make host</button><button class="ghost sm" data-a="kick" data-v="${m.id}">✕</button>` : ''}</div>`).join('');
  const cfg = isHost ? `
    <div class="grid2"><div><label>Purse (₹ Cr)</label><input id="c-purse" type="number" min="5" max="1000" value="${c.purse / 100}"></div>
    <div><label>Max squad</label><input id="c-squad" type="number" min="3" max="30" value="${c.squad}"></div>
    <div><label>Timer (sec)</label><input id="c-timer" type="number" min="3" max="60" value="${c.timer}"></div>
    <div><label>Bid steps (lakh, comma)</label><input id="c-steps" value="${c.steps.join(',')}"></div></div>
    <label style="display:flex;gap:8px;align-items:center"><input id="c-auto" type="checkbox" style="width:auto;min-height:0" ${c.auto ? 'checked' : ''}> Auto-advance to next player</label>
    <div style="height:10px"></div>${btn('savecfg', 'Save rules')}
    <details><summary>Add a custom player</summary>
      <label>Name</label><input id="p-name" maxlength="40"><div class="grid2"><div><label>Nationality</label><input id="p-nat" maxlength="30" value="India"></div>
      <div><label>Age</label><input id="p-age" type="number" value="25"></div>
      <div><label>Role</label><select id="p-role"><option value="BAT">Batter</option><option value="BOWL">Bowler</option><option value="AR">All-Rounder</option><option value="WK">Wicket-Keeper</option></select></div>
      <div><label>Base (lakh)</label><input id="p-base" type="number" value="100"></div>
      <div><label>Batting style</label><input id="p-bat" value="Right-hand bat"></div><div><label>Bowling style</label><input id="p-bowl" value="Does not bowl"></div></div>
      <label>Photo URL (https, optional)</label><input id="p-photo"><div style="height:10px"></div>${btn('addp', 'Add player', 'ghost')}</details>`
    : `<ul style="padding-left:18px;color:var(--mute);display:grid;gap:4px"><li>Purse ${fmt(c.purse)}</li><li>Squad max ${c.squad}</li><li>Timer ${c.timer}s</li><li>Bid steps ${c.steps.map(fmt).join(', ')}</li></ul>`;
  const picked = S.teams.filter(t => t.ownerId).length;
  return `<div class="wrap">
    <div class="glass roomhead"><div><small>ROOM CODE</small><div class="code">${esc(S.code)}</div></div>
      <div class="row">${btn('copyCode', 'Copy code', 'ghost')}${btn('copyLink', 'Copy invite link', 'ghost')}</div></div>
    <h2>Choose your franchise <small>(${picked}/10 taken)</small></h2><div class="teamgrid">${tc}</div>
    <div class="two"><div class="glass pad"><h3 style="margin-bottom:6px">Players (${S.members.length}/10)</h3>${mem}</div>
      <div class="glass pad"><h3 style="margin-bottom:6px">${isHost ? 'Auction rules' : 'Rules set by host'}</h3>${cfg}</div></div>
    ${isHost ? `<button data-a="start" ${picked < 2 ? 'disabled' : ''} style="min-height:56px;font-size:1.1rem">▶ Start Auction${picked < 2 ? ' (need 2+ teams)' : ''}</button>`
      : `<div class="glass pad center"><small>Waiting for the host to start…${me && me.teamId ? '' : ' Pick a franchise to play!'}</small></div>`}
    </div>`;
}

function avatar(p) {
  const ini = p.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return `<span class="initials">${esc(ini)}</span>${p.photo ? `<img src="${esc(p.photo)}" alt="${esc(p.name)}" referrerpolicy="no-referrer" loading="lazy" onerror="this.remove()">` : ''}`;
}
function teamCard(t) {
  const T = TM(t.id), cnt = { BAT: 0, BOWL: 0, AR: 0, WK: 0 };
  t.squad.forEach(s => { const p = POOL[s.pid]; if (p) cnt[p.role]++; });
  const pct = Math.max(0, Math.min(100, t.purse / S.config.purse * 100));
  const hot = S.cur && S.cur.bidTeam === t.id && S.cur.status === 'bidding';
  return `<div class="glass tm ${hot ? 'hot' : ''}"><div class="hd">${logo(T)}<div class="grow"><b>${esc(T.name)}</b><small>${esc(t.owner || '')}</small></div>
    <div style="text-align:right"><b class="gold">${fmt(t.purse)}</b><small>${t.squad.length}/${S.config.squad}</small></div></div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="cnt"><span>🏏 ${cnt.BAT} BAT</span><span>🎯 ${cnt.BOWL} BWL</span><span>⚡ ${cnt.AR} AR</span><span>🧤 ${cnt.WK} WK</span>${hot ? `<span style="color:var(--gold)">Bid ${fmt(S.cur.bid)}</span>` : ''}</div>
    <details><summary>Squad (${t.squad.length})</summary><div class="sq">${t.squad.map(s => `<div><span>${esc(POOL[s.pid]?.name || s.pid)}</span><b>${fmt(s.price)}</b></div>`).join('') || '<small>No players yet</small>'}</div></details></div>`;
}

function live() {
  const c = S.cur, isHost = S.hostId === ME, me = S.members.find(m => m.id === ME), myT = me && me.teamId, mine = myT && S.teams.find(t => t.id === myT);
  const strip = mine ? `<div class="glass strip">${logo(TM(myT))}<div class="grow"><small>YOUR TEAM</small><br><b>${esc(TM(myT).name)}</b></div><div style="text-align:right"><b class="gold">${fmt(mine.purse)}</b><br><small>${mine.squad.length}/${S.config.squad} players</small></div></div>`
    : `<div class="glass strip"><div class="grow"><b>Spectating</b><br><small>You have no franchise in this auction</small></div></div>`;
  let main = '';
  if (!c) {
    main = `<div class="glass pad center"><h2>Round ${S.round} complete</h2><p style="margin:8px 0;color:var(--mute)">${S.sold.length} sold · ${S.unsold.length} unsold</p>
      ${isHost ? `<div class="row" style="justify-content:center">${S.round === 1 && S.unsold.length ? btn('uround', 'Start unsold round') : ''}${btn('end', 'Finish auction', 'ghost')}</div>` : '<small>Waiting for host…</small>'}</div>`;
  } else {
    const p = POOL[c.pid]; if (!p) return '';
    const hb = c.bidTeam && TM(c.bidTeam);
    const ov = c.status === 'sold' ? `<div class="ov sold"><small>SOLD TO</small>${logo(hb, 'xl')}<h2>${esc(hb.name)}</h2><b>${fmt(c.bid)}</b></div>`
      : c.status === 'unsold' ? `<div class="ov unsold"><h2>UNSOLD</h2><small>No bids received</small></div>`
      : c.status === 'paused' ? `<div class="ov paused"><h2>⏸ PAUSED</h2></div>` : '';
    let why = '';
    if (!myT) why = 'Select a franchise to bid'; else if (!socket.connected) why = 'Reconnecting…';
    else if (c.status === 'paused') why = 'Auction paused'; else if (c.status !== 'bidding') why = 'Bidding closed';
    else if (mine.squad.length >= S.config.squad) why = 'Your squad is full'; else if (c.bidTeam === myT) why = 'You are the highest bidder';
    const next = c.bid === 0 ? p.base : c.bid + Math.min(...S.config.steps);
    if (!why && mine && next > mine.purse) why = 'Not enough purse to bid';
    const dis = a => (why || (mine && a > mine.purse)) ? 'disabled' : '';
    const btns = c.bid === 0
      ? `<button class="bid big" data-a="bid" data-v="${S.config.steps[0]}" data-at="0" ${dis(p.base)}>Bid base ${fmt(p.base)}</button>`
      : S.config.steps.map(s => `<button class="bid" data-a="bid" data-v="${s}" data-at="${c.bid}" ${dis(c.bid + s)}><small>+${fmt(s)}</small><b>${fmt(c.bid + s)}</b></button>`).join('');
    const hist = c.history.length ? c.history.map(h => `<div>${logo(TM(h.teamId), 'sm')}<span style="margin:0">${esc(TM(h.teamId).short)}</span><span>${fmt(h.amount)}</span></div>`).join('') : '<small>No bids yet</small>';
    const pop = c.bid !== lastBid; lastBid = c.bid;
    main = `<div class="glass pcard"><div class="photo">${avatar(p)}<span class="cat">${ROLE[p.role]}</span>
        <div class="timer" id="tmr"><span id="tm">–</span></div>${ov}</div>
      <div class="pinfo"><small>${S.round === 2 ? 'UNSOLD ROUND · ' : ''}${S.remaining} MORE TO COME</small><h2>${esc(p.name)}</h2>
        <div class="facts"><div><small>Nationality</small>${esc(p.nat)}</div><div><small>Age</small>${p.age}</div>
        <div><small>Batting</small>${esc(p.bat)}</div><div><small>Bowling</small>${esc(p.bowl)}</div>
        <div><small>Category</small>${ROLE[p.role]}</div><div><small>Base price</small>${fmt(p.base)}</div></div>
        <div class="tbar"><i id="tbar"></i></div></div></div>
      <div class="glass bidbox"><div class="hi">${hb ? logo(hb, 'lg') : '<span class="logo lg" style="--c1:#333;--c2:#111">–</span>'}
        <div><small>CURRENT HIGHEST BID</small><div class="amt ${pop ? 'pop' : ''}">${c.bid ? fmt(c.bid) : 'No bids'}</div><b>${hb ? esc(hb.name.toUpperCase()) : 'BASE ' + fmt(p.base)}</b></div></div>
        <div class="bids">${btns}</div>${why ? `<div class="why">${why}</div>` : ''}<div class="hist">${hist}</div></div>`;
  }
  const hb = isHost ? `<div class="glass hostbar"><small>HOST CONTROLS</small><div class="row">
    ${c && c.status === 'bidding' ? btn('pause', '⏸ Pause', 'ghost sm') : ''}${c && c.status === 'paused' ? btn('resume', '▶ Resume', 'sm') : ''}
    ${c && (c.status === 'sold' || c.status === 'unsold') ? btn('next', 'Next player ›', 'sm') : ''}
    ${c && (c.status === 'bidding' || c.status === 'paused') ? btn('skip', 'Skip', 'ghost sm') + btn('unsold', 'Mark unsold', 'ghost sm') : ''}
    ${btn('restart', 'Restart', 'danger sm')}${btn('end', 'End', 'danger sm')}</div></div>` : '';
  const teams = S.teams.filter(t => t.ownerId).map(teamCard).join('');
  const P = id => POOL[id]?.name || id;
  const log = S.sold.slice().reverse().map(x => `<div class="glass logrow">${logo(TM(x.teamId), 'sm')}<div class="grow"><b>${esc(P(x.pid))}</b><small>${esc(TM(x.teamId).name)}</small></div><b class="gold">${fmt(x.price)}</b></div>`).join('')
    + S.unsold.map(id => `<div class="glass logrow"><div class="grow"><b>${esc(P(id))}</b><small>UNSOLD</small></div></div>`).join('');
  return `<div class="live" data-tab="${tab}"><section class="p-auction">${strip}${main}${hb}</section>
    <section class="p-teams"><h3>Teams</h3>${teams}</section><section class="p-log"><h3>Auction history</h3>${log || '<small>Nothing sold yet</small>'}</section></div>`;
}

function results() {
  const P = id => POOL[id] || { name: id, role: 'BAT' };
  const top = S.sold.reduce((a, b) => (!a || b.price > a.price ? b : a), null);
  const isHost = S.hostId === ME;
  const rows = S.teams.filter(t => t.ownerId).map(t => {
    const spent = S.config.purse - t.purse, best = t.squad.reduce((a, b) => (!a || b.price > a.price ? b : a), null);
    return { t, spent, best };
  }).sort((a, b) => b.spent - a.spent);
  return `<div class="wrap"><h1>Auction results</h1>
    <div class="stats"><div class="glass"><small>Highest-priced player</small><b>${top ? esc(P(top.pid).name) : '–'}</b>${top ? `${fmt(top.price)} · ${esc(TM(top.teamId).short)}` : ''}</div>
      <div class="glass"><small>Players sold</small><b>${S.sold.length}</b></div><div class="glass"><small>Unsold</small><b>${S.unsold.length}</b></div></div>
    <div class="glass pad scroll"><table class="tbl"><tr><th>Team</th><th>Owner</th><th>Players</th><th>Spent</th><th>Left</th><th>Priciest buy</th></tr>
      ${rows.map(({ t, spent, best }) => `<tr><td>${esc(TM(t.id).short)}</td><td>${esc(t.owner)}</td><td>${t.squad.length}</td><td>${fmt(spent)}</td><td>${fmt(t.purse)}</td><td>${best ? esc(P(best.pid).name) + ' (' + fmt(best.price) + ')' : '–'}</td></tr>`).join('')}</table></div>
    <h2>Final squads</h2><div class="cards">${rows.map(({ t }) => teamCard(t)).join('')}</div>
    <h2>Unsold players</h2><div class="glass pad">${S.unsold.map(id => esc(P(id).name)).join(', ') || '<small>None</small>'}</div>
    <h2>Auction history</h2><div class="glass pad scroll"><table class="tbl"><tr><th>#</th><th>Player</th><th>Team</th><th>Price</th></tr>
      ${S.sold.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(P(x.pid).name)}</td><td>${esc(TM(x.teamId).short)}</td><td>${fmt(x.price)}</td></tr>`).join('')}</table></div>
    <div class="row">${btn('csv', '⬇ Download CSV')}${isHost ? btn('restart', 'New auction (same room)', 'ghost') : ''}${btn('leave', 'Leave room', 'ghost')}</div></div>`;
}

// ---------- render ----------
let pending = false;
function render() {
  const app = $('#app');
  document.body.dataset.view = S && ME ? S.phase : 'home';
  $('#roomtag').hidden = $('#leaveBtn').hidden = !(S && ME);
  if (S) $('#roomtag').textContent = S.code;
  document.querySelectorAll('.bnav button').forEach(b => { b.style.color = b.dataset.v === tab ? 'var(--gold)' : ''; });
  if (!S || !ME) { app.innerHTML = home(); return; }
  const a = document.activeElement;
  if (S.phase === 'lobby' && a && /INPUT|SELECT|TEXTAREA/.test(a.tagName) && app.contains(a)) { pending = true; return; }
  pending = false;
  app.innerHTML = S.phase === 'lobby' ? lobby() : S.phase === 'live' ? live() : results();
}
document.addEventListener('focusout', () => { if (pending) setTimeout(() => { if (pending) render(); }, 150); });

function tick() {
  const el = $('#tm');
  if (el && S && S.cur) {
    const c = S.cur; let left = 0;
    if (c.status === 'bidding') left = (c.endsAt - (Date.now() + offset)) / 1000; else if (c.status === 'paused') left = c.remaining / 1000;
    const t = $('#tmr');
    el.textContent = c.status === 'sold' ? 'SOLD' : c.status === 'unsold' ? 'END' : c.status === 'paused' ? '⏸' : Math.max(0, Math.ceil(left));
    t.classList.toggle('warn', c.status === 'bidding' && left <= 3 && left > 0);
    t.classList.toggle('txt', c.status === 'sold' || c.status === 'unsold');
    $('#tbar').style.width = Math.max(0, Math.min(100, left / S.config.timer * 100)) + '%';
  }
  requestAnimationFrame(tick);
}

// ---------- actions ----------
const val = id => (document.getElementById(id) || {}).value || '';
const H = {
  async create() {
    const name = val('name').trim(); if (!name) return toast('Enter your name first', true);
    localStorage.setItem('iaa_name', name);
    const r = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const d = await r.json(); if (!r.ok) return toast(d.error || 'Could not create room', true);
    localStorage.setItem(keyOf(d.code), d.token); connect(d.code);
  },
  join() {
    const name = val('name').trim(), c = val('jcode').trim().toUpperCase();
    if (!name) return toast('Enter your name first', true); if (c.length < 4) return toast('Enter the room code', true);
    localStorage.setItem('iaa_name', name); connect(c);
  },
  team(v) { const t = S.teams.find(x => x.id === v); act('team:select', { teamId: t && t.ownerId === ME ? null : v }); },
  copyCode() { copy(S.code, 'Room code copied'); },
  copyLink() { copy(`${location.origin}/room/${S.code}`, 'Invite link copied'); },
  savecfg() { act('config:update', { purse: +val('c-purse') * 100, squad: +val('c-squad'), timer: +val('c-timer'), steps: val('c-steps').split(',').map(Number), auto: $('#c-auto').checked }, r => r.ok && toast('Rules saved')); },
  addp() { act('player:add', { name: val('p-name'), nat: val('p-nat'), age: +val('p-age'), role: val('p-role'), base: +val('p-base'), bat: val('p-bat'), bowl: val('p-bowl'), photo: val('p-photo').trim() }); },
  transfer(v) { if (confirm('Transfer host to this player?')) act('host:transfer', { memberId: v }); },
  kick(v) { if (confirm('Remove this player from the room?')) act('member:kick', { memberId: v }); },
  start() { act('auction:start'); }, pause() { act('auction:pause'); }, resume() { act('auction:resume'); },
  skip() { act('auction:skip'); }, unsold() { act('auction:unsold'); }, next() { act('auction:next'); }, uround() { act('auction:unsoldRound'); },
  restart() { if (confirm('Reset the auction and return to the lobby? All results will be cleared.')) act('auction:restart'); },
  end() { if (confirm('End the auction now?')) act('auction:end'); },
  bid(v, b) { if (busy) return; busy = true; setTimeout(() => { busy = false; }, 350); act('bid', { atBid: +b.dataset.at, step: +v }); },
  tab(v) { tab = v; render(); window.scrollTo(0, 0); },
  leave() { if (!S) return; if (!confirm('Leave this room?')) return; act('leave', {}, () => leaveLocal()); },
  async csv() {
    const r = await fetch(`/api/rooms/${S.code}/export.csv?t=${encodeURIComponent(localStorage.getItem(keyOf(S.code)) || '')}`);
    if (!r.ok) return toast('Could not export', true);
    const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = `ipl-auction-${S.code}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
};
function copy(text, msg) {
  const done = () => toast(msg);
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => toast(text));
  else { const i = document.createElement('input'); i.value = text; document.body.append(i); i.select(); try { document.execCommand('copy'); done(); } catch { toast(text); } i.remove(); }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a],[data-top]'); if (!b || b.disabled) return;
  const a = b.dataset.a || b.dataset.top;
  if (H[a]) H[a](b.dataset.v, b);
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'jcode') H.join(); });

// ---------- boot ----------
fetch('/api/teams').then(r => r.json()).then(t => { TEAMS = t; render(); }).catch(() => {});
const m = location.pathname.match(/^\/room\/([A-Za-z0-9]{4,8})$/);
render(); tick();
if (m) { code = m[1].toUpperCase(); if (localStorage.getItem(keyOf(code))) connect(code); }
})();
