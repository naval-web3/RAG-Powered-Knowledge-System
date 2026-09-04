/* ============================================================
   RETRIEVA PRODUCT TOUR — scripted workspace for the landing page
   ------------------------------------------------------------
   No backend. Every answer and match score below is canned.
   Exposes RetrievaTour.mount(rootEl); call it whenever the landing
   markup is (re)inserted into the page. Plain browser JS, no
   dependencies. The three marks (idle / thinking / replying) are
   CSS background images on .tour-mark — see the CSS block.
   ============================================================ */
const RetrievaTour = (function () {
  'use strict';

  /* ---------- Corpus ---------- */
  var DOCS = [
    { id: 'hr',  name: 'HR Policy Manual 2025.pdf',              chunks: 49, icon: 'i-file' },
    { id: 'msa', name: 'Vendor MSA \u2013 Kestrel Logistics.pdf', chunks: 62, icon: 'i-file' },
    { id: 'sec', name: 'IT Security Policy v3.docx',             chunks: 27, icon: 'i-file-text' },
    { id: 'onb', name: 'Onboarding Handbook.docx',               chunks: 31, icon: 'i-file-text' }
  ];
  var DOC = {};
  DOCS.forEach(function (d) { DOC[d.id] = d; });

  var MODELS = [
    { id: 'gemma',   chip: 'Gemma 4B',   tele: 'gemma3',   name: 'Gemma',   note: 'Handles long documents well',       local: true },
    { id: 'granite', chip: 'Granite 3B', tele: 'granite3', name: 'Granite', note: 'Sticks closest to your documents', local: true },
    { id: 'llama',   chip: 'Llama 3B',   tele: 'llama3.2', name: 'Llama',   note: 'Reliable all-rounder',              local: true },
    { id: 'gpt4o',   chip: 'GPT-4o',     tele: 'gpt-4o',   name: 'GPT-4o',  note: 'For your toughest questions',       local: false }
  ];

  /* ---------- Answers (a = sentences, without their full stops) ---------- */
  var A = {
    notice: {
      title: 'Notice period on resignation',
      q: "What's the notice period if I resign, and can it be bought out?",
      time: 1.9,
      a: [
        'Employees at grade L3 and above serve a 60-day notice period; below L3 it is 30 days',
        "Notice can be bought out with your manager's approval, and the unserved days are deducted from the final settlement at basic pay",
        'Earned leave cannot be set against the notice period, so leave taken during notice extends it by the same number of days'
      ],
      keys: 'notice period resign buy-out separation leave'
    },
    kestrel: {
      title: 'Kestrel MSA payment terms',
      q: 'What are the payment terms in the Kestrel contract, and is there a late fee?',
      time: 2.4,
      a: [
        'Invoices are due 45 days from the date you receive them, not from the invoice date',
        'Late payments accrue interest at 1.5% a month, capped at 10% of the invoice value',
        "Kestrel can only suspend service after giving 15 days' written notice to cure the non-payment"
      ],
      keys: 'payment invoice late fee interest suspension contract MSA'
    },
    encrypt: {
      title: 'Encryption on personal laptops',
      q: 'Do personal laptops need full-disk encryption to get company email?',
      time: 1.7,
      a: [
        'Yes: any device that accesses company email must have full-disk encryption on and a screen lock of five minutes or less',
        'Personal devices also need the device-management profile installed before mail is provisioned',
        'Exceptions need a written waiver from the CISO and expire after 90 days'
      ],
      keys: 'encryption laptop device personal BYOD email waiver CISO'
    },
    casual: {
      title: 'Casual leave entitlement',
      q: 'How many days of casual leave do I get a year?',
      time: 1.8,
      a: [
        'You get 12 days of casual leave a calendar year, credited on 1 January and pro-rated if you joined mid-year',
        'No more than three days can be taken together without prior approval',
        'Unused days lapse on 31 December; only earned leave carries forward'
      ],
      keys: 'casual leave days holiday entitlement carry forward'
    },
    subcontract: {
      title: 'Subcontracting under the MSA',
      q: 'Can Kestrel subcontract the work?',
      time: 2.0,
      a: [
        'Only with your prior written consent, which cannot be unreasonably withheld',
        'Kestrel stays fully liable for anything a subcontractor does or fails to do'
      ],
      keys: 'subcontract subcontractor carriers consent liable'
    },
    passwords: {
      title: 'Password rotation policy',
      q: 'How often do passwords have to be changed?',
      time: 1.6,
      a: [
        "They don't expire on a schedule any more; a change is only required after a suspected compromise",
        'The minimum length is 14 characters, and MFA is mandatory for every cloud application'
      ],
      keys: 'password rotation expiry change MFA length'
    },
    subjects: {
      title: 'What the documents cover',
      q: 'What subjects do my documents cover?',
      time: 2.2,
      a: [
        'Three areas. People policies come from the HR Policy Manual and the Onboarding Handbook: leave, notice periods, conduct and how the first week works',
        'The Kestrel Logistics MSA covers fees, payment terms, service levels and liability',
        'The IT Security Policy sets the standards for devices, passwords, MFA and exceptions'
      ],
      keys: 'subjects cover topics documents knowledge base summary summarise'
    }
  };
  var NOT_FOUND = {
    title: null, time: 0.8,
    a: ["I couldn't find anything about that in your documents. Try wording it differently, or upload a document that covers it"]
  };
  var SUGGEST = ['casual', 'subcontract', 'passwords', 'subjects'];
  var SUGGEST_ICON = { casual: 'i-book', subcontract: 'i-file', passwords: 'i-zap', subjects: 'i-info' };
  var SUGGEST_SHORT = { casual: 'Casual leave days?', subcontract: 'Can Kestrel subcontract?', passwords: 'Password rules?', subjects: 'What do my documents cover?' };
  var STOP = ' a an and are as at be by can do does for from get have how i if in is it its my of on or the that this to what when which who with your '.split(' ');
  var PLACEHOLDERS = ['Ask your knowledge base', 'What do my documents say?', 'Summarise the Kestrel contract', 'Which policy covers travel?'];
  var THINKING = ['Consulting', 'Retrieving passages', 'Piecing it together'];

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var uid = 0;

  function icon(id, cls) { return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' aria-hidden="true"><use href="#' + id + '"></use></svg>'; }
  function mark(state) { return '<span class="tour-mark' + (state ? ' is-' + state : '') + '" aria-hidden="true"></span>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function stem(w) { return w.length > 3 ? w.replace(/(ings?|ion|ed|es|s)$/, '').replace(/e$/, '') : w; }
  function words(s) { return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(function (w) { return w && STOP.indexOf(w) < 0; }).map(stem); }
  function titleFrom(q) {
    var t = q.replace(/[?.!]+$/, '').split(/\s+/).slice(0, 6).join(' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function makeTurn(answer, question, model) {
    return { q: question, model: model, time: answer.time, a: answer.a, done: false };
  }

  /* ---------- One tour instance ---------- */
  function Tour(el) {
    var self = this;
    this.el = el;
    this.$ = function (sel) { return el.querySelector(sel); };
    this.main = this.$('.tour-main');
    this.docs = this.$('[data-docs]');
    this.chatsEl = this.$('[data-chats]');
    this.tabs = this.$('[data-tabs]');
    this.titleEl = this.$('[data-title]');
    this.titleChev = this.$('[data-title-chev]');
    this.privLayer = this.$('[data-private-layer]');
    var refs = function (scope) {
      return { pane: scope, thread: scope.querySelector('[data-thread]'), input: scope.querySelector('[data-input]'),
               composer: scope.querySelector('[data-composer]'), tryEl: scope.querySelector('[data-try]') };
    };
    this.workRefs = refs(this.main);
    this.privRefs = refs(this.$('[data-private-panel]'));
    this.priv = null;               // the private chat while its layer is open (never saved)
    this.visible = false;

    this.model = MODELS[3];
    this.scope = null;              // null = all documents, else a doc id
    this.chats = [];
    this.active = null;             // chat id, null = new chat
    this.run = 0;                   // streaming token; bump to cancel
    this.timers = [];
    this.interacted = false;
    this.played = false;

    ['notice', 'kestrel', 'encrypt'].forEach(function (k) {
      var chat = { id: 'c' + (++uid), title: A[k].title, turns: [makeTurn(A[k], A[k].q, k === 'encrypt' ? MODELS[2] : MODELS[3])] };
      chat.turns[0].done = true;
      self.chats.push(chat);
    });

    this.use(this.workRefs);
    this.renderDocs();
    this.renderChats();
    this.open(this.chats[0].id);
    this.bind();
    this.observe();
  }

  /* Point the thread / composer helpers at either the workspace or the private layer */
  Tour.prototype.use = function (r) {
    this.pane = r.pane; this.thread = r.thread; this.input = r.input; this.composer = r.composer; this.tryEl = r.tryEl;
    this.renderPops();
    this.renderTry();
    if (this.visible) this.typewriter(true);
  };

  Tour.prototype.later = function (fn, ms) {
    var run = this.run, self = this;
    this.timers.push(setTimeout(function () { if (run === self.run) fn(); }, reduced ? 0 : ms));
  };
  Tour.prototype.cancel = function () {
    this.run++;
    this.timers.forEach(clearTimeout); this.timers = [];
  };

  /* ---------- Sidebar ---------- */
  Tour.prototype.renderDocs = function () {
    var self = this;
    this.docs.innerHTML = DOCS.map(function (d) {
      return '<button class="tour-item' + (self.scope === d.id ? ' is-scoped' : '') + '" type="button" data-doc="' + d.id + '" title="Limit retrieval to ' + esc(d.name) + '">' +
        icon(d.icon) + '<span>' + esc(d.name) + '</span></button>';
    }).join('');
  };
  Tour.prototype.renderChats = function () {
    var self = this;
    this.chatsEl.innerHTML = this.chats.map(function (c) {
      var on = c.id === self.active;
      return '<button class="tour-item' + (on ? ' is-active' : '') + (c.fresh ? ' is-new' : '') + '" type="button" data-chat="' + c.id + '" aria-current="' + (on ? 'true' : 'false') + '">' +
        icon('i-chat') + '<span>' + esc(c.title) + '</span>' + icon('i-more', 'more') + '</button>';
    }).join('');
    this.tabs.innerHTML = '<button type="button" data-new class="' + (this.active ? '' : 'is-active') + '">+ New</button>' + this.chats.map(function (c) {
      return '<button type="button" data-chat="' + c.id + '" class="' + (c.id === self.active ? 'is-active' : '') + '">' + esc(c.title) + '</button>';
    }).join('');
    this.chats.forEach(function (c) { c.fresh = false; });
  };
  Tour.prototype.renderTry = function () {
    var self = this, pool = SUGGEST.filter(function (k) { return !self.asked || self.asked.indexOf(k) < 0; });
    if (pool.length < 2) { this.asked = []; pool = SUGGEST.slice(); }
    this.tryEl.innerHTML = '<span>Try asking</span>' + pool.slice(0, 3).map(function (k) {
      return '<button type="button" data-ask="' + k + '" title="' + esc(A[k].q) + '">' + esc(SUGGEST_SHORT[k]) + '</button>';
    }).join('');
  };
  Tour.prototype.renderPops = function () {
    var self = this;
    var scope = this.composer.querySelector('[data-pop="scope"]');
    scope.innerHTML = '<h5>Retrieval scope</h5>' +
      '<button type="button" data-pick-scope="" class="' + (this.scope ? '' : 'is-on') + '"><span><b>All documents</b><small>search the whole corpus</small></span>' + icon('i-check', 'chk') + '</button>' +
      DOCS.map(function (d) {
        return '<button type="button" data-pick-scope="' + d.id + '" class="' + (self.scope === d.id ? 'is-on' : '') + '"><span><b>' + esc(d.name) + '</b><small class="mono">' + d.chunks + ' chunks</small></span>' + icon('i-check', 'chk') + '</button>';
      }).join('');
    var model = this.composer.querySelector('[data-pop="model"]');
    model.innerHTML = '<h5>On this machine</h5>' + MODELS.filter(function (m) { return m.local; }).map(row).join('') +
      '<h5>Cloud</h5>' + MODELS.filter(function (m) { return !m.local; }).map(row).join('') +
      '<hr><button type="button" data-pick-model="' + self.model.id + '"><span><b>More models</b></span>' + icon('i-chev-d', 'chk') + '</button>';
    function row(m) {
      return '<button type="button" data-pick-model="' + m.id + '" class="' + (self.model.id === m.id ? 'is-on' : '') + '"><span><b>' + m.name + '</b><small>' + m.note + '</small></span>' + icon('i-check', 'chk') + '</button>';
    }
    this.composer.querySelector('[data-scope-label]').textContent = this.scope ? DOC[this.scope].name : 'All documents';
    this.composer.querySelector('[data-model-label]').textContent = this.model.chip;
  };
  Tour.prototype.togglePop = function (which, force) {
    var self = this;
    ['scope', 'model'].forEach(function (w) {
      var pop = self.composer.querySelector('[data-pop="' + w + '"]'), btn = self.composer.querySelector('[data-' + w + ']');
      var show = w === which ? (force !== undefined ? force : pop.hidden) : false;
      pop.hidden = !show;
      btn.setAttribute('aria-expanded', String(show));
    });
  };

  /* ---------- Opening chats ---------- */
  Tour.prototype.open = function (id) {
    this.cancel();
    this.active = id;
    var chat = this.chat(id);
    this.thread.innerHTML = '';
    this.pane.classList.toggle('is-empty', !chat);
    if (!chat) {
      this.titleEl.textContent = 'New chat'; this.titleChev.style.display = 'none';
      this.empty('What\u2019s on your mind?');
    } else {
      this.thread.className = 'tour-thread';
      this.titleEl.textContent = chat.title; this.titleChev.style.display = '';
      for (var i = 0; i < chat.turns.length; i++) this.thread.appendChild(this.turnEl(chat.turns[i], i, false));
      this.thread.scrollTop = this.thread.scrollHeight;
    }
    this.renderChats();
  };
  Tour.prototype.empty = function (heading) {
    this.pane.classList.add('is-empty');
    this.thread.className = 'tour-empty';
    this.thread.innerHTML = mark() + '<h4>' + esc(heading) + '</h4><div class="tour-cards">' +
      SUGGEST.map(function (k) { return '<button type="button" data-ask="' + k + '">' + icon(SUGGEST_ICON[k]) + esc(A[k].q) + '</button>'; }).join('') + '</div>';
  };
  /* Private chat: a layer over the workspace with its own thread and composer.
     Whatever is asked here is answered but never saved to the sidebar. */
  Tour.prototype.openPrivate = function () {
    if (this.priv) return;
    this.cancel(); this.togglePop(null);
    this.priv = { id: 'private', title: 'Private chat', turns: [] };
    this.use(this.privRefs);
    this.thread.innerHTML = '';
    this.empty('You\u2019re private');
    this.privLayer.classList.add('is-open');
    var input = this.input;
    setTimeout(function () { input.focus({ preventScroll: true }); }, 250);
  };
  Tour.prototype.closePrivate = function () {
    if (!this.priv) return;
    this.cancel(); this.togglePop(null);
    this.priv = null;
    this.privLayer.classList.remove('is-open');
    this.input.value = ''; this.composer.classList.remove('has-text');
    this.use(this.workRefs);
    this.open(this.active);
  };
  Tour.prototype.chat = function (id) {
    for (var i = 0; i < this.chats.length; i++) if (this.chats[i].id === id) return this.chats[i];
    return null;
  };

  /* One user turn + assistant answer. When streaming is false, render it finished. */
  Tour.prototype.turnEl = function (turn, index, streaming) {
    var wrap = document.createElement('div');
    wrap.className = 'tour-turn'; wrap.dataset.turn = index;
    wrap.innerHTML = '<div class="tour-q">' + esc(turn.q) + '</div>' +
      '<div class="tour-tele" data-tele></div>' +
      '<div class="tour-answer" data-answer></div>' +
      '<div class="tour-foot" data-foot>' + mark() +
        '<div class="tour-actions"><button class="tour-ib" type="button" aria-label="Copy answer" title="Copy" data-act="copy">' + icon('i-copy') + '</button>' +
        '<button class="tour-ib" type="button" aria-label="Good answer" title="Good answer" data-act="up">' + icon('i-thumb-up') + '</button>' +
        '<button class="tour-ib" type="button" aria-label="Needs work" title="Needs work" data-act="down">' + icon('i-thumb-down') + '</button></div></div>';
    if (!streaming) {
      wrap.querySelector('[data-tele]').innerHTML = this.teleHTML(turn);
      wrap.querySelector('[data-answer]').innerHTML = this.answerHTML(turn);
    } else wrap.querySelector('[data-foot]').hidden = true;
    return wrap;
  };
  Tour.prototype.teleHTML = function (turn, seconds) {
    var s = Math.max(1, Math.round(seconds !== undefined ? seconds : turn.time));
    return '<span>Thought for ' + s + 's</span>';
  };
  Tour.prototype.answerHTML = function (turn) {
    return turn.a.map(function (t) { return esc(t) + '.'; }).join(' ');
  };

  /* ---------- Asking ---------- */
  Tour.prototype.ask = function (question, key) {
    var self = this;
    this.cancel();
    this.togglePop(null);
    var answer = key ? A[key] : this.match(question);
    if (key) this.asked = (this.asked || []).concat(key);
    var turn = makeTurn(answer || NOT_FOUND, question, this.model);
    var chat = this.priv || this.chat(this.active), index;
    if (!chat) {
      chat = { id: 'c' + (++uid), title: 'New chat', turns: [], fresh: true };
      this.chats.unshift(chat);
      this.active = chat.id;
      this.titleEl.textContent = 'New chat'; this.titleChev.style.display = '';
    }
    if (!chat.turns.length) {
      this.pane.classList.remove('is-empty');
      this.thread.className = 'tour-thread'; this.thread.innerHTML = '';
    }
    chat.turns.push(turn);
    index = chat.turns.length - 1;
    if (!this.priv) this.renderChats();
    if (key) this.renderTry();

    var wrap = this.turnEl(turn, index, true);
    this.thread.appendChild(wrap);
    this.scrollThread();
    this.play(chat, turn, wrap, function () {
      if (!self.priv && chat.title === 'New chat') {
        chat.title = answer && answer.title ? answer.title : titleFrom(question);
        self.titleEl.textContent = chat.title;
        self.renderChats();
      }
    });
  };
  /* Thinking (breathe mark) -> telemetry -> the answer written word by word (chase mark) */
  Tour.prototype.play = function (chat, turn, wrap, done) {
    var self = this;
    var tele = wrap.querySelector('[data-tele]'), ans = wrap.querySelector('[data-answer]'), foot = wrap.querySelector('[data-foot]');
    var footMark = foot.querySelector('.tour-mark');
    ans.innerHTML = ''; foot.hidden = true; footMark.className = 'tour-mark';
    var think = function (label) { tele.innerHTML = '<span class="tour-think">' + mark('think') + esc(label) + '</span>'; };
    var total = Math.max(1200, turn.time * 1000), started = Date.now();   // the canned time is how long it "thinks"
    think(THINKING[0]);
    this.later(function () { think(THINKING[1]); }, total * 0.33);
    this.later(function () { think(THINKING[2]); }, total * 0.66);
    this.later(function () {
      tele.innerHTML = self.teleHTML(turn, (Date.now() - started) / 1000);
      foot.hidden = false; footMark.className = 'tour-mark is-reply'; foot.classList.add('is-busy');
      self.stream(turn, ans, function () {
        footMark.className = 'tour-mark'; foot.classList.remove('is-busy');
        turn.done = true;
        self.scrollThread();
        if (done) done();
      });
    }, 2100);
  };
  /* Nearest canned answer: words shared with the question/title/keys count double,
     words shared with the answer body count once. */
  Tour.prototype.match = function (question) {
    var q = words(question), best = null, score = 0;
    Object.keys(A).forEach(function (k) {
      var head = words(A[k].q + ' ' + A[k].title + ' ' + A[k].keys), body = words(A[k].a.join(' ')), pts = 0;
      q.forEach(function (w) { if (head.indexOf(w) >= 0) pts += 2; else if (body.indexOf(w) >= 0) pts += 1; });
      if (pts > score) { score = pts; best = A[k]; }
    });
    return score >= 2 ? best : null;
  };
  Tour.prototype.stream = function (turn, ans, done) {
    var self = this;
    if (reduced) { ans.innerHTML = this.answerHTML(turn); done(); return; }
    var caret = document.createElement('span'); caret.className = 'caret';
    ans.appendChild(caret);
    var si = 0;
    (function nextSentence() {
      if (si >= turn.a.length) { caret.remove(); done(); return; }
      var tokens = turn.a[si].split(' '), wi = 0;
      (function nextWord() {
        if (wi < tokens.length) {
          ans.insertBefore(document.createTextNode((si || wi ? ' ' : '') + tokens[wi++]), caret);
          self.scrollThread();
          self.later(nextWord, 24 + Math.random() * 30);
        } else {
          ans.insertBefore(document.createTextNode('.'), caret);
          si++;
          self.later(nextSentence, 140);
        }
      })();
    })();
  };
  Tour.prototype.scrollThread = function () { this.thread.scrollTop = this.thread.scrollHeight; };

  /* ---------- Events ---------- */
  Tour.prototype.bind = function () {
    var self = this, el = this.el;

    el.addEventListener('click', function (e) {
      var t = e.target.closest('[data-chat],[data-new],[data-ask],[data-doc],[data-scope],[data-model],[data-pick-scope],[data-pick-model],[data-send],[data-collapse],[data-expand],[data-act],[data-toggle],[data-private],[data-private-close]');
      if (!t || !el.contains(t)) { self.togglePop(null); return; }
      self.interacted = true;
      if (t.hasAttribute('data-pick-scope')) { self.scope = t.dataset.pickScope || null; self.renderDocs(); self.renderPops(); self.togglePop(null); return; }
      if (t.hasAttribute('data-pick-model')) {
        MODELS.forEach(function (m) { if (m.id === t.dataset.pickModel) self.model = m; });
        self.renderPops(); self.togglePop(null); return;
      }
      if (t.hasAttribute('data-private')) { self.openPrivate(); return; }
      if (t.hasAttribute('data-private-close')) { self.closePrivate(); return; }
      if (t.hasAttribute('data-scope')) { self.togglePop('scope'); return; }
      if (t.hasAttribute('data-model')) { self.togglePop('model'); return; }
      self.togglePop(null);
      if (t.hasAttribute('data-chat')) { self.open(t.dataset.chat); return; }
      if (t.hasAttribute('data-new')) { self.open(null); return; }
      if (t.hasAttribute('data-ask')) { self.ask(A[t.dataset.ask].q, t.dataset.ask); return; }
      if (t.hasAttribute('data-doc')) {
        self.scope = self.scope === t.dataset.doc ? null : t.dataset.doc;
        self.renderDocs(); self.renderPops();
        return;
      }
      if (t.hasAttribute('data-toggle')) {
        var group = t.closest('.tour-group'), collapsed = group.classList.toggle('is-collapsed');
        t.setAttribute('aria-expanded', String(!collapsed));
        return;
      }
      if (t.hasAttribute('data-send')) { self.submit(); return; }
      if (t.hasAttribute('data-collapse')) { el.classList.add('is-collapsed'); return; }
      if (t.hasAttribute('data-expand')) { el.classList.remove('is-collapsed'); return; }
      if (t.hasAttribute('data-act')) {
        if (t.dataset.act === 'copy') { self.copy(t); return; }
        var row = t.parentElement;
        row.querySelectorAll('.is-on').forEach(function (b) { if (b !== t) b.classList.remove('is-on'); });
        t.classList.toggle('is-on');
      }
    });
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var open = self.composer.querySelector('.tour-pop:not([hidden])');
      if (open) self.togglePop(null); else self.closePrivate();
    });

    el.querySelectorAll('[data-input]').forEach(function (inp) {
      var box = inp.closest('.tour-composer');
      inp.addEventListener('input', function () { box.classList.toggle('has-text', inp.value.trim().length > 0); self.interacted = true; });
      inp.addEventListener('focus', function () { self.interacted = true; });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); self.submit(); }
      });
    });
    document.addEventListener('click', function outside(e) {
      if (!el.isConnected) { document.removeEventListener('click', outside); self.cancel(); clearTimeout(self.twTimer); return; }
      if (!el.contains(e.target)) self.togglePop(null);
    });
  };
  /* Copy: the icon turns into a tick for a moment, the way the app confirms it */
  Tour.prototype.copy = function (btn) {
    var turn = btn.closest('.tour-turn'), text = turn ? turn.querySelector('[data-answer]').textContent : '';
    if (text && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(function () {});
    var use = btn.querySelector('use');
    btn.classList.add('is-done'); use.setAttribute('href', '#i-check'); btn.setAttribute('title', 'Copied');
    clearTimeout(btn.copyTimer);
    btn.copyTimer = setTimeout(function () { btn.classList.remove('is-done'); use.setAttribute('href', '#i-copy'); btn.setAttribute('title', 'Copy'); }, 1600);
  };
  Tour.prototype.submit = function () {
    var q = this.input.value.trim();
    if (!q) return;
    this.input.value = ''; this.composer.classList.remove('has-text');
    this.ask(q, null);
  };

  /* ---------- Visibility: typewriter placeholder + one replay of the open answer ---------- */
  Tour.prototype.observe = function () {
    var self = this;
    if (!('IntersectionObserver' in window)) { this.visible = true; this.typewriter(true); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        self.visible = en.isIntersecting;
        self.typewriter(en.isIntersecting);
        if (en.isIntersecting && en.intersectionRatio >= 0.5 && !self.played) { self.played = true; self.replay(); }
      });
    }, { threshold: [0, 0.5] });
    io.observe(this.el);
  };
  /* The first time the section scrolls into view, the open answer is written
     again in front of the visitor, so the thinking and replying marks are seen
     without anyone having to click. Skipped once the visitor has interacted. */
  Tour.prototype.replay = function () {
    var self = this;
    if (reduced || this.interacted) return;
    var chat = this.chat(this.active);
    if (!chat) return;
    var index = chat.turns.length - 1, wrap = this.thread.querySelector('.tour-turn[data-turn="' + index + '"]');
    if (!wrap) return;
    setTimeout(function () {
      if (self.interacted || self.active !== chat.id) return;
      self.play(chat, chat.turns[index], wrap, null);
    }, 700);
  };
  Tour.prototype.typewriter = function (on) {
    var self = this, input = this.input;
    clearTimeout(this.twTimer);
    if (!on || reduced) { input.placeholder = PLACEHOLDERS[0]; return; }
    var pi = this.twIndex || 0, text = PLACEHOLDERS[pi], i = 0, deleting = false;
    (function tick() {
      if (document.activeElement === input || input.value) { input.placeholder = PLACEHOLDERS[0]; self.twTimer = setTimeout(tick, 1200); return; }
      input.placeholder = text.slice(0, i);
      var delay = deleting ? 22 : 45;
      if (!deleting && i === text.length) { delay = 1900; deleting = true; }
      else if (deleting && i === 0) { deleting = false; pi = (pi + 1) % PLACEHOLDERS.length; self.twIndex = pi; text = PLACEHOLDERS[pi]; delay = 400; }
      else i += deleting ? -1 : 1;
      self.twTimer = setTimeout(tick, delay);
    })();
  };

  function mount(root) {
    var el = (root || document).querySelector('[data-tour]');
    if (!el || el.tourInstance) return el && el.tourInstance;
    el.tourInstance = new Tour(el);
    return el.tourInstance;
  }
  return { mount: mount };
})();

/* Ported from retrieva-preview_2 UNCHANGED but for these two lines: it hung
   itself on window there because the preview had no modules. Everything above
   is the code the draft was signed off on, which is the point -- a rewrite
   would have been a second implementation to keep honest. */
export const { mount } = RetrievaTour;
export default RetrievaTour;
