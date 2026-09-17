// ==========================================
// 1. 基本設定
// ==========================================

const config = {
  pxPerYearBase: 4,

  rowHeight: 44,

  categoryColors: {
    政治: "#1E88E5",
    "武将・軍事": "#43A047",
    "改革・維新": "#FB8C00",
    "文化・文学・宗教": "#8E24AA",
    "経済・産業・技術": "#E53935",
    天皇: "#D4AF37",
    その他: "#757575",
  },

  tagColors: [
    "#e91e63",
    "#9c27b0",
    "#673ab7",
    "#3f51b5",
    "#2196f3",
    "#00bcd4",
    "#009688",
    "#4caf50",
    "#ffeb3b",
    "#ffc107",
    "#ff9800",
    "#795548",
  ],

  eras: [
    {
      name: "飛鳥",
      start: 592,
      end: 710,
      color: "rgba(233,236,239,0.34)",
    },
    {
      name: "奈良",
      start: 710,
      end: 794,
      color: "rgba(216,191,216,0.22)",
    },
    {
      name: "平安",
      start: 794,
      end: 1185,
      color: "rgba(255,182,193,0.18)",
    },
    {
      name: "鎌倉",
      start: 1185,
      end: 1333,
      color: "rgba(173,216,230,0.18)",
    },
    {
      name: "室町",
      start: 1333,
      end: 1573,
      color: "rgba(152,251,152,0.18)",
    },
    {
      name: "安土桃山",
      start: 1573,
      end: 1603,
      color: "rgba(255,215,0,0.14)",
    },
    {
      name: "江戸",
      start: 1603,
      end: 1868,
      color: "rgba(244,221,129,0.20)",
    },
    {
      name: "明治",
      start: 1868,
      end: 1912,
      color: "rgba(135,206,235,0.18)",
    },
    {
      name: "大正",
      start: 1912,
      end: 1926,
      color: "rgba(255,250,205,0.24)",
    },
    {
      name: "昭和",
      start: 1926,
      end: 1989,
      color: "rgba(220,220,220,0.25)",
    },
    {
      name: "平成",
      start: 1989,
      end: 2019,
      color: "rgba(224,255,255,0.22)",
    },
    {
      name: "令和",
      start: 2019,
      end: 2050,
      color: "rgba(255,228,225,0.24)",
    },
  ],
};

// ==========================================
// 2. データ
// ==========================================

let people = JSON.parse(localStorage.getItem("peopleData")) || [];

let tagNames = JSON.parse(localStorage.getItem("tagNamesData")) || {};

// ==========================================
// 3. 状態
// ==========================================

const state = {
  // 現在表示している画面
  activeView: "timeline",

  // 2ビュー共通の「現在見ている年代」
  currentYear: new Date().getFullYear(),

  // 各ビュー固有のスクロール位置
  timelineScrollLeft: 0,

  peopleScrollTop: 0,

  // 編集
  editingId: null,

  detailPersonId: null,

  // 年表
  zoomScale: 1,

  // フィルター
  searchQuery: "",

  categoryVisibility: {},

  tagVisibility: {
    none: true,
  },

  selectedTagColor: "",
};

// ==========================================
// 4. 内部制御用
// ==========================================

let timelineMeta = {
  minYear: 500,

  maxYear: new Date().getFullYear(),

  pxPerYear: config.pxPerYearBase,

  totalWidth: 0,
};

let timelineScrollFrame = null;

let peopleScrollFrame = null;

/*
 * プログラム側でスクロールした時、
 * そのスクロールイベントによって
 * currentYear が別の値に書き換わるのを防ぐ
 */
let suppressTimelineYearUpdate = false;

let suppressPeopleYearUpdate = false;

// ==========================================
// 5. ID整備
// ==========================================

function ensureIds() {
  let changed = false;

  let maxId = people.reduce((max, person) => Math.max(max, person.id || 0), 0);

  people.forEach((person) => {
    if (!person.id) {
      maxId += 1;

      person.id = maxId;

      changed = true;
    }
  });

  if (changed) {
    saveToStorage();
  }
}

// ==========================================
// 6. 保存
// ==========================================

function saveToStorage() {
  localStorage.setItem("peopleData", JSON.stringify(people));

  localStorage.setItem("tagNamesData", JSON.stringify(tagNames));
}

// ==========================================
// 7. 年表示
// ==========================================

function formatYear(year) {
  if (year < 0) {
    return `BC${Math.abs(year)}`;
  }

  return `${Math.round(year)}`;
}

function formatYearWithSuffix(year) {
  if (year < 0) {
    return `BC${Math.abs(year)}`;
  }

  return `${Math.round(year)}年`;
}

function getDeathYear(person) {
  return person.death || new Date().getFullYear();
}

function getPeriodText(person) {
  const birth = formatYear(person.birth);

  const death = person.death ? formatYear(person.death) : "現在";

  return `${birth} – ${death}`;
}

function getPersonById(id) {
  return people.find((person) => person.id === id);
}

// ==========================================
// 8. 表示人物
// ==========================================

function getVisiblePeople() {
  return people.filter((person) => {
    const name = String(person.name || "").toLowerCase();

    const query = String(state.searchQuery || "").toLowerCase();

    const matchSearch = name.includes(query);

    const matchCategory = state.categoryVisibility[person.category] !== false;

    const tagKey = person.tagColor || "none";

    const matchTag = state.tagVisibility[tagKey] !== false;

    return matchSearch && matchCategory && matchTag;
  });
}

// ==========================================
// 9. 年表全体の範囲
// ==========================================

function getTimelineBounds() {
  const currentYear = new Date().getFullYear();

  const personYears = people.flatMap((person) => [
    person.birth,
    person.death || currentYear,
  ]);

  const eraYears = config.eras.flatMap((era) => [era.start, era.end]);

  const allYears = [...personYears, ...eraYears];

  const minValue = allYears.length ? Math.min(...allYears) : 500;

  const maxValue = allYears.length ? Math.max(...allYears) : currentYear;

  const minYear = Math.floor(minValue / 50) * 50 - 50;

  const maxYear = Math.ceil(maxValue / 10) * 10 + 30;

  return {
    minYear,
    maxYear,
  };
}

// ==========================================
// 10. 年 → X
// ==========================================

function yearToX(year) {
  return (year - timelineMeta.minYear) * timelineMeta.pxPerYear;
}

// ==========================================
// 11. 目盛り間隔
// ==========================================

function getYearStep(pxPerYear) {
  const candidates = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000];

  const targetPixels = 75;

  for (const step of candidates) {
    if (step * pxPerYear >= targetPixels) {
      return step;
    }
  }

  return 1000;
}

// ==========================================
// 12. 年表中央の年代
// ==========================================

function getTimelineCenterYear() {
  const scroller = document.getElementById("timeline-scroll");

  if (!scroller || !timelineMeta.pxPerYear) {
    return state.currentYear;
  }

  const centerX = scroller.scrollLeft + scroller.clientWidth / 2;

  return timelineMeta.minYear + centerX / timelineMeta.pxPerYear;
}

// ==========================================
// 13. currentYear更新
// ==========================================

function setCurrentYear(year) {
  if (year === null || year === undefined || Number.isNaN(year)) {
    return;
  }

  state.currentYear = year;

  updateEraSummary();
}

// ==========================================
// 14. 時代表示
// ==========================================

function updateEraSummary() {
  const year = state.currentYear;

  const era = config.eras.find((item) => year >= item.start && year < item.end);

  const title = document.getElementById("era-title");

  const range = document.getElementById("era-range");

  if (era) {
    title.textContent = `${era.name}時代`;

    range.textContent = `${formatYear(era.start)} – ${formatYear(era.end)} ・ ${formatYearWithSuffix(year)}頃`;
  } else {
    title.textContent = `${formatYearWithSuffix(year)}頃`;

    range.textContent = "歴史年表";
  }
}

// ==========================================
// 15. 年表描画
// ==========================================

function renderTimeline() {
  const axis = document.getElementById("timeline-axis");

  const canvas = document.getElementById("timeline-canvas");

  const eraContainer = document.getElementById("era-background");

  const barsContainer = document.getElementById("timeline-bars");

  if (!axis || !canvas || !eraContainer || !barsContainer) {
    return;
  }

  axis.innerHTML = "";

  eraContainer.innerHTML = "";

  barsContainer.innerHTML = "";

  const bounds = getTimelineBounds();

  const pxPerYear = config.pxPerYearBase * state.zoomScale;

  const totalWidth = (bounds.maxYear - bounds.minYear) * pxPerYear;

  timelineMeta = {
    minYear: bounds.minYear,

    maxYear: bounds.maxYear,

    pxPerYear,

    totalWidth,
  };

  axis.style.width = `${totalWidth}px`;

  canvas.style.width = `${totalWidth}px`;

  // ==============================
  // 年代目盛り
  // ==============================

  const step = getYearStep(pxPerYear);

  const firstTick = Math.ceil(bounds.minYear / step) * step;

  for (let year = firstTick; year <= bounds.maxYear; year += step) {
    const label = document.createElement("div");

    label.className = "year-label";

    if (year % (step * 5) === 0) {
      label.classList.add("major");
    }

    label.style.left = `${yearToX(year)}px`;

    label.textContent = formatYearWithSuffix(year);

    axis.appendChild(label);
  }

  // ==============================
  // 人物
  // ==============================

  const visiblePeople = getVisiblePeople()
    .slice()
    .sort((a, b) => a.birth - b.birth);

  const rows = [];

  visiblePeople.forEach((person) => {
    const startX = yearToX(person.birth);

    const endYear = getDeathYear(person);

    const actualWidth = Math.max(2, (endYear - person.birth) * pxPerYear);

    const displayWidth = Math.max(62, actualWidth);

    let rowIndex = 0;

    while (rows[rowIndex] !== undefined && rows[rowIndex] > startX) {
      rowIndex += 1;
    }

    rows[rowIndex] = startX + displayWidth + 10;

    const bar = document.createElement("button");

    bar.type = "button";

    bar.className = "person-bar";

    bar.style.left = `${startX}px`;

    bar.style.top = `${rowIndex * config.rowHeight + 18}px`;

    bar.style.width = `${displayWidth}px`;

    bar.style.setProperty(
      "--category-color",
      config.categoryColors[person.category] || config.categoryColors["その他"],
    );

    const content = document.createElement("div");

    content.className = "person-bar-content";

    const name = document.createElement("div");

    name.className = "person-bar-name";

    name.textContent = person.name;

    content.appendChild(name);

    if (displayWidth >= 100) {
      const years = document.createElement("div");

      years.className = "person-bar-years";

      years.textContent = getPeriodText(person);

      content.appendChild(years);
    }

    bar.appendChild(content);

    if (person.tagColor) {
      const tagDot = document.createElement("span");

      tagDot.className = "person-tag-dot";

      tagDot.style.backgroundColor = person.tagColor;

      bar.appendChild(tagDot);
    }

    bar.addEventListener("click", () => {
      openPersonDetail(person);
    });

    bar.addEventListener("mouseenter", (event) => {
      showTooltip(event, person);
    });

    bar.addEventListener("mousemove", moveTooltip);

    bar.addEventListener("mouseleave", hideTooltip);

    barsContainer.appendChild(bar);
  });

  const contentHeight = Math.max(430, rows.length * config.rowHeight + 70);

  canvas.style.height = `${contentHeight}px`;

  eraContainer.style.height = `${contentHeight}px`;

  barsContainer.style.height = `${contentHeight}px`;

  // ==============================
  // 時代背景
  // ==============================

  config.eras.forEach((era) => {
    const start = Math.max(bounds.minYear, era.start);

    const end = Math.min(bounds.maxYear, era.end);

    if (start >= end) {
      return;
    }

    const region = document.createElement("div");

    region.className = "era-region";

    region.style.left = `${yearToX(start)}px`;

    region.style.width = `${(end - start) * pxPerYear}px`;

    region.style.backgroundColor = era.color;

    if ((end - start) * pxPerYear > 80) {
      const label = document.createElement("span");

      label.className = "era-region-label";

      label.textContent = era.name;

      region.appendChild(label);
    }

    eraContainer.appendChild(region);
  });

  // ==============================
  // 今日
  // ==============================

  const currentYear = new Date().getFullYear();

  if (currentYear >= bounds.minYear && currentYear <= bounds.maxYear) {
    const todayX = yearToX(currentYear);

    const line = document.createElement("div");

    line.className = "today-line";

    line.style.left = `${todayX}px`;

    eraContainer.appendChild(line);

    const label = document.createElement("div");

    label.className = "today-label";

    label.style.left = `${todayX}px`;

    label.textContent = "今日";

    eraContainer.appendChild(label);
  }
}

// ==========================================
// 16. 人物一覧描画
// ==========================================

function renderPeopleList() {
  const container = document.getElementById("people-list");

  container.innerHTML = "";

  const visiblePeople = getVisiblePeople()
    .slice()
    .sort((a, b) => a.birth - b.birth);

  if (visiblePeople.length === 0) {
    const empty = document.createElement("div");

    empty.className = "people-empty";

    empty.textContent = "条件に一致する人物がありません。";

    container.appendChild(empty);

    return;
  }

  visiblePeople.forEach((person) => {
    const button = document.createElement("button");

    button.type = "button";

    button.className = "person-list-card";

    button.id = `person-card-${person.id}`;

    button.dataset.personId = person.id;

    button.dataset.birth = person.birth;

    button.style.setProperty(
      "--category-color",
      config.categoryColors[person.category] || config.categoryColors["その他"],
    );

    const year = document.createElement("div");

    year.className = "person-list-year";

    year.textContent = formatYear(person.birth);

    const dot = document.createElement("div");

    dot.className = "person-list-dot";

    const content = document.createElement("div");

    content.className = "person-list-content";

    const name = document.createElement("div");

    name.className = "person-list-name";

    name.textContent = person.name;

    const period = document.createElement("div");

    period.className = "person-list-period";

    period.textContent = getPeriodText(person);

    const meta = document.createElement("div");

    meta.className = "person-list-meta";

    meta.appendChild(
      createMetaChip(person.category, config.categoryColors[person.category]),
    );

    if (person.tagColor) {
      const tagLabel = tagNames[person.tagColor] || "タグ";

      meta.appendChild(createMetaChip(tagLabel, person.tagColor));
    }

    content.appendChild(name);

    content.appendChild(period);

    content.appendChild(meta);

    button.appendChild(year);

    button.appendChild(dot);

    button.appendChild(content);

    button.addEventListener("click", () => {
      openPersonDetail(person);
    });

    container.appendChild(button);
  });
}

// ==========================================
// 17. メタ情報チップ
// ==========================================

function createMetaChip(label, color = null) {
  const chip = document.createElement("span");

  chip.className = "meta-chip";

  if (color) {
    const dot = document.createElement("span");

    dot.className = "meta-chip-dot";

    dot.style.backgroundColor = color;

    chip.appendChild(dot);
  }

  const text = document.createElement("span");

  text.textContent = label;

  chip.appendChild(text);

  return chip;
}

// ==========================================
// 18. 年表を指定年代へ移動
// ==========================================

function scrollTimelineToYear(year, smooth = false) {
  const scroller = document.getElementById("timeline-scroll");

  if (!scroller) {
    return;
  }

  const x = yearToX(year);

  const targetLeft = Math.max(0, x - scroller.clientWidth / 2);

  suppressTimelineYearUpdate = true;

  scroller.scrollTo({
    left: targetLeft,

    behavior: smooth ? "smooth" : "auto",
  });

  state.timelineScrollLeft = targetLeft;

  /*
   * autoスクロールで発生する
   * scrollイベントを無視した後、
   * 通常モードへ戻す
   */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      suppressTimelineYearUpdate = false;
    });
  });
}

// ==========================================
// 19. 年代に最適な人物を探す
// ==========================================

function findBestPersonForYear(year) {
  const visiblePeople = getVisiblePeople()
    .slice()
    .sort((a, b) => a.birth - b.birth);

  if (visiblePeople.length === 0) {
    return null;
  }

  /*
   * まず、その年代に生存していた人物を探す
   */
  const alivePeople = visiblePeople.filter((person) => {
    const death = getDeathYear(person);

    return person.birth <= year && death >= year;
  });

  if (alivePeople.length > 0) {
    /*
     * 生存者の中では、
     * その年代に最も近く生まれた人物
     */
    return alivePeople.reduce((best, person) => {
      const bestDiff = Math.abs(best.birth - year);

      const currentDiff = Math.abs(person.birth - year);

      return currentDiff < bestDiff ? person : best;
    });
  }

  /*
   * その年代に生存している人物がいない場合は
   * 生年が一番近い人物
   */
  return visiblePeople.reduce((best, person) => {
    const bestDiff = Math.abs(best.birth - year);

    const currentDiff = Math.abs(person.birth - year);

    return currentDiff < bestDiff ? person : best;
  });
}

// ==========================================
// 20. 人物ビューを指定年代へ移動
// ==========================================

function scrollPeopleToYear(year, smooth = false) {
  const scroller = document.getElementById("people-scroll");

  if (!scroller) {
    return;
  }

  const person = findBestPersonForYear(year);

  if (!person) {
    return;
  }

  const card = document.getElementById(`person-card-${person.id}`);

  if (!card) {
    return;
  }

  const scrollerRect = scroller.getBoundingClientRect();

  const cardRect = card.getBoundingClientRect();

  /*
   * 現在位置から必要な差分を計算し、
   * 対象人物が画面中央に来るようにする
   */
  const cardCenter =
    cardRect.top - scrollerRect.top + scroller.scrollTop + cardRect.height / 2;

  const targetTop = Math.max(0, cardCenter - scroller.clientHeight / 2);

  suppressPeopleYearUpdate = true;

  scroller.scrollTo({
    top: targetTop,

    behavior: smooth ? "smooth" : "auto",
  });

  state.peopleScrollTop = targetTop;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      suppressPeopleYearUpdate = false;
    });
  });
}

// ==========================================
// 21. 人物ビュー中央の人物から年代取得
// ==========================================

function getPeopleCenterYear() {
  const scroller = document.getElementById("people-scroll");

  if (!scroller) {
    return state.currentYear;
  }

  const cards = Array.from(document.querySelectorAll(".person-list-card"));

  if (cards.length === 0) {
    return state.currentYear;
  }

  const scrollerRect = scroller.getBoundingClientRect();

  const centerY = scrollerRect.top + scrollerRect.height / 2;

  let closestCard = null;

  let closestDistance = Infinity;

  cards.forEach((card) => {
    const rect = card.getBoundingClientRect();

    const cardCenter = rect.top + rect.height / 2;

    const distance = Math.abs(cardCenter - centerY);

    if (distance < closestDistance) {
      closestDistance = distance;

      closestCard = card;
    }
  });

  if (!closestCard) {
    return state.currentYear;
  }

  return parseFloat(closestCard.dataset.birth);
}

// ==========================================
// 22. 現ビューの状態を保存
// ==========================================

function captureCurrentViewState() {
  if (state.activeView === "timeline") {
    const scroller = document.getElementById("timeline-scroll");

    if (scroller) {
      state.timelineScrollLeft = scroller.scrollLeft;

      setCurrentYear(getTimelineCenterYear());
    }
  }

  if (state.activeView === "people") {
    const scroller = document.getElementById("people-scroll");

    if (scroller) {
      state.peopleScrollTop = scroller.scrollTop;

      setCurrentYear(getPeopleCenterYear());
    }
  }
}

// ==========================================
// 23. 年表 / 人物 切替
// ==========================================

function switchView(view) {
  if (view === state.activeView) {
    /*
     * 同じタブをもう一度押しても
     * スクロール位置は変えない
     */
    return;
  }

  /*
   * 切り替える直前に
   * 「今どの年代を見ていたか」を確定
   */
  captureCurrentViewState();

  const targetYear = state.currentYear;

  state.activeView = view;

  const timelineView = document.getElementById("timeline-view");

  const peopleView = document.getElementById("people-view");

  const timelineTab = document.getElementById("timeline-tab");

  const peopleTab = document.getElementById("people-tab");

  if (view === "timeline") {
    timelineView.classList.remove("hidden");

    peopleView.classList.add("hidden");

    timelineTab.classList.add("active");

    peopleTab.classList.remove("active");

    /*
     * 人物ビューで見ていた年代を
     * 年表の中央へ
     */
    requestAnimationFrame(() => {
      scrollTimelineToYear(targetYear, false);
    });
  } else {
    timelineView.classList.add("hidden");

    peopleView.classList.remove("hidden");

    timelineTab.classList.remove("active");

    peopleTab.classList.add("active");

    /*
     * 年表で見ていた年代を
     * 人物一覧へ同期
     */
    requestAnimationFrame(() => {
      scrollPeopleToYear(targetYear, false);
    });
  }

  updateEraSummary();
}

// ==========================================
// 24. 今日へ
// ==========================================

function scrollToToday() {
  const today = new Date().getFullYear();

  setCurrentYear(today);

  if (state.activeView !== "timeline") {
    state.activeView = "people";

    switchView("timeline");
  } else {
    scrollTimelineToYear(today, true);
  }

  closeSheets();
}

// ==========================================
// 25. Bottom Sheet
// ==========================================

function openSheet(id) {
  document.querySelectorAll(".bottom-sheet").forEach((sheet) => {
    sheet.classList.add("hidden");
  });

  document.getElementById("sheet-backdrop").classList.remove("hidden");

  const sheet = document.getElementById(id);

  sheet.classList.remove("hidden");

  sheet.scrollTop = 0;
}

function closeSheets() {
  document.querySelectorAll(".bottom-sheet").forEach((sheet) => {
    sheet.classList.add("hidden");
  });

  document.getElementById("sheet-backdrop").classList.add("hidden");

  hideTooltip();
}

// ==========================================
// 26. 人物詳細
// ==========================================

function openPersonDetail(person) {
  state.detailPersonId = person.id;

  document.getElementById("detail-name").textContent = person.name;

  document.getElementById("detail-years").textContent = getPeriodText(person);

  document.getElementById("detail-period-text").textContent =
    getPeriodText(person);

  const meta = document.getElementById("detail-meta");

  meta.innerHTML = "";

  meta.appendChild(
    createMetaChip(person.category, config.categoryColors[person.category]),
  );

  if (person.tagColor) {
    meta.appendChild(
      createMetaChip(tagNames[person.tagColor] || "タグ", person.tagColor),
    );
  }

  document.getElementById("detail-memo").textContent = person.memo
    ? person.memo
    : "メモはありません。";

  openSheet("person-detail-sheet");
}

// ==========================================
// 27. 人物フォーム
// ==========================================

function openPersonForm(person = null) {
  const form = document.getElementById("person-form");

  form.reset();

  if (person) {
    state.editingId = person.id;

    document.getElementById("person-form-title").textContent = "人物を編集";

    document.getElementById("person-form-status").textContent =
      "登録済みの人物を編集します";

    document.getElementById("person-name").value = person.name;

    document.getElementById("person-birth").value = person.birth;

    document.getElementById("person-death").value = person.death || "";

    document.getElementById("person-category").value = person.category;

    document.getElementById("person-memo").value = person.memo || "";

    state.selectedTagColor = person.tagColor || "";

    document.getElementById("delete-person-button").classList.remove("hidden");
  } else {
    state.editingId = null;

    state.selectedTagColor = "";

    document.getElementById("person-form-title").textContent = "人物を追加";

    document.getElementById("person-form-status").textContent =
      "年表に新しい人物を追加します";

    document.getElementById("delete-person-button").classList.add("hidden");
  }

  renderTagSelector();

  openSheet("person-form-sheet");
}

// ==========================================
// 28. 人物保存
// ==========================================

function savePerson(event) {
  event.preventDefault();

  const name = document.getElementById("person-name").value.trim();

  const birth = parseInt(document.getElementById("person-birth").value, 10);

  const deathInput = document.getElementById("person-death").value;

  const death = deathInput === "" ? 0 : parseInt(deathInput, 10);

  const category = document.getElementById("person-category").value;

  const memo = document.getElementById("person-memo").value.trim();

  if (!name || Number.isNaN(birth)) {
    return;
  }

  if (death && death < birth) {
    alert("没年が生年より前になっています。");

    return;
  }

  const data = {
    name,

    birth,

    death,

    category,

    tagColor: state.selectedTagColor,

    memo,
  };

  if (state.editingId !== null) {
    const index = people.findIndex((person) => person.id === state.editingId);

    if (index !== -1) {
      data.id = state.editingId;

      people[index] = data;
    }
  } else {
    const maxId = people.reduce(
      (max, person) => Math.max(max, person.id || 0),
      0,
    );

    data.id = maxId + 1;

    people.push(data);
  }

  saveToStorage();

  state.editingId = null;

  refreshAll();

  closeSheets();
}

// ==========================================
// 29. 人物削除
// ==========================================

function deleteCurrentPerson() {
  if (state.editingId === null) {
    return;
  }

  const person = getPersonById(state.editingId);

  if (!person) {
    return;
  }

  const confirmed = confirm(`「${person.name}」を削除しますか？`);

  if (!confirmed) {
    return;
  }

  people = people.filter((item) => item.id !== state.editingId);

  state.editingId = null;

  saveToStorage();

  refreshAll();

  closeSheets();
}

// ==========================================
// 30. タグ選択
// ==========================================

function renderTagSelector() {
  const container = document.getElementById("tag-color-selector");

  container.innerHTML = "";

  const none = document.createElement("button");

  none.type = "button";

  none.className = "tag-option no-tag";

  if (!state.selectedTagColor) {
    none.classList.add("selected");
  }

  none.addEventListener("click", () => {
    state.selectedTagColor = "";

    renderTagSelector();
  });

  container.appendChild(none);

  config.tagColors.forEach((color) => {
    const option = document.createElement("button");

    option.type = "button";

    option.className = "tag-option";

    option.style.backgroundColor = color;

    if (state.selectedTagColor === color) {
      option.classList.add("selected");
    }

    option.addEventListener("click", () => {
      state.selectedTagColor = color;

      renderTagSelector();
    });

    container.appendChild(option);
  });
}

// ==========================================
// 31. フィルター表示
// ==========================================

function renderFilterButtons() {
  const categoryContainer = document.getElementById("category-buttons");

  categoryContainer.innerHTML = "";

  Object.keys(config.categoryColors).forEach((category) => {
    const button = document.createElement("button");

    button.type = "button";

    button.className = "filter-chip";

    if (state.categoryVisibility[category] !== false) {
      button.classList.add("active");
    }

    const color = config.categoryColors[category];

    button.innerHTML = `<span
        class="filter-chip-color"
        style="background:${color}">
      </span>${category}`;

    button.addEventListener("click", () => {
      state.categoryVisibility[category] =
        state.categoryVisibility[category] === false;

      renderFilterButtons();

      refreshViews();
    });

    categoryContainer.appendChild(button);
  });

  const tagContainer = document.getElementById("tag-filter-buttons");

  tagContainer.innerHTML = "";

  const noTag = document.createElement("button");

  noTag.type = "button";

  noTag.className = "filter-chip";

  if (state.tagVisibility.none !== false) {
    noTag.classList.add("active");
  }

  noTag.textContent = "タグなし";

  noTag.addEventListener("click", () => {
    state.tagVisibility.none = state.tagVisibility.none === false;

    renderFilterButtons();

    refreshViews();
  });

  tagContainer.appendChild(noTag);

  config.tagColors.forEach((color) => {
    const button = document.createElement("button");

    button.type = "button";

    button.className = "filter-chip";

    if (state.tagVisibility[color] !== false) {
      button.classList.add("active");
    }

    const label = tagNames[color] || "未設定";

    button.innerHTML = `<span
        class="filter-chip-color"
        style="background:${color}">
      </span>${label}`;

    button.addEventListener("click", () => {
      state.tagVisibility[color] = state.tagVisibility[color] === false;

      renderFilterButtons();

      refreshViews();
    });

    tagContainer.appendChild(button);
  });
}

// ==========================================
// 32. フィルターリセット
// ==========================================

function resetFilters() {
  state.searchQuery = "";

  document.getElementById("search-input").value = "";

  Object.keys(config.categoryColors).forEach((category) => {
    state.categoryVisibility[category] = true;
  });

  state.tagVisibility.none = true;

  config.tagColors.forEach((color) => {
    state.tagVisibility[color] = true;
  });

  renderFilterButtons();

  refreshViews();
}

// ==========================================
// 33. タグ名設定
// ==========================================

function renderTagSettings() {
  const container = document.getElementById("tag-settings-list");

  container.innerHTML = "";

  config.tagColors.forEach((color) => {
    const row = document.createElement("div");

    row.className = "tag-setting-row";

    const dot = document.createElement("div");

    dot.className = "tag-setting-color";

    dot.style.backgroundColor = color;

    const input = document.createElement("input");

    input.type = "text";

    input.dataset.color = color;

    input.placeholder = "タグ名";

    input.value = tagNames[color] || "";

    row.appendChild(dot);

    row.appendChild(input);

    container.appendChild(row);
  });
}

// ==========================================
// 34. タグ名保存
// ==========================================

function saveTagSettings() {
  document.querySelectorAll("#tag-settings-list input").forEach((input) => {
    const color = input.dataset.color;

    tagNames[color] = input.value.trim();
  });

  saveToStorage();

  renderFilterButtons();

  refreshViews();

  openSheet("settings-sheet");
}

// ==========================================
// 35. バックアップ書き出し
// ==========================================

async function exportBackup() {
  const data = {
    version: 3,

    exportedAt: new Date().toISOString(),

    people,

    tagNames,
  };

  const json = JSON.stringify(data, null, 2);

  const filename = `history_backup_${new Date()
    .toISOString()
    .slice(0, 10)}.json`;

  if ("showSaveFilePicker" in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,

        types: [
          {
            description: "JSONファイル",

            accept: {
              "application/json": [".json"],
            },
          },
        ],
      });

      const writable = await handle.createWritable();

      await writable.write(json);

      await writable.close();

      return;
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
    }
  }

  const blob = new Blob([json], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download = filename;

  document.body.appendChild(link);

  link.click();

  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

// ==========================================
// 36. バックアップ復元
// ==========================================

function importBackup(file) {
  const reader = new FileReader();

  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);

      if (data && Array.isArray(data.people)) {
        people = data.people;

        tagNames = data.tagNames || {};
      } else if (Array.isArray(data)) {
        people = data;
      } else {
        throw new Error("形式が不正です");
      }

      ensureIds();

      saveToStorage();

      initializeVisibility();

      refreshAll();

      alert("バックアップを復元しました。");

      closeSheets();
    } catch (error) {
      console.error(error);

      alert("ファイルを読み込めませんでした。JSONファイルをご確認ください。");
    }
  };

  reader.readAsText(file);
}

// ==========================================
// 37. Tooltip
// ==========================================

function showTooltip(event, person) {
  if (window.matchMedia("(hover: none)").matches) {
    return;
  }

  const tooltip = document.getElementById("tooltip");

  const tag = person.tagColor ? tagNames[person.tagColor] || "タグ" : "なし";

  tooltip.innerHTML = `<strong>${person.name}</strong><br>
     ${getPeriodText(person)}<br>
     ${person.category}<br>
     タグ：${tag}`;

  tooltip.style.display = "block";

  moveTooltip(event);
}

function moveTooltip(event) {
  const tooltip = document.getElementById("tooltip");

  if (tooltip.style.display !== "block") {
    return;
  }

  tooltip.style.left = `${event.clientX + 12}px`;

  tooltip.style.top = `${event.clientY + 12}px`;
}

function hideTooltip() {
  document.getElementById("tooltip").style.display = "none";
}

// ==========================================
// 38. 再描画
// ==========================================

function refreshViews() {
  /*
   * 再描画前の年代を保持
   */
  captureCurrentViewState();

  const targetYear = state.currentYear;

  renderTimeline();

  renderPeopleList();

  updatePeopleCount();

  /*
   * 再描画後も現在見ている年代を維持
   */
  requestAnimationFrame(() => {
    if (state.activeView === "timeline") {
      scrollTimelineToYear(targetYear, false);
    } else {
      scrollPeopleToYear(targetYear, false);
    }
  });
}

function refreshAll() {
  renderFilterButtons();

  renderTagSelector();

  refreshViews();
}

// ==========================================
// 39. 人数
// ==========================================

function updatePeopleCount() {
  document.getElementById("people-count").textContent = people.length;
}

// ==========================================
// 40. 表示状態初期化
// ==========================================

function initializeVisibility() {
  Object.keys(config.categoryColors).forEach((category) => {
    if (state.categoryVisibility[category] === undefined) {
      state.categoryVisibility[category] = true;
    }
  });

  state.tagVisibility.none = state.tagVisibility.none !== false;

  config.tagColors.forEach((color) => {
    if (state.tagVisibility[color] === undefined) {
      state.tagVisibility[color] = true;
    }
  });
}

// ==========================================
// 41. カテゴリ選択
// ==========================================

function initializeCategorySelect() {
  const select = document.getElementById("person-category");

  select.innerHTML = "";

  Object.keys(config.categoryColors).forEach((category) => {
    const option = document.createElement("option");

    option.value = category;

    option.textContent = category;

    select.appendChild(option);
  });
}

// ==========================================
// 42. 年表スクロール監視
// ==========================================

function initializeTimelineScroll() {
  const scroller = document.getElementById("timeline-scroll");

  const axisWindow = document.getElementById("axis-window");

  scroller.addEventListener(
    "scroll",
    () => {
      axisWindow.scrollLeft = scroller.scrollLeft;

      state.timelineScrollLeft = scroller.scrollLeft;

      if (suppressTimelineYearUpdate) {
        return;
      }

      if (timelineScrollFrame) {
        cancelAnimationFrame(timelineScrollFrame);
      }

      timelineScrollFrame = requestAnimationFrame(() => {
        if (state.activeView !== "timeline") {
          return;
        }

        setCurrentYear(getTimelineCenterYear());
      });
    },
    {
      passive: true,
    },
  );
}

// ==========================================
// 43. 人物スクロール監視
// ==========================================

function initializePeopleScroll() {
  const scroller = document.getElementById("people-scroll");

  scroller.addEventListener(
    "scroll",
    () => {
      state.peopleScrollTop = scroller.scrollTop;

      if (suppressPeopleYearUpdate) {
        return;
      }

      if (peopleScrollFrame) {
        cancelAnimationFrame(peopleScrollFrame);
      }

      peopleScrollFrame = requestAnimationFrame(() => {
        if (state.activeView !== "people") {
          return;
        }

        setCurrentYear(getPeopleCenterYear());
      });
    },
    {
      passive: true,
    },
  );
}

// ==========================================
// 44. イベント
// ==========================================

function initializeEvents() {
  // ==============================
  // Bottom Tab
  // ==============================

  document.getElementById("timeline-tab").addEventListener("click", () => {
    switchView("timeline");
  });

  document.getElementById("people-tab").addEventListener("click", () => {
    switchView("people");
  });

  // ==============================
  // 検索
  // ==============================

  document.getElementById("open-search").addEventListener("click", () => {
    document.getElementById("search-input").value = state.searchQuery;

    renderFilterButtons();

    openSheet("search-sheet");
  });

  document.getElementById("search-input").addEventListener("input", (event) => {
    state.searchQuery = event.target.value;

    refreshViews();
  });

  document
    .getElementById("reset-filters")
    .addEventListener("click", resetFilters);

  // ==============================
  // 設定
  // ==============================

  document.getElementById("open-settings").addEventListener("click", () => {
    document.getElementById("zoom-slider").value = state.zoomScale;

    document.getElementById("zoom-value").textContent =
      `${state.zoomScale.toFixed(1)}×`;

    updatePeopleCount();

    openSheet("settings-sheet");
  });

  // ==============================
  // Zoom
  // ==============================

  document.getElementById("zoom-slider").addEventListener("input", (event) => {
    /*
     * 年表を見ている時は
     * ズーム前の中央年代を記録
     */
    if (state.activeView === "timeline") {
      setCurrentYear(getTimelineCenterYear());
    }

    const targetYear = state.currentYear;

    state.zoomScale = parseFloat(event.target.value);

    document.getElementById("zoom-value").textContent =
      `${state.zoomScale.toFixed(1)}×`;

    renderTimeline();

    /*
     * ズームしても同じ年代を中央に維持
     */
    if (state.activeView === "timeline") {
      requestAnimationFrame(() => {
        scrollTimelineToYear(targetYear, false);
      });
    }
  });

  document
    .getElementById("jump-today")
    .addEventListener("click", scrollToToday);

  // ==============================
  // 人物追加
  // ==============================

  document.getElementById("add-person-button").addEventListener("click", () => {
    openPersonForm();
  });

  // ==============================
  // 人物編集
  // ==============================

  document
    .getElementById("detail-edit-button")
    .addEventListener("click", () => {
      const person = getPersonById(state.detailPersonId);

      if (person) {
        openPersonForm(person);
      }
    });

  document.getElementById("person-form").addEventListener("submit", savePerson);

  document
    .getElementById("delete-person-button")
    .addEventListener("click", deleteCurrentPerson);

  // ==============================
  // タグ
  // ==============================

  document.getElementById("open-tag-settings").addEventListener("click", () => {
    renderTagSettings();

    openSheet("tag-settings-sheet");
  });

  document
    .getElementById("save-tag-settings")
    .addEventListener("click", saveTagSettings);

  // ==============================
  // Backup
  // ==============================

  document
    .getElementById("export-button")
    .addEventListener("click", exportBackup);

  const importInput = document.getElementById("import-file");

  document.getElementById("import-button").addEventListener("click", () => {
    importInput.click();
  });

  importInput.addEventListener("change", (event) => {
    const file = event.target.files[0];

    if (file) {
      importBackup(file);
    }

    event.target.value = "";
  });

  // ==============================
  // Sheet
  // ==============================

  document.querySelectorAll(".sheet-close").forEach((button) => {
    button.addEventListener("click", closeSheets);
  });

  document
    .getElementById("sheet-backdrop")
    .addEventListener("click", closeSheets);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSheets();
    }
  });
}

// ==========================================
// 45. 初期化
// ==========================================

function initialize() {
  ensureIds();

  initializeVisibility();

  initializeCategorySelect();

  initializeTimelineScroll();

  initializePeopleScroll();

  initializeEvents();

  renderFilterButtons();

  renderTagSelector();

  renderTimeline();

  renderPeopleList();

  updatePeopleCount();

  /*
   * 初回は今日を共通年代に設定
   */
  setCurrentYear(new Date().getFullYear());

  /*
   * 年表を今日に移動
   */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scrollTimelineToYear(state.currentYear, false);
    });
  });
}

// ==========================================
// START
// ==========================================

document.addEventListener("DOMContentLoaded", initialize);
