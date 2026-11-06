const DEFAULT_COUNT = 5;

const stage = document.getElementById('practice-stage');
const progress = document.getElementById('practice-progress');

let subject = null;
let sources = [];
let allProblems = [];
let questions = [];
let results = [];
let current = 0;
let answered = false;

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

function renderProgress() {
  const dots = questions
    .map((_, i) => {
      const state = results[i] === true ? 'is-correct' : results[i] === false ? 'is-wrong' : i === current ? 'is-current' : '';
      return `<span class="progress-dot ${state}"></span>`;
    })
    .join('');
  const label = current < questions.length ? `ข้อ ${current + 1} จาก ${questions.length}` : 'สรุปผล';
  progress.innerHTML = `<div class="progress-dots">${dots}</div><span class="progress-label">${label}</span>`;
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
  const problem = questions[current];
  answered = false;
  const isChoice = Array.isArray(problem.choices);
  const isLast = current === questions.length - 1;

  stage.innerHTML = `
    <article class="practice-card">
      <div class="q-head">
        <span class="q-no">ข้อ ${current + 1}</span>
        <span class="q-src">${escapeHtml(sourceName(problem.source))} ${problem.year} · ข้อ ${problem.number} · ${escapeHtml(problem.topics.map(topicName).join(', '))}</span>
      </div>
      <div class="q-text practice-question">${richText(problem.question)}</div>
      ${problem.image ? `<figure class="q-figure"><img src="${problem.image}" alt="ภาพประกอบข้อ ${current + 1}"></figure>` : ''}
      ${isChoice ? choiceListHtml(problem) : writtenHtml()}
      <div class="feedback" id="feedback" hidden></div>
    </article>
    <div class="practice-actions">
      <span class="muted practice-hint">${isChoice ? `กด 1–${problem.choices.length} เพื่อเลือก · ` : ''}Enter เพื่อ${isLast ? 'ตรวจ / ดูผล' : 'ตรวจ / ไปข้อถัดไป'}</span>
      <button type="button" class="btn btn-primary" id="action-btn" disabled>ตรวจคำตอบ</button>
    </div>`;

  renderMath(stage);
  renderProgress();

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
  actionBtn.addEventListener('click', () => (answered ? next() : check()));
}

function check() {
  const problem = questions[current];
  const isChoice = Array.isArray(problem.choices);
  let correct;
  let given;

  if (isChoice) {
    const selected = stage.querySelector('input[name="option"]:checked');
    if (!selected) return;
    given = selected.value;
    correct = given === String(problem.answer);
    stage.querySelectorAll('.option').forEach((option) => {
      const input = option.querySelector('input');
      input.disabled = true;
      if (input.value === String(problem.answer)) option.classList.add('is-correct');
      else if (input.checked) option.classList.add('is-wrong');
    });
  } else {
    const input = document.getElementById('written-input');
    given = input.value.trim();
    if (!given) return;
    correct = isWrittenCorrect(problem, given);
    input.disabled = true;
    input.classList.add(correct ? 'is-correct' : 'is-wrong');
  }

  answered = true;
  results[current] = correct;

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

  const actionBtn = document.getElementById('action-btn');
  actionBtn.textContent = current === questions.length - 1 ? 'ดูผลลัพธ์' : 'ข้อถัดไป';
  actionBtn.disabled = false;
  actionBtn.focus({ preventScroll: true });
  renderProgress();
}

function next() {
  current += 1;
  if (current >= questions.length) renderResult();
  else renderQuestion();
  progress.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function renderResult() {
  const score = results.filter(Boolean).length;
  const total = questions.length;
  const pct = Math.round((score / total) * 100);
  const message = pct === 100 ? 'ยอดเยี่ยม! ถูกทุกข้อ' : pct >= 60 ? 'ทำได้ดี! ทบทวนข้อที่พลาดอีกนิด' : 'สู้ต่อ! ลองทบทวนแล้วทำใหม่อีกครั้ง';

  const review = questions
    .map(
      (p, i) => `
      <li class="review-row ${results[i] ? 'is-correct' : 'is-wrong'}">
        <span class="review-mark">${icon(results[i] ? 'check' : 'close', 'icon-sm')}</span>
        <span class="review-text">
          <strong>ข้อ ${i + 1}</strong>
          <span class="muted">${escapeHtml(p.topics.map(topicName).join(', '))} · ${escapeHtml(sourceName(p.source))} ${p.year} ข้อ ${p.number}</span>
        </span>
      </li>`
    )
    .join('');

  stage.innerHTML = `
    <article class="practice-card result-card">
      <div class="score-ring" style="--pct:${pct}">
        <span><strong>${score}</strong>/${total}</span>
      </div>
      <h2>${message}</h2>
      <p class="muted">ตอบถูก ${score} จาก ${total} ข้อ (${pct}%)</p>
      <ul class="review-list">${review}</ul>
      <div class="result-actions">
        <button type="button" class="btn btn-primary" id="restart-btn">${icon('shuffle', 'icon-sm')} ทำชุดใหม่</button>
        <a class="btn btn-soft" href="subject.html?s=${subject.id}">กลับไปหน้าวิชา</a>
        <a class="btn btn-ghost-dark" href="create.html?s=${subject.id}">สร้างชุดข้อสอบ PDF</a>
      </div>
    </article>`;

  renderProgress();
  document.getElementById('restart-btn').addEventListener('click', start);
}

function start() {
  const count = Math.max(1, parseInt(new URLSearchParams(location.search).get('n'), 10) || DEFAULT_COUNT);
  questions = shuffle(allProblems).slice(0, count);
  results = new Array(questions.length).fill(null);
  current = 0;
  renderQuestion();
}

document.addEventListener('keydown', (event) => {
  if (!questions.length || current >= questions.length) return;
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

  start();
})();
