const ICON_PATHS = {
  book: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5v13"/>',
  calculator: '<rect x="5" y="2.5" width="14" height="19" rx="2.5"/><rect x="8" y="5.5" width="8" height="4" rx="1"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01" stroke-width="2.4"/>',
  sigma: '<path d="M17.5 5H6.5l6 7-6 7h11"/>',
  atom: '<circle cx="12" cy="12" r="1.4"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(-60 12 12)"/>',
  flask: '<path d="M9 3h6M10 3v6.2L4.8 18.4A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.6L14 9.2V3"/><path d="M7.4 15h9.2"/>',
  dna: '<path d="M7 3c0 5 10 6 10 11 0 3-2 5-3.5 7M17 3c0 5-10 6-10 11 0 3 2 5 3.5 7"/><path d="M8.6 6.5h6.8M9.4 17.5h5.2M8 11.5h8"/>',
  language: '<path d="M3.5 5.5h9M8 3.5v2M5.5 5.5c.8 3 3 5.6 6 7M10.5 5.5c-.8 3.2-3.2 6.2-6.5 8"/><path d="M12.5 20.5l4-9 4 9M14 17.3h5"/>',
  chevronRight: '<path d="M9 5l7 7-7 7"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  shuffle: '<path d="M16 4h4v4M4 20L20 4M20 16v4h-4M15 15l5 5M4 4l5 5"/>',
  university: '<path d="M3 9.5L12 4l9 5.5"/><path d="M5 10.5v7.5M9.5 10.5v7.5M14.5 10.5v7.5M19 10.5v7.5M3 20.5h18"/>',
  sparkle: '<path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
};

function icon(name, className = '') {
  const paths = ICON_PATHS[name] || '';
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function richText(value) {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function renderMath(element) {
  if (typeof renderMathInElement !== 'function') return;
  renderMathInElement(element, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false },
    ],
    throwOnError: false,
  });
}

const Store = {
  get(area, key) {
    try {
      const raw = window[area].getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  set(area, key, value) {
    try {
      window[area].setItem(key, JSON.stringify(value));
    } catch {}
  },
  remove(area, key) {
    try {
      window[area].removeItem(key);
    } catch {}
  },
};

const Layout = (() => {
  const NAV = [
    { id: 'home', href: 'index.html', label: 'หน้าแรก' },
    { id: 'subject', label: 'วิชา', dropdown: true },
    { id: 'online', href: 'online.html', label: 'ฝึกทำออนไลน์' },
    { id: 'create', href: 'create.html', label: 'สร้างชุดข้อสอบ' },
    { id: 'about', href: 'about.html', label: 'เกี่ยวกับเรา' },
  ];

  function headerHtml(active, subjects) {
    const links = NAV.map((item) => {
      if (item.dropdown) {
        const items = subjects
          .map((s) => `<a class="dropdown-item" href="subject.html?s=${s.id}">${icon(s.icon)}<span>${escapeHtml(s.name)}</span></a>`)
          .join('');
        return `
          <div class="nav-dropdown">
            <button type="button" class="nav-link dropdown-toggle ${active === item.id ? 'is-active' : ''}" aria-expanded="false">
              ${item.label}${icon('chevronDown', 'icon-sm')}
            </button>
            <div class="dropdown-menu">${items}</div>
          </div>`;
      }
      return `<a class="nav-link ${active === item.id ? 'is-active' : ''}" href="${item.href}">${item.label}</a>`;
    }).join('');

    return `
      <div class="container nav-bar">
        <a class="brand" href="index.html">
          <span class="brand-mark">${icon('book')}</span>
          <span class="brand-name">คลังข้อสอบ</span>
        </a>
        <button type="button" class="nav-toggle" aria-label="เปิดเมนู" aria-expanded="false">${icon('menu')}</button>
        <nav class="nav" aria-label="เมนูหลัก">${links}</nav>
      </div>`;
  }

  function footerHtml() {
    const year = new Date().getFullYear() + 543;
    return `
      <div class="container footer-inner">
        <div class="footer-brand">
          <span class="brand-mark">${icon('book')}</span>
          <div>
            <strong>คลังข้อสอบ</strong>
            <p>รวมข้อสอบ A-Level แยกตามวิชาและปี สำหรับเตรียมสอบ TCAS</p>
          </div>
        </div>
        <nav class="footer-links" aria-label="ลิงก์ท้ายเว็บ">
          <a href="index.html">หน้าแรก</a>
          <a href="online.html">ฝึกทำออนไลน์</a>
          <a href="create.html">สร้างชุดข้อสอบ</a>
          <a href="about.html">เกี่ยวกับเรา</a>
        </nav>
        <p class="footer-copy">© ${year} คลังข้อสอบ · ลิขสิทธิ์ข้อสอบเป็นของหน่วยงานผู้จัดสอบ</p>
      </div>`;
  }

  function bindHeader(header) {
    const toggle = header.querySelector('.nav-toggle');
    const nav = header.querySelector('.nav');
    const dropdown = header.querySelector('.nav-dropdown');
    const dropdownToggle = header.querySelector('.dropdown-toggle');

    toggle.addEventListener('click', () => {
      const open = header.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'ปิดเมนู' : 'เปิดเมนู');
      toggle.innerHTML = icon(open ? 'close' : 'menu');
    });

    dropdownToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = dropdown.classList.toggle('is-open');
      dropdownToggle.setAttribute('aria-expanded', String(open));
    });

    document.addEventListener('click', (event) => {
      if (!dropdown.contains(event.target)) {
        dropdown.classList.remove('is-open');
        dropdownToggle.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        dropdown.classList.remove('is-open');
        dropdownToggle.setAttribute('aria-expanded', 'false');
      }
    });

    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) header.classList.remove('nav-open');
    });
  }

  async function init(active) {
    const header = document.getElementById('site-header');
    const footer = document.getElementById('site-footer');
    let subjects = [];
    try {
      // "subjects" here are subject groups (e.g. Math), each containing its tests.
      subjects = await DataStore.getGroups();
    } catch (error) {
      console.error(error);
    }
    header.innerHTML = headerHtml(active, subjects);
    footer.innerHTML = footerHtml();
    bindHeader(header);
    return subjects;
  }

  return { init };
})();

function showError(container, message) {
  container.innerHTML = `
    <div class="empty-state">
      <p><strong>เกิดข้อผิดพลาด</strong></p>
      <p>${escapeHtml(message)}</p>
      <p class="muted">ถ้าเปิดไฟล์จากเครื่องโดยตรง ให้เปิดผ่าน Live Server หรือเว็บเซิร์ฟเวอร์แทน</p>
    </div>`;
}
