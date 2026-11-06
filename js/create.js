const BUILDER_KEY = 'problemweb.builder.v2';

const els = {
  testField: document.getElementById('test-field'),
  tests: document.getElementById('test-group'),
  subject: document.getElementById('subject-select'),
  topics: document.getElementById('topic-group'),
  topicAll: document.getElementById('topic-all'),
  yearFrom: document.getElementById('year-from'),
  yearTo: document.getElementById('year-to'),
  limitToggle: document.getElementById('limit-toggle'),
  limitRow: document.getElementById('limit-row'),
  limitInput: document.getElementById('limit-input'),
  limitMax: document.getElementById('limit-max'),
  reshuffle: document.getElementById('reshuffle'),
  title: document.getElementById('set-title'),
  count: document.getElementById('match-count'),
  preview: document.getElementById('preview-list'),
  download: document.getElementById('download-btn'),
};

// "subjects" are subject groups (e.g. Math); each has shared topics and one or more tests.
let subjects = [];
let sources = [];
let problems = []; // problems of every test in the current subject
let currentSubject = null;
let selection = [];
let state = {};

function newSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function byYearAndNumber(a, b) {
  return a.year - b.year || a.number - b.number;
}

function pickRandom(list, count, seed) {
  const rand = mulberry32(seed);
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count).sort(byYearAndNumber);
}

function sourceName(id) {
  return sources.find((s) => s.id === id)?.name || id;
}

function testName(id) {
  return currentSubject?.tests.find((t) => t.id === id)?.name || id;
}

// Subjects with several tests label a question by its test; otherwise by its source.
function originName(problem) {
  return currentSubject.tests.length > 1 ? testName(problem.subject) : sourceName(problem.source);
}

function topicName(id) {
  return currentSubject?.topics.find((t) => t.id === id)?.name || id;
}

function availableYears() {
  return [...new Set(problems.map((p) => p.year))].sort((a, b) => a - b);
}

function saveState() {
  Store.set('sessionStorage', BUILDER_KEY, state);
}

function chip(name, value, label, checked, count) {
  return `
    <label class="chip ${count === 0 ? 'is-empty' : ''}">
      <input type="checkbox" name="${name}" value="${value}" ${checked ? 'checked' : ''}>
      <span>${escapeHtml(label)}${count === undefined ? '' : `<small>${count}</small>`}</span>
    </label>`;
}

function renderTests() {
  const tests = currentSubject.tests;
  els.testField.hidden = tests.length < 2;
  els.tests.innerHTML = tests
    .map((t) => chip('test', t.id, t.name, state.tests.includes(t.id), problems.filter((p) => p.subject === t.id).length))
    .join('');
}

function renderSubjectSelect() {
  els.subject.innerHTML = subjects
    .map((s) => `<option value="${s.id}" ${s.id === state.subject ? 'selected' : ''}>${escapeHtml(s.name)}</option>`)
    .join('');
}

function renderYears() {
  const years = availableYears();
  const options = (selected) => years.map((y) => `<option value="${y}" ${y === selected ? 'selected' : ''}>${y}</option>`).join('');
  els.yearFrom.innerHTML = options(state.yearFrom);
  els.yearTo.innerHTML = options(state.yearTo);
}

function renderTopics() {
  const inScope = problems.filter(
    (p) => state.tests.includes(p.subject) && p.year >= state.yearFrom && p.year <= state.yearTo
  );
  els.topics.innerHTML = currentSubject.topics
    .map((t) => chip('topic', t.id, t.name, state.topics.includes(t.id), inScope.filter((p) => p.topics.includes(t.id)).length))
    .join('');
  const allChecked = currentSubject.topics.every((t) => state.topics.includes(t.id));
  els.topicAll.textContent = allChecked ? 'ล้างทั้งหมด' : 'เลือกทั้งหมด';
}

function problemHtml(problem, index) {
  const topics = problem.topics.map(topicName).join(', ');
  const figure = problem.image
    ? `<figure class="q-figure"><img src="${problem.image}" alt="ภาพประกอบข้อ ${index}"></figure>`
    : '';
  const body = Array.isArray(problem.choices)
    ? `<ol class="q-choices">${problem.choices
        .map((c, k) => `<li><span class="q-choice-no">(${k + 1})</span><span>${richText(c)}</span></li>`)
        .join('')}</ol>`
    : '<div class="q-written">ตอบ <span class="q-line"></span></div>';

  return `
    <article class="q-item">
      <div class="q-head">
        <span class="q-no">${index}.</span>
        <span class="q-src">${escapeHtml(originName(problem))} ${problem.year} · ข้อ ${problem.number} · ${escapeHtml(topics)}</span>
      </div>
      <div class="q-text">${richText(problem.question)}</div>
      ${figure}
      ${body}
    </article>`;
}

function answerText(problem) {
  return Array.isArray(problem.choices) ? `(${escapeHtml(problem.answer)})` : richText(problem.answer);
}

function renderPreview(matchCount) {
  const n = selection.length;
  if (!state.tests.length || !state.topics.length) {
    els.count.textContent = !state.tests.length ? 'เลือกข้อสอบอย่างน้อย 1 สนาม' : 'เลือกหัวข้ออย่างน้อย 1 หัวข้อ';
  } else if (state.limitOn && matchCount > 0) {
    els.count.textContent = `สุ่มเลือก ${n} ข้อ จากทั้งหมด ${matchCount} ข้อที่ตรงเงื่อนไข`;
  } else {
    els.count.textContent = `พบ ${matchCount} ข้อที่ตรงเงื่อนไข`;
  }

  els.download.disabled = n === 0;

  if (!n) {
    els.preview.innerHTML = `
      <div class="empty-state">
        ${icon('layers', 'icon-lg')}
        <p>ยังไม่มีข้อสอบที่ตรงกับตัวกรอง ลองเพิ่มหัวข้อหรือขยายช่วงปี</p>
      </div>`;
    return;
  }

  els.preview.innerHTML = selection.map((p, i) => problemHtml(p, i + 1)).join('');
  renderMath(els.preview);
}

async function update() {
  if (state.yearFrom > state.yearTo) [state.yearFrom, state.yearTo] = [state.yearTo, state.yearFrom];
  renderYears();
  renderTests();
  renderTopics();

  const matches = problems
    .filter((p) => state.tests.includes(p.subject))
    .filter((p) => p.topics.some((t) => state.topics.includes(t)))
    .filter((p) => p.year >= state.yearFrom && p.year <= state.yearTo)
    .sort(byYearAndNumber);

  els.limitRow.hidden = !state.limitOn;
  els.limitToggle.checked = state.limitOn;
  els.limitInput.max = Math.max(matches.length, 1);
  els.limitMax.textContent = `จาก ${matches.length} ข้อ`;

  if (state.limitOn) {
    const count = Math.min(Math.max(parseInt(state.limit, 10) || 1, 1), matches.length);
    if (document.activeElement !== els.limitInput) els.limitInput.value = state.limit;
    selection = pickRandom(matches, count, state.seed);
  } else {
    selection = matches;
  }

  renderPreview(matches.length);
  saveState();
}

async function loadSubject(subjectId, keepFilters, presetTests) {
  currentSubject = subjects.find((s) => s.id === subjectId) || subjects[0];
  state.subject = currentSubject.id;
  const testIds = currentSubject.tests.map((t) => t.id);
  try {
    problems = (await Promise.all(testIds.map((id) => DataStore.getProblems(id)))).flat();
  } catch (error) {
    problems = [];
    showError(els.preview, error.message);
  }

  const years = availableYears();
  const minYear = years[0] ?? 0;
  const maxYear = years[years.length - 1] ?? 0;
  const topicIds = currentSubject.topics.map((t) => t.id);

  if (!keepFilters || !Array.isArray(state.tests) || !state.tests.length) {
    state.tests = presetTests && presetTests.length ? presetTests : [...testIds];
  } else {
    state.tests = state.tests.filter((id) => testIds.includes(id));
  }

  if (!keepFilters) {
    state.topics = [...topicIds];
    state.yearFrom = minYear;
    state.yearTo = maxYear;
  } else {
    state.topics = (state.topics || []).filter((t) => topicIds.includes(t));
    if (!years.includes(state.yearFrom)) state.yearFrom = minYear;
    if (!years.includes(state.yearTo)) state.yearTo = maxYear;
  }
}

function buildSheet() {
  const sheet = document.createElement('div');
  sheet.className = 'pdf-sheet';
  const title = state.title.trim() || `ชุดข้อสอบ ${currentSubject.name}`;
  const allTopics = currentSubject.topics.every((t) => state.topics.includes(t.id));
  const topicLabel = allTopics ? 'ทุกหัวข้อ' : state.topics.map(topicName).join(', ');
  const sourceLabel =
    currentSubject.tests.length > 1
      ? state.tests.map(testName).join(', ')
      : [...new Set(selection.map((p) => sourceName(p.source)))].join(', ');

  const answers = selection
    .map((p, i) => `<div class="pdf-answer"><b>${i + 1}.</b> <span>${answerText(p)}</span></div>`)
    .join('');

  sheet.innerHTML = `
    <header class="pdf-head">
      <p class="pdf-brand">คลังข้อสอบ</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="pdf-meta">${escapeHtml(sourceLabel)} · ${escapeHtml(currentSubject.name)} · ปี ${state.yearFrom}–${state.yearTo} · ${selection.length} ข้อ</p>
      <p class="pdf-meta">หัวข้อ: ${escapeHtml(topicLabel)}</p>
    </header>
    <div class="pdf-questions">${selection.map((p, i) => problemHtml(p, i + 1)).join('')}</div>
    <section class="pdf-answers">
      <h2>เฉลย</h2>
      <p class="pdf-meta">${escapeHtml(title)}</p>
      <div class="pdf-answer-grid">${answers}</div>
    </section>`;

  renderMath(sheet);
  return sheet;
}

function freezeMathSvgs(sheet) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;';
  host.appendChild(sheet);
  document.body.appendChild(host);
  sheet.querySelectorAll('.katex svg').forEach((svg) => {
    const width = svg.parentElement.getBoundingClientRect().width;
    const height = svg.getBoundingClientRect().height;
    if (!width || !height) return;
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.style.width = `${width}px`;
    svg.style.height = `${height}px`;
  });
  host.remove();
  sheet.remove();
}

function waitForImages(root) {
  const images = [...root.querySelectorAll('img')];
  return Promise.all(images.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())));
}

async function downloadPdf() {
  if (!selection.length) return;
  if (typeof html2pdf !== 'function') {
    alert('ไม่สามารถโหลดตัวสร้าง PDF ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
    return;
  }

  const label = els.download.innerHTML;
  els.download.disabled = true;
  els.download.innerHTML = '<span class="spinner"></span> กำลังสร้าง PDF…';
  document.body.classList.add('is-exporting');

  try {
    const sheet = buildSheet();
    await document.fonts.ready;
    await waitForImages(sheet);
    freezeMathSvgs(sheet);

    const filename = `problemset-${currentSubject.id}-${state.yearFrom}-${state.yearTo}.pdf`;
    const options = {
      margin: [12, 12, 14, 12],
      filename,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], before: '.pdf-answers', avoid: ['.q-item', '.pdf-head', '.pdf-answer'] },
    };

    await html2pdf()
      .set(options)
      .from(sheet)
      .toPdf()
      .get('pdf')
      .then((pdf) => {
        const total = pdf.internal.getNumberOfPages();
        const width = pdf.internal.pageSize.getWidth();
        const height = pdf.internal.pageSize.getHeight();
        for (let i = 1; i <= total; i += 1) {
          pdf.setPage(i);
          pdf.setFontSize(9);
          pdf.setTextColor(140);
          pdf.text(`${i} / ${total}`, width / 2, height - 6, { align: 'center' });
        }
      })
      .save(filename);
  } catch (error) {
    console.error(error);
    alert('สร้าง PDF ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
  } finally {
    document.body.classList.remove('is-exporting');
    els.download.innerHTML = label;
    els.download.disabled = selection.length === 0;
  }
}

function checkedValues(container) {
  return [...container.querySelectorAll('input:checked')].map((input) => input.value);
}

function bindEvents() {
  els.tests.addEventListener('change', () => {
    state.tests = checkedValues(els.tests);
    update();
  });

  els.subject.addEventListener('change', async () => {
    await loadSubject(els.subject.value, false);
    state.seed = newSeed();
    update();
  });

  els.topics.addEventListener('change', () => {
    state.topics = checkedValues(els.topics);
    update();
  });

  els.topicAll.addEventListener('click', () => {
    const ids = currentSubject.topics.map((t) => t.id);
    state.topics = ids.every((id) => state.topics.includes(id)) ? [] : ids;
    update();
  });

  els.yearFrom.addEventListener('change', () => {
    state.yearFrom = Number(els.yearFrom.value);
    update();
  });

  els.yearTo.addEventListener('change', () => {
    state.yearTo = Number(els.yearTo.value);
    update();
  });

  els.limitToggle.addEventListener('change', () => {
    state.limitOn = els.limitToggle.checked;
    if (state.limitOn) state.seed = newSeed();
    update();
  });

  els.limitInput.addEventListener('input', () => {
    const value = parseInt(els.limitInput.value, 10);
    if (Number.isNaN(value) || value < 1) return;
    state.limit = value;
    update();
  });

  els.limitInput.addEventListener('blur', () => {
    els.limitInput.value = Math.min(state.limit, Number(els.limitInput.max));
  });

  els.reshuffle.addEventListener('click', () => {
    state.seed = newSeed();
    update();
  });

  els.title.addEventListener('input', () => {
    state.title = els.title.value;
    saveState();
  });

  els.download.addEventListener('click', downloadPdf);
}

(async () => {
  subjects = await Layout.init('create');
  if (!subjects.length) {
    showError(els.preview, 'โหลดรายชื่อวิชาไม่สำเร็จ');
    return;
  }

  try {
    sources = await DataStore.getSources();
  } catch (error) {
    showError(els.preview, error.message);
    return;
  }

  const saved = Store.get('sessionStorage', BUILDER_KEY) || {};
  const urlParam = new URLSearchParams(location.search).get('s');
  // ?s= can be a subject (math) or one of its tests (math1).
  const urlGroup = subjects.find((s) => s.id === urlParam) || subjects.find((s) => s.tests.some((t) => t.id === urlParam));
  const subjectId = urlGroup ? urlGroup.id : saved.subject;
  const keepFilters = Boolean(saved.subject) && saved.subject === subjectId && !urlGroup;
  const presetTests = urlGroup && urlGroup.id !== urlParam && urlGroup.tests.length > 1 ? [urlParam] : null;

  state = {
    subject: subjectId,
    tests: Array.isArray(saved.tests) ? saved.tests : [],
    topics: saved.topics || [],
    yearFrom: saved.yearFrom,
    yearTo: saved.yearTo,
    limitOn: Boolean(saved.limitOn),
    limit: saved.limit || 10,
    seed: saved.seed || newSeed(),
    title: saved.title || '',
  };

  await loadSubject(subjectId, keepFilters, presetTests);
  renderSubjectSelect();
  els.title.value = state.title;
  els.limitInput.value = state.limit;
  bindEvents();
  update();
})();
