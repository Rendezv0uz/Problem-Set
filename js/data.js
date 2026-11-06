const DataStore = (() => {
  const BASE = 'data/';
  const cache = new Map();

  // A subject entry is a "test" (e.g. A-Level Math 1). Tests with a `group` share that
  // group's topic list (e.g. all math tests use the "math" topics), so topics are
  // categorized once per subject, not once per test.
  function normalizeSubjects(data) {
    const groups = data.groups || [];
    data.subjects.forEach((s) => {
      const group = groups.find((g) => g.id === s.group);
      if (group) {
        s.topics = group.topics;
        s.groupName = group.name;
      }
    });
    return data;
  }

  function load(path) {
    if (!cache.has(path)) {
      const request = fetch(BASE + path).then((res) => {
        if (!res.ok) throw new Error(`โหลดข้อมูล ${path} ไม่สำเร็จ (${res.status})`);
        return res.json();
      }).then((data) => (path === 'subjects.json' ? normalizeSubjects(data) : data));
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

  // Subjects as the user thinks of them: each has one topic list and one or more tests.
  // A test without an explicit group is its own subject with a single test.
  async function getGroups() {
    const data = await load('subjects.json');
    const explicit = (data.groups || []).map((g) => ({
      ...g,
      tests: data.subjects.filter((s) => s.group === g.id),
    }));
    const single = data.subjects
      .filter((s) => !s.group)
      .map((s) => ({ id: s.id, name: s.name, description: s.description, icon: s.icon, topics: s.topics, tests: [s] }));
    return [...explicit, ...single];
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
    getGroups,
    getSubject,
    getUniversityData,
    getExams,
    getProblems,
    queryProblems,
  };
})();
