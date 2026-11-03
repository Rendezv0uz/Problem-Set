function renderSubjectTabs(subjects, activeId) {
  document.getElementById('subject-tabs').innerHTML = subjects
    .map((s) => `<a class="tab ${s.id === activeId ? 'is-active' : ''}" href="subject.html?s=${s.id}" ${s.id === activeId ? 'aria-current="page"' : ''}>${escapeHtml(s.name)}</a>`)
    .join('');
}

function examRow(exam, subject, sourceName) {
  const title = `${sourceName} ${subject.name} ปี ${exam.year}`;
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
  const subjects = await Layout.init('subject');
  const list = document.getElementById('exam-list');
  const params = new URLSearchParams(location.search);
  const subject = subjects.find((s) => s.id === params.get('s'));

  renderSubjectTabs(subjects, subject?.id);

  if (!subject) {
    document.getElementById('subject-name').textContent = 'ไม่พบวิชานี้';
    document.getElementById('crumb-name').textContent = 'ไม่พบวิชา';
    list.innerHTML = '<li class="empty-state"><p>ไม่พบวิชาที่เลือก ลองเลือกวิชาจากแถบด้านบน</p></li>';
    document.getElementById('create-link').hidden = true;
    return;
  }

  document.title = `${subject.name} | คลังข้อสอบ`;
  document.getElementById('subject-name').textContent = subject.name;
  document.getElementById('subject-desc').textContent = subject.description;
  document.getElementById('crumb-name').textContent = subject.name;
  document.getElementById('subject-icon').innerHTML = icon(subject.icon);
  document.getElementById('create-link').href = `create.html?s=${subject.id}`;

  try {
    const [exams, sources] = await Promise.all([DataStore.getExams(subject.id), DataStore.getSources()]);
    const sourceName = (id) => sources.find((s) => s.id === id)?.name || id;
    list.innerHTML = exams.length
      ? exams.map((exam) => examRow(exam, subject, sourceName(exam.source))).join('')
      : '<li class="empty-state"><p>ยังไม่มีข้อสอบฉบับเต็มสำหรับวิชานี้</p></li>';
  } catch (error) {
    showError(list, error.message);
  }
})();
