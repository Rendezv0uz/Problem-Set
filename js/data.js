const DataStore = (() => {
  const BASE = 'data/';
  const cache = new Map();

  // A subject entry is a "test" (e.g. A-Level Math 1). Tests with a `group` share that
  // group's topic list (e.g. all math tests use the "math" topics), so topics are
  // categorized once per subject, not once per test.
  //
  // `group` can name an entry in "groups" (like math), or a plain subject (like physics):
  // a new test with "group": "physics" joins the ฟิสิกส์ page and uses its topics.
  // A test whose group matches nothing is shown as its own subject instead of vanishing.
  function findParent(data, test) {
    if (!test.group) return null;
    const group = (data.groups || []).find((g) => g.id === test.group);
    if (group) return group;
    return data.subjects.find((s) => s.id === test.group && !s.group && s !== test) || null;
  }

  function normalizeSubjects(data) {
    data.subjects.forEach((s) => {
      const parent = findParent(data, s);
      if (parent) {
        s.topics = s.topics || parent.topics;
        s.groupName = parent.name;
      } else if (s.group) {
        console.warn(`subjects.json: "${s.id}" has group "${s.group}", which doesn't exist`);
      }
      s.topics = s.topics || [];
    });
    (data.groups || []).forEach((g) => {
      g.topics = g.topics || [];
    });
    return data;
  }

  function load(path) {
    if (!cache.has(path)) {
      const request = fetch(BASE + path).then((res) => {
        if (!res.ok) {
          const error = new Error(`โหลดข้อมูล ${path} ไม่สำเร็จ (${res.status})`);
          error.status = res.status;
          throw error;
        }
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
    // Every other test that has no parent is a subject of its own; tests that point
    // at it with `group` are listed after it.
    const single = data.subjects
      .filter((s) => !findParent(data, s))
      .map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        icon: s.icon,
        topics: s.topics,
        tests: [s, ...data.subjects.filter((o) => o.group === s.id && o !== s && findParent(data, o) === s)],
      }));
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

  // A test can be listed (with its PDFs) before its questions are typed in; a missing
  // problems file just means "no questions yet" rather than breaking the whole subject.
  async function getProblems(subjectId) {
    try {
      return await load(`problems/${subjectId}.json`);
    } catch (error) {
      if (error.status === 404) return [];
      throw error;
    }
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
