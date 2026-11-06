const SOLVED_KEY = 'problemweb.solved';
const FILTER_KEY = 'problemweb.practice.';

const stage = document.getElementById('practice-stage');
const statsBar = document.getElementById('practice-stats');
const els = {
  sources: document.getElementById('source-group'),
  topics: document.getElementById('topic-group'),
  topicAll: document.getElementById('topic-all'),
  yearFrom: document.getElementById('year-from'),
  yearTo: document.getElementById('year-to'),
  hideSolved: document.getElementById('hide-solved'),
  count: document.getElementById('match-count'),
};

let subject = null;
let sources = [];
let allProblems = [];
let state = {};
let solved = new Set();

let queue = [];
let current = null;
let answered = false;
let showingSummary = false;
let history = [];
let streak = 0;

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sourceName(id) {
  return sources.find((s) => s.id === id)?.name || id;
}

function topicName(id) {
  return subject.topics.find((t) => t.id === id)?.name || id;
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\\text/g, '')
    .replace(/[\s$\\{}()_^]/g, '');
}

function asNumber(value) {
  const cleaned = String(value ?? '').replace(/[\s,]/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(cleaned)) return null;
  return Number(cleaned);
}

function isWrittenCorrect(problem, input) {
  const typed = asNumber(input);
  const expected = asNumber(problem.answer);
  if (typed !== null && expected !== null) return Math.abs(typed - expected) < 1e-9;
  const target = normalize(input);
  if (!target) return false;
  return [problem.answer, ...(problem.accept || [])].some((a) => normalize(a) === target);
}

/* ---------- filters ---------- */

function availableYears() {
  return [...new Set(allProblems.map((p) => p.year))].sort((a, b) => a - b);
}

function availableSources() {
  const ids = new Set(allProblems.map((p) => p.source));
  return sources.filter((s) => ids.has(s.id));
}

function defaultState() {
  const years = availableYears();
  return {
    sources: availableSources().map((s) => s.id),
    topics: subject.topics.map((t) => t.id),
    yearFrom: years[0],
    yearTo: years[years.length - 1],
    hideSolved: false,
  };
}

function loadState() {
  const base = defaultState();
  const saved = Store.get('localStorage', FILTER_KEY + subject.id);
  if (!saved) return base;
  const years = availableYears();
  const validSources = availableSources().map((s) => s.id);
  const validTopics = subject.topics.map((t) => t.id);
  return {
    sources: Array.isArray(saved.sources) ? saved.sources.filter((s) => validSources.includes(s)) : base.sources,
    topics: Array.isArray(saved.topics) ? saved.topics.filter((t) => validTopics.includes(t)) : base.topics,
    yearFrom: years.includes(saved.yearFrom) ? saved.yearFrom : base.yearFrom,
    yearTo: years.includes(saved.yearTo) ? saved.yearTo : base.yearTo,
    hideSolved: Boolean(saved.hideSolved),
  };
}

function saveState() {
  Store.set('localStorage', FILTER_KEY + subject.id, state);
}

function saveSolved() {
  Store.set('localStorage', SOLVED_KEY, [...solved]);
}

function pool() {
  return allProblems.filter(
    (p) =>
      state.sources.includes(p.source) &&
      p.topics.some((t) => state.topics.includes(t)) &&
      p.year >= state.yearFrom &&
      p.year <= state.yearTo &&
      !(state.hideSolved && solved.has(p.id))
  );
}

function chip(name, value, label, checked, count) {
  return `
    <label class="chip ${count === 0 ? 'is-empty' : ''}">
      <input type="checkbox" name="${name}" value="${value}" ${checked ? 'checked' : ''}>
      <span>${escapeHtml(label)}${count === undefined ? '' : `<small>${count}</small>`}</span>
    </label>`;
}

function renderFilters() {
  els.sources.innerHTML = availableSources()
    .map((s) => chip('source', s.id, s.name, state.sources.includes(s.id)))
    .join('');

  const years = availableYears();
  const options = (selected) => years.map((y) => `<option value="${y}" ${y === selected ? 'selected' : ''}>${y}</option>`).join('');
  els.yearFrom.innerHTML = options(state.yearFrom);
  els.yearTo.innerHTML = options(state.yearTo);

  els.hideSolved.checked = state.hideSolved;
  renderTopics();
}

function renderTopics() {
  const inScope = allProblems.filter(
    (p) => state.sources.includes(p.source) && p.year >= state.yearFrom && p.year <= state.yearTo
  );
  els.topics.innerHTML = subject.topics
    .map((t) => chip('topic', t.id, t.name, state.topics.includes(t.id), inScope.filter((p) => p.topics.includes(t.id)).length))
    .join('');
  const allChecked = subject.topics.every((t) => state.topics.includes(t.id));
  els.topicAll.textContent = allChecked ? 'ล้างทั้งหมด' : 'เลือกทั้งหมด';
}

function renderMatchCount() {
  const n = pool().length;
  if (!state.sources.length) els.count.textContent = 'เลือกแหล่งข้อสอบอย่างน้อย 1 แหล่ง';
  else if (!state.topics.length) els.count.textContent = 'เลือกหัวข้ออย่างน้อย 1 หัวข้อ';
  else els.count.textContent = `มี ${n} ข้อที่ตรงเงื่อนไข`;
}

function checkedValues(container) {
  return [...container.querySelectorAll('input:checked')].map((input) => input.value);
}

function onFilterChange() {
  state.sources = checkedValues(els.sources);
  state.topics = checkedValues(els.topics);
  state.yearFrom = Number(els.yearFrom.value);
  state.yearTo = Number(els.yearTo.value);
  if (state.yearFrom > state.yearTo) {
    if (document.activeElement === els.yearFrom) state.yearTo = state.yearFrom;
    else state.yearFrom = state.yearTo;
    els.yearFrom.value = state.yearFrom;
    els.yearTo.value = state.yearTo;
  }
  state.hideSolved = els.hideSolved.checked;
  saveState();
  renderTopics();
  restartPool();
}

/* ---------- practice flow ---------- */

function renderStats() {
  const done = history.length;
  const correct = history.filter((h) => h.correct).length;
  const pct = done ? Math.round((correct / done) * 100) : 0;
  statsBar.innerHTML = `
    <div class="stat"><strong>${done}</strong><span>ทำแล้ว</span></div>
    <div class="stat"><strong>${correct}</strong><span>ถูก${done ? ` (${pct}%)` : ''}</span></div>
    <div class="stat"><strong>${streak}</strong><span>ถูกติดกัน</span></div>
    ${done ? '<button type="button" class="btn btn-soft btn-sm" id="summary-btn">ดูสรุป</button>' : ''}`;
  const summaryBtn = document.getElementById('summary-btn');
  if (summaryBtn) summaryBtn.addEventListener('click', renderSummary);
}

function restartPool() {
  renderMatchCount();
  queue = shuffle(pool());
  nextQuestion();
}

function nextQuestion() {
  showingSummary = false;
  const total = pool().length;

  if (!state.sources.length || !state.topics.length || total === 0) {
    current = null;
    const reason = !state.sources.length
      ? 'เลือกแหล่งข้อสอบอย่างน้อย 1 แหล่ง'
      : !state.topics.length
        ? 'เลือกหัวข้ออย่างน้อย 1 หัวข้อ'
        : state.hideSolved
          ? 'คุณทำถูกครบทุกข้อที่ตรงเงื่อนไขแล้ว ลองปิดตัวเลือก "ซ่อนข้อที่ทำถูกแล้ว" หรือเปลี่ยนตัวกรอง'
          : 'ไม่พบข้อสอบที่ตรงเงื่อนไข ลองเปลี่ยนตัวกรองทางซ้าย';
    stage.innerHTML = `<div class="empty-state"><p>${reason}</p></div>`;
    renderStats();
    return;
  }

  if (!queue.length) {
    current = null;
    stage.innerHTML = `
      <div class="empty-state">
        <p><strong>ทำครบทุกข้อที่ตรงเงื่อนไขแล้ว (${total} ข้อ)</strong></p>
        <p class="muted">เปลี่ยนตัวกรองเพื่อฝึกเรื่องอื่น หรือสุ่มวนทำใหม่อีกรอบ</p>
        <button type="button" class="btn btn-primary" id="again-btn">${icon('shuffle', 'icon-sm')} สุ่มวนใหม่</button>
      </div>`;
    document.getElementById('again-btn').addEventListener('click', () => {
      queue = shuffle(pool());
      nextQuestion();
    });
    renderStats();
    return;
  }

  current = queue.shift();
  renderQuestion();
}

function choiceListHtml(problem) {
  return `
    <div class="option-list" role="radiogroup" aria-label="ตัวเลือก">
      ${problem.choices
        .map(
          (c, k) => `
          <label class="option">
            <input type="radio" name="option" value="${k + 1}">
            <span class="option-key">${k + 1}</span>
            <span class="option-text">${richText(c)}</span>
          </label>`
        )
        .join('')}
    </div>`;
}

function writtenHtml() {
  return `
    <label class="field written-field">
      <span class="field-label">คำตอบของคุณ</span>
      <input type="text" id="written-input" autocomplete="off" placeholder="พิมพ์คำตอบ">
    </label>`;
}

function renderQuestion() {
  const problem = current;
  answered = false;
  const isChoice = Array.isArray(problem.choices);
  const isDone = solved.has(problem.id);

  stage.innerHTML = `
    <article class="practice-card">
      <div class="q-head">
        <span class="q-no">ข้อที่ ${history.length + 1}</span>
        <span class="q-src">${escapeHtml(sourceName(problem.source))} ${problem.year} · ข้อ ${problem.number} · ${escapeHtml(problem.topics.map(topicName).join(', '))}</span>
        ${isDone ? '<span class="badge badge-ok">เคยทำถูกแล้ว</span>' : ''}
      </div>
      <div class="q-text practice-question">${richText(problem.question)}</div>
      ${problem.image ? `<figure class="q-figure"><img src="${problem.image}" alt="ภาพประกอบโจทย์"></figure>` : ''}
      ${isChoice ? choiceListHtml(problem) : writtenHtml()}
      <div class="feedback" id="feedback" hidden></div>
    </article>
    <div class="practice-actions">
      <span class="muted practice-hint">${isChoice ? `กด 1–${problem.choices.length} เพื่อเลือก · ` : ''}Enter เพื่อตรวจ / ไปข้อถัดไป</span>
      <button type="button" class="btn btn-ghost-dark" id="skip-btn">ข้าม</button>
      <button type="button" class="btn btn-primary" id="action-btn" disabled>ตรวจคำตอบ</button>
    </div>`;

  renderMath(stage);
  renderStats();

  const actionBtn = document.getElementById('action-btn');
  if (isChoice) {
    stage.querySelector('.option-list').addEventListener('change', () => {
      actionBtn.disabled = false;
    });
  } else {
    const input = document.getElementById('written-input');
    input.addEventListener('input', () => {
      actionBtn.disabled = input.value.trim() === '';
    });
    input.focus({ preventScroll: true });
  }
  actionBtn.addEventListener('click', () => (answered ? nextQuestion() : check()));
  document.getElementById('skip-btn').addEventListener('click', nextQuestion);
}

function check() {
  const problem = current;
  const isChoice = Array.isArray(problem.choices);
  let correct;

  if (isChoice) {
    const selected = stage.querySelector('input[name="option"]:checked');
    if (!selected) return;
    correct = selected.value === String(problem.answer);
    stage.querySelectorAll('.option').forEach((option) => {
      const input = option.querySelector('input');
      input.disabled = true;
      if (input.value === String(problem.answer)) option.classList.add('is-correct');
      else if (input.checked) option.classList.add('is-wrong');
    });
  } else {
    const input = document.getElementById('written-input');
    const given = input.value.trim();
    if (!given) return;
    correct = isWrittenCorrect(problem, given);
    input.disabled = true;
    input.classList.add(correct ? 'is-correct' : 'is-wrong');
  }

  answered = true;
  history.push({ problem, correct });
  streak = correct ? streak + 1 : 0;
  if (correct && !solved.has(problem.id)) {
    solved.add(problem.id);
    saveSolved();
  }

  const answerLabel = isChoice
    ? `(${escapeHtml(problem.answer)}) ${richText(problem.choices[Number(problem.answer) - 1])}`
    : richText(problem.answer);

  const feedback = document.getElementById('feedback');
  feedback.className = `feedback ${correct ? 'is-correct' : 'is-wrong'}`;
  feedback.innerHTML = `
    <p class="feedback-title">${icon(correct ? 'check' : 'close', 'icon-sm')} ${correct ? 'ถูกต้อง!' : 'ยังไม่ถูก'}</p>
    ${correct ? '' : `<p>คำตอบที่ถูกคือ <strong>${answerLabel}</strong></p>`}
    ${problem.explanation ? `<p class="feedback-explain">${richText(problem.explanation)}</p>` : ''}`;
  feedback.hidden = false;
  renderMath(feedback);

  document.getElementById('skip-btn').hidden = true;
  const actionBtn = document.getElementById('action-btn');
  actionBtn.textContent = 'ข้อถัดไป';
  actionBtn.disabled = false;
  actionBtn.focus({ preventScroll: true });
  renderStats();
}

function renderSummary() {
  showingSummary = true;
  const done = history.length;
  const correct = history.filter((h) => h.correct).length;
  const rows = history
    .map(
      (h, i) => `
      <li class="review-row ${h.correct ? 'is-correct' : 'is-wrong'}">
        <span class="review-mark">${icon(h.correct ? 'check' : 'close', 'icon-sm')}</span>
        <span class="review-text">
          <strong>ข้อที่ ${i + 1}</strong>
          <span class="muted">${escapeHtml(h.problem.topics.map(topicName).join(', '))} · ${escapeHtml(sourceName(h.problem.source))} ${h.problem.year} ข้อ ${h.problem.number}</span>
        </span>
      </li>`
    )
    .join('');

  stage.innerHTML = `
    <article class="practice-card result-card">
      <h2>สรุปการฝึกครั้งนี้</h2>
      <p class="muted">ตอบถูก ${correct} จาก ${done} ข้อ (${Math.round((correct / done) * 100)}%)</p>
      <ul class="review-list">${rows}</ul>
      <div class="result-actions">
        <button type="button" class="btn btn-primary" id="continue-btn">ทำต่อ</button>
        <button type="button" class="btn btn-soft" id="reset-btn">เริ่มนับใหม่</button>
        <a class="btn btn-ghost-dark" href="create.html?s=${subject.id}">สร้างชุดข้อสอบ PDF</a>
      </div>
    </article>`;
  document.getElementById('continue-btn').addEventListener('click', () => {
    showingSummary = false;
    if (current) {
      renderQuestion();
    } else {
      nextQuestion();
    }
  });
  document.getElementById('reset-btn').addEventListener('click', () => {
    history = [];
    streak = 0;
    nextQuestion();
  });
}

document.addEventListener('keydown', (event) => {
  if (!current || showingSummary || event.target.closest('#filter-form')) return;
  const actionBtn = document.getElementById('action-btn');
  if (event.key === 'Enter' && actionBtn && !actionBtn.disabled) {
    event.preventDefault();
    actionBtn.click();
    return;
  }
  if (answered || event.target.matches('input[type="text"]')) return;
  const option = stage.querySelectorAll('input[name="option"]')[Number(event.key) - 1];
  if (option) {
    option.checked = true;
    option.dispatchEvent(new Event('change', { bubbles: true }));
  }
});

function bindFilters() {
  els.sources.addEventListener('change', onFilterChange);
  els.topics.addEventListener('change', onFilterChange);
  els.yearFrom.addEventListener('change', onFilterChange);
  els.yearTo.addEventListener('change', onFilterChange);
  els.hideSolved.addEventListener('change', onFilterChange);
  els.topicAll.addEventListener('click', () => {
    const allChecked = subject.topics.every((t) => state.topics.includes(t.id));
    els.topics.querySelectorAll('input').forEach((input) => {
      input.checked = !allChecked;
    });
    onFilterChange();
  });
}

(async () => {
  const subjects = await Layout.init('subject');
  const id = new URLSearchParams(location.search).get('s');
  subject = subjects.find((s) => s.id === id);

  if (!subject) {
    stage.innerHTML = '<div class="empty-state"><p>ไม่พบวิชาที่เลือก</p><a class="btn btn-soft" href="index.html">กลับหน้าแรก</a></div>';
    return;
  }

  document.title = `ฝึกทำ ${subject.name} | คลังข้อสอบ`;
  document.getElementById('practice-title').textContent = `ฝึกทำข้อสอบ ${subject.name}`;
  const crumb = document.getElementById('crumb-subject');
  crumb.textContent = subject.name;
  crumb.href = `subject.html?s=${subject.id}`;

  try {
    [allProblems, sources] = await Promise.all([DataStore.getProblems(subject.id), DataStore.getSources()]);
  } catch (error) {
    showError(stage, error.message);
    return;
  }

  if (!allProblems.length) {
    stage.innerHTML = '<div class="empty-state"><p>ยังไม่มีข้อสอบให้ฝึกในวิชานี้</p></div>';
    return;
  }

  solved = new Set(Store.get('localStorage', SOLVED_KEY) || []);
  state = loadState();
  renderFilters();
  bindFilters();
  restartPool();
})();
