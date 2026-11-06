const SOLVED_KEY = 'problemweb.solved';
const STATE_KEY = 'problemweb.online.v2';

const setupView = document.getElementById('setup-view');
const solveView = document.getElementById('solve-view');
const stage = document.getElementById('practice-stage');
const statsBar = document.getElementById('practice-stats');
const els = {
  subjects: document.getElementById('subject-group'),
  topicsField: document.getElementById('topics-field'),
  topicBlocks: document.getElementById('topic-blocks'),
  testField: document.getElementById('test-field'),
  tests: document.getElementById('test-group'),
  yearField: document.getElementById('year-field'),
  yearFrom: document.getElementById('year-from'),
  yearTo: document.getElementById('year-to'),
  hideSolved: document.getElementById('hide-solved'),
  count: document.getElementById('match-count'),
  start: document.getElementById('start-btn'),
};

let groups = []; // subjects (e.g. Math), each with shared topics and one or more tests
let sources = [];
const loaded = new Map(); // test id -> problems
const testGroup = new Map(); // test id -> group id
let state = { groups: [], topics: [], excludedTests: [], yearFrom: null, yearTo: null, hideSolved: false };
let solved = new Set();

let queue = [];
let current = null;
let attempts = 0;
let finished = false;
let showingSummary = false;
let history = [];
let streak = 0;

const topicKey = (groupId, topicId) => `${groupId}:${topicId}`;

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

/* ---------- step 1: choose subjects, tests and topics ---------- */

function selectedGroups() {
  return groups.filter((g) => state.groups.includes(g.id));
}

function selectedProblems() {
  return selectedGroups()
    .flatMap((g) => g.tests)
    .flatMap((t) => loaded.get(t.id) || []);
}

function availableYears() {
  return [...new Set(selectedProblems().map((p) => p.year))].sort((a, b) => a - b);
}

function yearRange() {
  const years = availableYears();
  if (!years.length) return { from: -Infinity, to: Infinity };
  return {
    from: years.includes(state.yearFrom) ? state.yearFrom : years[0],
    to: years.includes(state.yearTo) ? state.yearTo : years[years.length - 1],
  };
}

function inScope() {
  const { from, to } = yearRange();
  return selectedProblems().filter(
    (p) => !state.excludedTests.includes(p.subject) && p.year >= from && p.year <= to
  );
}

function pool() {
  return inScope().filter((p) => {
    const groupId = testGroup.get(p.subject);
    return (
      p.topics.some((t) => state.topics.includes(topicKey(groupId, t))) &&
      !(state.hideSolved && solved.has(p.id))
    );
  });
}

function saveState() {
  Store.set('localStorage', STATE_KEY, state);
}

function saveSolved() {
  Store.set('localStorage', SOLVED_KEY, [...solved]);
}

function chip(name, value, label, checked, count) {
  return `
    <label class="chip ${count === 0 ? 'is-empty' : ''}">
      <input type="checkbox" name="${name}" value="${escapeHtml(value)}" ${checked ? 'checked' : ''}>
      <span>${escapeHtml(label)}${count === undefined ? '' : `<small>${count}</small>`}</span>
    </label>`;
}

function renderSubjects() {
  els.subjects.innerHTML = groups
    .map((g) => {
      const ready = g.tests.every((t) => loaded.has(t.id));
      const count = ready ? g.tests.reduce((n, t) => n + loaded.get(t.id).length, 0) : undefined;
      return chip('subject', g.id, g.name, state.groups.includes(g.id), count);
    })
    .join('');
}

function renderTopics() {
  const hasGroups = state.groups.length > 0;
  els.topicsField.hidden = !hasGroups;
  els.yearField.hidden = !hasGroups;
  if (!hasGroups) return;

  const scope = inScope();
  els.topicBlocks.innerHTML = selectedGroups()
    .map((g) => {
      const keys = g.topics.map((t) => topicKey(g.id, t.id));
      const allChecked = keys.every((k) => state.topics.includes(k));
      const chips = g.topics
        .map((t) => {
          const count = scope.filter((p) => testGroup.get(p.subject) === g.id && p.topics.includes(t.id)).length;
          return chip('topic', topicKey(g.id, t.id), t.name, state.topics.includes(topicKey(g.id, t.id)), count);
        })
        .join('');
      return `
        <div class="topic-block">
          <div class="field-label-row">
            <strong class="topic-block-title">${escapeHtml(g.name)}</strong>
            <button type="button" class="link-btn" data-toggle-group="${g.id}">${allChecked ? 'ล้างทั้งหมด' : 'เลือกทั้งหมด'}</button>
          </div>
          <div class="chip-group">${chips}</div>
        </div>`;
    })
    .join('');
}

// Tests are only worth choosing when a subject has more than one (e.g. Math 1 / Math 2 / Association).
function choosableTests() {
  return selectedGroups()
    .filter((g) => g.tests.length > 1)
    .flatMap((g) => g.tests);
}

function renderTests() {
  const tests = choosableTests();
  els.testField.hidden = tests.length === 0;
  els.tests.innerHTML = tests
    .map((t) => chip('test', t.id, t.name, !state.excludedTests.includes(t.id), loaded.get(t.id)?.length))
    .join('');
}

function renderYears() {
  const years = availableYears();
  const { from, to } = yearRange();
  const options = (selected) => years.map((y) => `<option value="${y}" ${y === selected ? 'selected' : ''}>${y}</option>`).join('');
  els.yearFrom.innerHTML = options(from);
  els.yearTo.innerHTML = options(to);
}

function renderMatchCount() {
  const n = pool().length;
  const groupIds = state.groups;
  if (!groupIds.length) els.count.textContent = 'เลือกวิชาอย่างน้อย 1 วิชา';
  else if (!state.topics.some((k) => groupIds.includes(k.split(':')[0]))) els.count.textContent = 'เลือกหัวข้ออย่างน้อย 1 หัวข้อ';
  else els.count.textContent = `มี ${n} ข้อที่ตรงเงื่อนไข`;
  els.start.disabled = n === 0;
}

function renderAll() {
  renderSubjects();
  renderTopics();
  renderTests();
  renderYears();
  els.hideSolved.checked = state.hideSolved;
  renderMatchCount();
}

function checkedValues(container) {
  return [...container.querySelectorAll('input:checked')].map((input) => input.value);
}

async function ensureLoaded(groupIds) {
  const tests = groups.filter((g) => groupIds.includes(g.id)).flatMap((g) => g.tests);
  await Promise.all(
    tests
      .filter((t) => !loaded.has(t.id))
      .map(async (t) => {
        loaded.set(t.id, await DataStore.getProblems(t.id));
      })
  );
}

async function onSubjectChange() {
  const checked = checkedValues(els.subjects);
  const next = groups.map((g) => g.id).filter((id) => checked.includes(id));
  const added = next.filter((id) => !state.groups.includes(id));
  const removed = state.groups.filter((id) => !next.includes(id));

  els.count.textContent = 'กำลังโหลด…';
  els.start.disabled = true;
  try {
    await ensureLoaded(added);
  } catch (error) {
    renderAll();
    els.count.textContent = error.message;
    return;
  }

  state.groups = next;
  state.topics = state.topics.filter((k) => !removed.includes(k.split(':')[0]));
  added.forEach((id) => {
    groups.find((g) => g.id === id).topics.forEach((t) => state.topics.push(topicKey(id, t.id)));
  });
  saveState();
  renderAll();
}

function onFilterChange() {
  state.topics = checkedValues(els.topicBlocks);

  const shown = choosableTests().map((t) => t.id);
  const checked = checkedValues(els.tests);
  state.excludedTests = state.excludedTests
    .filter((id) => !shown.includes(id))
    .concat(shown.filter((id) => !checked.includes(id)));

  let from = Number(els.yearFrom.value);
  let to = Number(els.yearTo.value);
  if (from > to) {
    if (document.activeElement === els.yearFrom) to = from;
    else from = to;
  }
  state.yearFrom = from;
  state.yearTo = to;
  state.hideSolved = els.hideSolved.checked;
  saveState();
  renderAll();
}

function showSetup() {
  current = null;
  solveView.hidden = true;
  setupView.hidden = false;
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function startPractice() {
  const list = pool();
  if (!list.length) return;
  queue = shuffle(list);
  setupView.hidden = true;
  solveView.hidden = false;
  nextQuestion();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- step 2: solve ---------- */

function renderStats() {
  const done = history.length;
  const correct = history.filter((h) => h.correct).length;
  const pct = done ? Math.round((correct / done) * 100) : 0;
  statsBar.innerHTML = `
    <div class="stat"><strong>${done}</strong><span>ทำแล้ว</span></div>
    <div class="stat"><strong>${correct}</strong><span>ถูก${done ? ` (${pct}%)` : ''}</span></div>
    <div class="stat"><strong>${streak}</strong><span>ถูกติดกัน</span></div>
    <div class="stats-actions">
      ${done ? '<button type="button" class="btn btn-soft btn-sm" id="summary-btn">ดูสรุป</button>' : ''}
      <button type="button" class="btn btn-ghost-dark btn-sm" id="change-btn">เปลี่ยนหัวข้อ</button>
    </div>`;
  const summaryBtn = document.getElementById('summary-btn');
  if (summaryBtn) summaryBtn.addEventListener('click', renderSummary);
  document.getElementById('change-btn').addEventListener('click', showSetup);
}

function nextQuestion() {
  showingSummary = false;
  const total = pool().length;

  if (!queue.length) {
    current = null;
    stage.innerHTML = `
      <div class="empty-state">
        <p><strong>ทำครบทุกข้อที่เลือกแล้ว (${total} ข้อ)</strong></p>
        <p class="muted">เปลี่ยนหัวข้อเพื่อฝึกเรื่องอื่น หรือสุ่มวนทำใหม่อีกรอบ</p>
        <div class="result-actions">
          <button type="button" class="btn btn-primary" id="again-btn">${icon('shuffle', 'icon-sm')} สุ่มวนใหม่</button>
          <button type="button" class="btn btn-soft" id="topics-btn">เปลี่ยนหัวข้อ</button>
        </div>
      </div>`;
    document.getElementById('again-btn').addEventListener('click', () => {
      queue = shuffle(pool());
      if (queue.length) nextQuestion();
      else showSetup();
    });
    document.getElementById('topics-btn').addEventListener('click', showSetup);
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

function originLabel(problem) {
  return `ข้อ ${problem.number} · ${sourceName(problem.source)} ${problem.year}`;
}

function renderQuestion() {
  const problem = current;
  attempts = 0;
  finished = false;
  const isChoice = Array.isArray(problem.choices);

  // Before the question is finished only the test name is shown.
  stage.innerHTML = `
    <article class="practice-card">
      <div class="q-head">
        <span class="q-no">ข้อที่ ${history.length + 1}</span>
        <span class="q-src" id="q-src">${escapeHtml(sourceName(problem.source))}</span>
      </div>
      <div class="q-text practice-question">${richText(problem.question)}</div>
      ${problem.image ? `<figure class="q-figure"><img src="${problem.image}" alt="ภาพประกอบโจทย์"></figure>` : ''}
      ${isChoice ? choiceListHtml(problem) : writtenHtml()}
      <div class="feedback" id="feedback" hidden></div>
    </article>
    <div class="practice-actions">
      <span class="muted practice-hint">${isChoice ? `กด 1–${problem.choices.length} เพื่อเลือก · ` : ''}Enter เพื่อส่งคำตอบ</span>
      <button type="button" class="btn btn-ghost-dark" id="giveup-btn" hidden>ยอมแพ้</button>
      <button type="button" class="btn btn-primary" id="action-btn" disabled>ส่งคำตอบ</button>
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
      input.classList.remove('is-wrong');
      actionBtn.disabled = input.value.trim() === '';
    });
    input.focus({ preventScroll: true });
  }
  actionBtn.addEventListener('click', () => (finished ? nextQuestion() : submitAnswer()));
  document.getElementById('giveup-btn').addEventListener('click', giveUp);
}

function submitAnswer() {
  const problem = current;
  const isChoice = Array.isArray(problem.choices);
  const actionBtn = document.getElementById('action-btn');
  let correct;

  if (isChoice) {
    const selected = stage.querySelector('input[name="option"]:checked');
    if (!selected) return;
    correct = selected.value === String(problem.answer);
    if (!correct) {
      // The wrong choice is crossed out; the right one is not revealed.
      selected.checked = false;
      selected.disabled = true;
      selected.closest('.option').classList.add('is-wrong');
      actionBtn.disabled = true;
    }
  } else {
    const input = document.getElementById('written-input');
    const given = input.value.trim();
    if (!given) return;
    correct = isWrittenCorrect(problem, given);
    if (!correct) {
      input.classList.add('is-wrong');
      input.focus();
      input.select();
    }
  }

  attempts += 1;

  if (!correct) {
    const feedback = document.getElementById('feedback');
    feedback.className = 'feedback is-wrong';
    feedback.innerHTML = `
      <p class="feedback-title">${icon('close', 'icon-sm')} ยังไม่ถูก</p>
      <p>ลองตอบใหม่ได้เรื่อย ๆ หรือกด “ยอมแพ้” เพื่อดูเฉลย (ลองแล้ว ${attempts} ครั้ง)</p>`;
    feedback.hidden = false;
    document.getElementById('giveup-btn').hidden = false;
    return;
  }

  finish(true);
}

function finish(correct) {
  const problem = current;
  const isChoice = Array.isArray(problem.choices);
  finished = true;
  history.push({ problem, correct, attempts, gaveUp: !correct });
  streak = correct ? streak + 1 : 0;
  if (correct && !solved.has(problem.id)) {
    solved.add(problem.id);
    saveSolved();
  }

  // Now that the question is finished, reveal problem number, test and year (in that order).
  document.getElementById('q-src').textContent = originLabel(problem);

  stage.querySelectorAll('input').forEach((input) => {
    input.disabled = true;
  });
  const input = document.getElementById('written-input');
  if (input) {
    input.classList.remove('is-wrong');
    if (correct) input.classList.add('is-correct');
  }
  if (isChoice) {
    stage.querySelectorAll('.option').forEach((option) => {
      option.classList.remove('is-wrong');
      if (option.querySelector('input').value === String(problem.answer)) option.classList.add('is-correct');
    });
  }

  const answerLabel = isChoice
    ? `(${escapeHtml(problem.answer)}) ${richText(problem.choices[Number(problem.answer) - 1])}`
    : richText(problem.answer);

  const feedback = document.getElementById('feedback');
  feedback.className = `feedback ${correct ? 'is-correct' : 'is-wrong'}`;
  feedback.innerHTML = correct
    ? `<p class="feedback-title">${icon('check', 'icon-sm')} ถูกต้อง!${attempts > 1 ? ` (ใช้ ${attempts} ครั้ง)` : ''}</p>
       ${problem.explanation ? `<p class="feedback-explain">${richText(problem.explanation)}</p>` : ''}`
    : `<p class="feedback-title">${icon('close', 'icon-sm')} เฉลย</p>
       <p>คำตอบที่ถูกคือ <strong>${answerLabel}</strong></p>
       ${problem.explanation ? `<p class="feedback-explain">${richText(problem.explanation)}</p>` : ''}`;
  feedback.hidden = false;
  renderMath(feedback);

  document.getElementById('giveup-btn').hidden = true;
  const actionBtn = document.getElementById('action-btn');
  actionBtn.textContent = 'ข้อถัดไป';
  actionBtn.disabled = false;
  actionBtn.focus({ preventScroll: true });
  renderStats();
}

function giveUp() {
  if (!current || finished) return;
  finish(false);
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
          <strong>ข้อที่ ${i + 1} · ${escapeHtml(originLabel(h.problem))}</strong>
          <span class="muted">${h.gaveUp ? 'ยอมแพ้' : h.attempts === 1 ? 'ถูกในครั้งแรก' : `ถูกในครั้งที่ ${h.attempts}`}</span>
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
        <a class="btn btn-ghost-dark" href="create.html">สร้างชุดข้อสอบ PDF</a>
      </div>
    </article>`;
  document.getElementById('continue-btn').addEventListener('click', () => {
    showingSummary = false;
    if (current && !finished) renderQuestion();
    else nextQuestion();
  });
  document.getElementById('reset-btn').addEventListener('click', () => {
    history = [];
    streak = 0;
    if (current && !finished) renderQuestion();
    else nextQuestion();
  });
}

document.addEventListener('keydown', (event) => {
  if (solveView.hidden || !current || showingSummary) return;
  const actionBtn = document.getElementById('action-btn');
  if (event.key === 'Enter' && actionBtn && !actionBtn.disabled) {
    event.preventDefault();
    actionBtn.click();
    return;
  }
  if (finished || event.target.matches('input[type="text"]')) return;
  const option = stage.querySelectorAll('input[name="option"]')[Number(event.key) - 1];
  if (option && !option.disabled) {
    option.checked = true;
    option.dispatchEvent(new Event('change', { bubbles: true }));
  }
});

function bindFilters() {
  els.subjects.addEventListener('change', onSubjectChange);
  els.topicBlocks.addEventListener('change', onFilterChange);
  els.tests.addEventListener('change', onFilterChange);
  els.yearFrom.addEventListener('change', onFilterChange);
  els.yearTo.addEventListener('change', onFilterChange);
  els.hideSolved.addEventListener('change', onFilterChange);
  els.start.addEventListener('click', startPractice);
  els.topicBlocks.addEventListener('click', (event) => {
    const button = event.target.closest('[data-toggle-group]');
    if (!button) return;
    const group = groups.find((g) => g.id === button.dataset.toggleGroup);
    const keys = group.topics.map((t) => topicKey(group.id, t.id));
    const allChecked = keys.every((k) => state.topics.includes(k));
    state.topics = state.topics.filter((k) => !keys.includes(k));
    if (!allChecked) state.topics.push(...keys);
    saveState();
    renderAll();
  });
}

function restoreState() {
  const saved = Store.get('localStorage', STATE_KEY);
  const param = new URLSearchParams(location.search).get('s');
  const preselect = groups.find((g) => g.id === param || g.tests.some((t) => t.id === param));
  const validIds = groups.map((g) => g.id);
  const validKeys = new Set(groups.flatMap((g) => g.topics.map((t) => topicKey(g.id, t.id))));

  if (preselect) {
    // Coming from a test page (e.g. ?s=math1): preselect its subject and only that test.
    state.groups = [preselect.id];
    state.topics = preselect.topics.map((t) => topicKey(preselect.id, t.id));
    state.excludedTests =
      preselect.tests.length > 1 && preselect.tests.some((t) => t.id === param)
        ? preselect.tests.filter((t) => t.id !== param).map((t) => t.id)
        : [];
  } else if (saved) {
    state.groups = Array.isArray(saved.groups) ? saved.groups.filter((id) => validIds.includes(id)) : [];
    state.topics = Array.isArray(saved.topics)
      ? saved.topics.filter((k) => validKeys.has(k) && state.groups.includes(k.split(':')[0]))
      : [];
    state.excludedTests = Array.isArray(saved.excludedTests) ? saved.excludedTests : [];
  }
  if (saved) {
    state.yearFrom = Number.isFinite(saved.yearFrom) ? saved.yearFrom : null;
    state.yearTo = Number.isFinite(saved.yearTo) ? saved.yearTo : null;
    state.hideSolved = Boolean(saved.hideSolved);
  }
}

(async () => {
  try {
    [groups, sources] = await Promise.all([DataStore.getGroups(), DataStore.getSources()]);
  } catch (error) {
    await Layout.init('online');
    setupView.innerHTML = '';
    showError(setupView, error.message);
    return;
  }
  await Layout.init('online');
  if (!groups.length) {
    setupView.innerHTML = '<div class="empty-state"><p>โหลดรายชื่อวิชาไม่สำเร็จ</p></div>';
    return;
  }

  groups.forEach((g) => g.tests.forEach((t) => testGroup.set(t.id, g.id)));
  restoreState();
  try {
    await ensureLoaded(state.groups);
  } catch (error) {
    setupView.innerHTML = '';
    showError(setupView, error.message);
    return;
  }

  solved = new Set(Store.get('localStorage', SOLVED_KEY) || []);
  renderAll();
  bindFilters();
})();
