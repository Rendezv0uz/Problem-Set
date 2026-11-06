function renderSubjectTabs(groups, activeId) {
  document.getElementById('subject-tabs').innerHTML = groups
    .map((g) => `<a class="tab ${g.id === activeId ? 'is-active' : ''}" href="subject.html?s=${g.id}" ${g.id === activeId ? 'aria-current="page"' : ''}>${escapeHtml(g.name)}</a>`)
    .join('');
}

function examRow(exam, test, sourceName) {
  const title = `${sourceName} ${test.name} ปี ${exam.year}`;
  const actions = exam.file
    ? `
      <a class="btn btn-soft btn-sm" href="${exam.file}" target="_blank" rel="noopener">${icon('external', 'icon-sm')} เปิดดู</a>
      <a class="btn btn-primary btn-sm" href="${exam.file}" download>${icon('download', 'icon-sm')} ดาวน์โหลด</a>
      ${exam.answerFile ? `<a class="btn btn-ghost-dark btn-sm" href="${exam.answerFile}" target="_blank" rel="noopener">เฉลย</a>` : ''}`
    : '<span class="badge badge-muted">ยังไม่มีไฟล์</span>';

  return `
    <li class="exam-row">
      <span class="exam-year">${exam.year}</span>
      <span class="exam-info">
        <strong>${escapeHtml(title)}</strong>
        <span class="muted">${icon('file', 'icon-sm')} ${exam.questions ? `${exam.questions} ข้อ` : 'ไม่ระบุจำนวนข้อ'}</span>
      </span>
      <span class="exam-actions">${actions}</span>
    </li>`;
}

(async () => {
  const groups = await Layout.init('subject');
  const list = document.getElementById('exam-list');
  const param = new URLSearchParams(location.search).get('s');
  // ?s= can be a subject (math) or one of its tests (math1); both open the subject page.
  const group = groups.find((g) => g.id === param) || groups.find((g) => g.tests.some((t) => t.id === param));

  renderSubjectTabs(groups, group?.id);

  if (!group) {
    document.getElementById('subject-name').textContent = 'ไม่พบวิชานี้';
    document.getElementById('crumb-name').textContent = 'ไม่พบวิชา';
    list.innerHTML = '<li class="empty-state"><p>ไม่พบวิชาที่เลือก ลองเลือกวิชาจากแถบด้านบน</p></li>';
    document.getElementById('create-link').hidden = true;
    document.getElementById('practice-link').hidden = true;
    return;
  }

  document.title = `${group.name} | คลังข้อสอบ`;
  document.getElementById('subject-name').textContent = group.name;
  document.getElementById('subject-desc').textContent = group.description;
  document.getElementById('crumb-name').textContent = group.name;
  document.getElementById('subject-icon').innerHTML = icon(group.icon);
  document.getElementById('create-link').href = `create.html?s=${group.id}`;
  document.getElementById('practice-link').href = `online.html?s=${group.id}`;

  try {
    const [sources, examsPerTest] = await Promise.all([
      DataStore.getSources(),
      Promise.all(group.tests.map((t) => DataStore.getExams(t.id))),
    ]);
    const sourceName = (id) => sources.find((s) => s.id === id)?.name || id;
    const showTitles = group.tests.length > 1;

    const html = group.tests
      .map((test, i) => {
        const exams = examsPerTest[i];
        const rows = exams.length
          ? exams.map((exam) => examRow(exam, test, sourceName(exam.source))).join('')
          : '<li class="empty-state"><p>ยังไม่มีข้อสอบฉบับเต็มสำหรับข้อสอบนี้</p></li>';
        const title = showTitles
          ? `<li class="exam-group-title"><h3>${escapeHtml(test.name)}</h3><span class="muted">${escapeHtml(test.description || '')}</span></li>`
          : '';
        return title + rows;
      })
      .join('');
    list.innerHTML = html;
  } catch (error) {
    showError(list, error.message);
  }
})();
