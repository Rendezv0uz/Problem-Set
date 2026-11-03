const DataStore = (() => {
  const BASE = 'data/';
  const cache = new Map();

  function load(path) {
    if (!cache.has(path)) {
      const request = fetch(BASE + path).then((res) => {
        if (!res.ok) throw new Error(`โหลดข้อมูล ${path} ไม่สำเร็จ (${res.status})`);
        return res.json();
      });
      request.catch(() => cache.delete(path));
      cache.set(path, request);
    }
    return cache.get(path);
  }

  async function getSources() {
    return (await load('subjects.json')).sources;
  }

  async function getSubjects() {
    return (await load('subjects.json')).subjects;
  }

  async function getSubject(id) {
    const subjects = await getSubjects();
    return subjects.find((s) => s.id === id) || null;
  }

  async function getUniversityData() {
    return load('universities.json');
  }

  async function getExams(subjectId) {
    const exams = await load('exams.json');
    return exams
      .filter((e) => e.subject === subjectId)
      .sort((a, b) => b.year - a.year);
  }

  async function getProblems(subjectId) {
    return load(`problems/${subjectId}.json`);
  }

  async function queryProblems({ subject, sources = [], topics = [], yearFrom = -Infinity, yearTo = Infinity }) {
    const problems = await getProblems(subject);
    return problems
      .filter((p) => sources.includes(p.source))
      .filter((p) => p.topics.some((t) => topics.includes(t)))
      .filter((p) => p.year >= yearFrom && p.year <= yearTo)
      .sort((a, b) => a.year - b.year || a.number - b.number);
  }

  return {
    getSources,
    getSubjects,
    getSubject,
    getUniversityData,
    getExams,
    getProblems,
    queryProblems,
  };
})();
