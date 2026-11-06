const DREAM_KEY = 'problemweb.dream';
const SEGMENT_COLORS = ['#5b3fd1', '#2f5fd0', '#8b6cf0', '#1d86c4', '#b39cf7', '#3aa0d8', '#6f4fb8', '#7fb6e6'];

function renderSubjects(subjects) {
  const grid = document.getElementById('subject-grid');
  grid.innerHTML = subjects
    .map(
      (s) => `
      <a class="subject-card" href="subject.html?s=${s.id}">
        <span class="subject-icon">${icon(s.icon)}</span>
        <span class="subject-text">
          <strong>${escapeHtml(s.name)}</strong>
          <span>${escapeHtml(s.description)}</span>
          ${s.tests.length > 1 ? `<span class="subject-tests">${s.tests.map((t) => escapeHtml(t.name)).join(' · ')}</span>` : ''}
        </span>
        <span class="subject-arrow">${icon('chevronRight')}</span>
      </a>`
    )
    .join('');
}

function optionList(items, placeholder, selectedId) {
  return [`<option value="">${placeholder}</option>`]
    .concat(items.map((item) => `<option value="${item.id}" ${item.id === selectedId ? 'selected' : ''}>${escapeHtml(item.name)}</option>`))
    .join('');
}

function renderDream(data, subjectIds, uniId, facultyId) {
  const result = document.getElementById('dream-result');
  const uni = data.universities.find((u) => u.id === uniId);
  const faculty = uni?.faculties.find((f) => f.id === facultyId);

  if (!uni || !faculty) {
    result.innerHTML = `
      <div class="dream-empty">
        ${icon('university', 'icon-lg')}
        <p>${uni ? 'เลือกคณะ / สาขา เพื่อดูสัดส่วนคะแนน' : 'เลือกมหาวิทยาลัยในฝันของคุณ เพื่อดูสัดส่วนคะแนนที่ใช้ยื่น'}</p>
      </div>`;
    return;
  }

  const total = faculty.weights.reduce((sum, w) => sum + w.percent, 0);
  const segments = faculty.weights
    .map((w, i) => `<span class="stack-seg" style="width:${(w.percent / total) * 100}%;background:${SEGMENT_COLORS[i % SEGMENT_COLORS.length]}" title="${escapeHtml(data.exams[w.exam] || w.exam)} ${w.percent}%"></span>`)
    .join('');

  const rows = faculty.weights
    .map((w, i) => {
      const label = data.exams[w.exam] || w.exam;
      const practice = subjectIds.includes(w.exam)
        ? `<a class="weight-link" href="subject.html?s=${w.exam}">ฝึกทำ ${icon('chevronRight', 'icon-sm')}</a>`
        : '';
      return `
        <li class="weight-row">
          <span class="weight-dot" style="background:${SEGMENT_COLORS[i % SEGMENT_COLORS.length]}"></span>
          <span class="weight-name">${escapeHtml(label)}</span>
          ${practice}
          <span class="weight-pct">${w.percent}%</span>
        </li>`;
    })
    .join('');

  const badge = faculty.verified
    ? `<span class="badge badge-ok">${icon('check', 'icon-sm')} ตรวจสอบแล้ว</span>`
    : '<span class="badge badge-warn">ข้อมูลตัวอย่าง</span>';

  result.innerHTML = `
    <div class="dream-head">
      <div>
        <p class="dream-uni">${escapeHtml(uni.name)}</p>
        <h3>${escapeHtml(faculty.name)}</h3>
        <p class="muted">${escapeHtml(faculty.program)} · TCAS${String(faculty.year).slice(-2)}</p>
      </div>
      ${badge}
    </div>
    <div class="stack-bar" role="img" aria-label="สัดส่วนคะแนน">${segments}</div>
    <ul class="weight-list">${rows}</ul>
    <p class="dream-note">ที่มา: ${escapeHtml(faculty.source)}${total !== 100 ? ` · รวม ${total}%` : ''}</p>`;
}

async function initDream(subjects) {
  const uniSelect = document.getElementById('uni-select');
  const facultySelect = document.getElementById('faculty-select');
  const result = document.getElementById('dream-result');
  const subjectIds = subjects.flatMap((g) => g.tests).map((t) => t.id);

  let data;
  try {
    data = await DataStore.getUniversityData();
  } catch (error) {
    showError(result, error.message);
    return;
  }

  const saved = Store.get('localStorage', DREAM_KEY) || {};
  let uniId = data.universities.some((u) => u.id === saved.uni) ? saved.uni : '';
  let facultyId = saved.faculty || '';

  function fillFaculties() {
    const uni = data.universities.find((u) => u.id === uniId);
    if (!uni) {
      facultySelect.innerHTML = optionList([], 'เลือกมหาวิทยาลัยก่อน', '');
      facultySelect.disabled = true;
      facultyId = '';
      return;
    }
    if (!uni.faculties.some((f) => f.id === facultyId)) facultyId = '';
    facultySelect.innerHTML = optionList(uni.faculties, 'เลือกคณะ / สาขา', facultyId);
    facultySelect.disabled = false;
  }

  function update() {
    Store.set('localStorage', DREAM_KEY, { uni: uniId, faculty: facultyId });
    renderDream(data, subjectIds, uniId, facultyId);
  }

  uniSelect.innerHTML = optionList(data.universities, 'เลือกมหาวิทยาลัย', uniId);
  fillFaculties();
  renderDream(data, subjectIds, uniId, facultyId);

  uniSelect.addEventListener('change', () => {
    uniId = uniSelect.value;
    facultyId = '';
    fillFaculties();
    update();
  });

  facultySelect.addEventListener('change', () => {
    facultyId = facultySelect.value;
    update();
  });
}

(async () => {
  const subjects = await Layout.init('home');
  if (!subjects.length) {
    showError(document.getElementById('subject-grid'), 'โหลดรายชื่อวิชาไม่สำเร็จ');
    return;
  }
  renderSubjects(subjects);
  initDream(subjects);
})();
