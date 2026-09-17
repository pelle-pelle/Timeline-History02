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
  activeView: "timeline",

  editingId: null,

  detailPersonId: null,

  zoomScale: 1,

  searchQuery: "",

  categoryVisibility: {},

  tagVisibility: {
    none: true,
  },

  selectedTagColor: "",
};

// 年表描画後の位置計算用
let timelineMeta = {
  minYear: 500,
  maxYear: new Date().getFullYear(),

  pxPerYear: config.pxPerYearBase,

  totalWidth: 0,
};

// scrollイベントの負荷軽減用
let scrollAnimationFrame = null;

// ==========================================
// 4. 初期データ整備
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
// 5. 保存
// ==========================================

function saveToStorage() {
  localStorage.setItem("peopleData", JSON.stringify(people));

  localStorage.setItem("tagNamesData", JSON.stringify(tagNames));
}

// ==========================================
// 6. 共通
// ==========================================

function formatYear(year) {
  if (year < 0) {
    return `BC${Math.abs(year)}`;
  }

  return `${year}`;
}

function formatYearWithSuffix(year) {
  if (year < 0) {
    return `BC${Math.abs(year)}`;
  }

  return `${year}年`;
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
// 7. フィルター
// ==========================================

function getVisiblePeople() {
  return people.filter((person) => {
    const name = String(person.name || "").toLowerCase();

    const query = String(state.searchQuery || "").toLowerCase();

    const searchMatch = name.includes(query);

    const categoryMatch = state.categoryVisibility[person.category] !== false;

    const tagKey = person.tagColor || "none";

    const tagMatch = state.tagVisibility[tagKey] !== false;

    return searchMatch && categoryMatch && tagMatch;
  });
}

// ==========================================
// 8. 年表の範囲
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
// 9. 年 → X座標
// ==========================================

function yearToX(year) {
  return (year - timelineMeta.minYear) * timelineMeta.pxPerYear;
}

// ==========================================
// 10. 年代目盛り
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
// 11. 現在画面中央の年
// ==========================================

function getCenterYear() {
  const scroller = document.getElementById("timeline-scroll");

  if (!scroller || !timelineMeta.pxPerYear) {
    return null;
  }

  const centerX = scroller.scrollLeft + scroller.clientWidth / 2;

  return timelineMeta.minYear + centerX / timelineMeta.pxPerYear;
}

// ==========================================
// 12. 年表描画
// ==========================================

function renderTimeline(centerYearToRestore = null) {
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

  // ==========================================
  // 年代
  // ==========================================

  const step = getYearStep(pxPerYear);

  let firstTick = Math.ceil(bounds.minYear / step) * step;

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

  // ==========================================
  // 人物配置
  // ==========================================

  const visiblePeople = getVisiblePeople()
    .slice()
    .sort((a, b) => a.birth - b.birth);

  const rows = [];

  visiblePeople.forEach((person) => {
    const startX = yearToX(person.birth);

    const endYear = getDeathYear(person);

    const actualWidth = Math.max(2, (endYear - person.birth) * pxPerYear);

    /*
     * ズームアウト時でも人物名を
     * タップできるように最低幅を確保
     */
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

    /*
     * 十分な幅がある時のみ生没年を表示
     */
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

    /*
     * PCではhover情報も残す
     */
    bar.addEventListener("mouseenter", (event) => {
      showTooltip(event, person);
    });

    bar.addEventListener("mousemove", (event) => {
      moveTooltip(event);
    });

    bar.addEventListener("mouseleave", hideTooltip);

    barsContainer.appendChild(bar);
  });

  /*
   * 行数に合わせて高さを決定
   */
  const contentHeight = Math.max(430, rows.length * config.rowHeight + 70);

  canvas.style.height = `${contentHeight}px`;

  eraContainer.style.height = `${contentHeight}px`;

  barsContainer.style.height = `${contentHeight}px`;

  // ==========================================
  // 時代背景
  // ==========================================

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

    /*
     * 時代がある程度広く見える時だけ
     * 背景にも名称表示
     */
    if ((end - start) * pxPerYear > 80) {
      const label = document.createElement("span");

      label.className = "era-region-label";

      label.textContent = era.name;

      region.appendChild(label);
    }

    eraContainer.appendChild(region);
  });

  // ==========================================
  // 今日
  // ==========================================

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

  /*
   * ズーム前の中央年代を維持
   */
  if (centerYearToRestore !== null) {
    requestAnimationFrame(() => {
      scrollToYear(centerYearToRestore, false);
    });
  } else {
    updateEraSummary();
  }
}

// ==========================================
// 13. 人物一覧
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

    const categoryChip = createMetaChip(
      person.category,
      config.categoryColors[person.category],
    );

    meta.appendChild(categoryChip);

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
// 14. メタチップ
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
// 15. 時代表示更新
// ==========================================

function updateEraSummary() {
  const scroller = document.getElementById("timeline-scroll");

  if (!scroller || !timelineMeta.pxPerYear) {
    return;
  }

  const centerX = scroller.scrollLeft + scroller.clientWidth / 2;

  const centerYear = timelineMeta.minYear + centerX / timelineMeta.pxPerYear;

  const era = config.eras.find(
    (item) => centerYear >= item.start && centerYear < item.end,
  );

  const eraTitle = document.getElementById("era-title");

  const eraRange = document.getElementById("era-range");

  if (era) {
    eraTitle.textContent = `${era.name}時代`;

    eraRange.textContent = `${formatYear(era.start)} – ${formatYear(era.end)}`;
  } else {
    eraTitle.textContent = `${formatYear(Math.round(centerYear))}年頃`;

    eraRange.textContent = "歴史年表";
  }
}

// ==========================================
// 16. 年代へ移動
// ==========================================

function scrollToYear(year, smooth = true) {
  const scroller = document.getElementById("timeline-scroll");

  const targetX = yearToX(year) - scroller.clientWidth / 2;

  scroller.scrollTo({
    left: Math.max(0, targetX),

    behavior: smooth ? "smooth" : "auto",
  });
}

// ==========================================
// 17. 今日へ
// ==========================================

function scrollToToday() {
  switchView("timeline");

  scrollToYear(new Date().getFullYear());

  closeSheets();
}

// ==========================================
// 18. 年表 / 人物ビュー切替
// ==========================================

function switchView(view) {
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

    requestAnimationFrame(updateEraSummary);
  } else {
    timelineView.classList.add("hidden");

    peopleView.classList.remove("hidden");

    timelineTab.classList.remove("active");

    peopleTab.classList.add("active");

    renderPeopleList();
  }
}

// ==========================================
// 19. Bottom Sheet
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
// 20. 人物詳細
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
// 21. 人物追加・編集
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
// 22. 人物保存
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
// 23. 人物削除
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
// 24. タグ選択
// ==========================================

function renderTagSelector() {
  const container = document.getElementById("tag-color-selector");

  container.innerHTML = "";

  // タグなし
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
// 25. 検索フィルターUI
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

  // タグ
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
// 26. フィルターリセット
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
// 27. タグ名編集
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
// 28. タグ名保存
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
// 29. バックアップ
// ==========================================

async function exportBackup() {
  const data = {
    version: 2,

    exportedAt: new Date().toISOString(),

    people,

    tagNames,
  };

  const json = JSON.stringify(data, null, 2);

  const filename = `history_backup_${new Date()
    .toISOString()
    .slice(0, 10)}.json`;

  /*
   * PC Chrome / Edge
   */
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

  /*
   * iPhone / Safariなど
   */
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
// 30. バックアップ復元
// ==========================================

function importBackup(file) {
  const reader = new FileReader();

  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);

      /*
       * 新形式
       */
      if (data && Array.isArray(data.people)) {
        people = data.people;

        tagNames = data.tagNames || {};

        /*
         * 古い形式で
         * 人物配列だけの場合も対応
         */
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
// 31. Tooltip
// ==========================================

function showTooltip(event, person) {
  /*
   * touch端末では表示しない
   */
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
// 32. 表示更新
// ==========================================

function refreshViews() {
  const centerYear = state.activeView === "timeline" ? getCenterYear() : null;

  renderTimeline(centerYear);

  renderPeopleList();

  updatePeopleCount();
}

function refreshAll() {
  renderFilterButtons();

  renderTagSelector();

  refreshViews();
}

// ==========================================
// 33. 人数
// ==========================================

function updatePeopleCount() {
  document.getElementById("people-count").textContent = people.length;
}

// ==========================================
// 34. 初期カテゴリ・タグ状態
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
// 35. カテゴリselect
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
// 36. スクロール同期
// ==========================================

function initializeTimelineScroll() {
  const scroller = document.getElementById("timeline-scroll");

  const axisWindow = document.getElementById("axis-window");

  scroller.addEventListener(
    "scroll",
    () => {
      axisWindow.scrollLeft = scroller.scrollLeft;

      if (scrollAnimationFrame) {
        cancelAnimationFrame(scrollAnimationFrame);
      }

      scrollAnimationFrame = requestAnimationFrame(updateEraSummary);
    },
    {
      passive: true,
    },
  );
}

// ==========================================
// 37. イベント登録
// ==========================================

function initializeEvents() {
  // ------------------------------
  // View
  // ------------------------------

  document.getElementById("timeline-tab").addEventListener("click", () => {
    switchView("timeline");
  });

  document.getElementById("people-tab").addEventListener("click", () => {
    switchView("people");
  });

  // ------------------------------
  // 検索
  // ------------------------------

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

  // ------------------------------
  // 設定
  // ------------------------------

  document.getElementById("open-settings").addEventListener("click", () => {
    document.getElementById("zoom-slider").value = state.zoomScale;

    document.getElementById("zoom-value").textContent =
      `${state.zoomScale.toFixed(1)}×`;

    updatePeopleCount();

    openSheet("settings-sheet");
  });

  // ------------------------------
  // Zoom
  // ------------------------------

  document.getElementById("zoom-slider").addEventListener("input", (event) => {
    const centerYear = getCenterYear();

    state.zoomScale = parseFloat(event.target.value);

    document.getElementById("zoom-value").textContent =
      `${state.zoomScale.toFixed(1)}×`;

    renderTimeline(centerYear);
  });

  document
    .getElementById("jump-today")
    .addEventListener("click", scrollToToday);

  // ------------------------------
  // 人物追加
  // ------------------------------

  document.getElementById("add-person-button").addEventListener("click", () => {
    openPersonForm();
  });

  // ------------------------------
  // 人物編集
  // ------------------------------

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

  // ------------------------------
  // タグ設定
  // ------------------------------

  document.getElementById("open-tag-settings").addEventListener("click", () => {
    renderTagSettings();

    openSheet("tag-settings-sheet");
  });

  document
    .getElementById("save-tag-settings")
    .addEventListener("click", saveTagSettings);

  // ------------------------------
  // Export
  // ------------------------------

  document
    .getElementById("export-button")
    .addEventListener("click", exportBackup);

  // ------------------------------
  // Import
  // ------------------------------

  const importInput = document.getElementById("import-file");

  document.getElementById("import-button").addEventListener("click", () => {
    importInput.click();
  });

  importInput.addEventListener("change", (event) => {
    const file = event.target.files[0];

    if (file) {
      importBackup(file);
    }

    /*
     * 同じファイルを
     * 再度選択できるように
     */
    event.target.value = "";
  });

  // ------------------------------
  // Sheet閉じる
  // ------------------------------

  document.querySelectorAll(".sheet-close").forEach((button) => {
    button.addEventListener("click", closeSheets);
  });

  document
    .getElementById("sheet-backdrop")
    .addEventListener("click", closeSheets);

  // Esc
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSheets();
    }
  });
}

// ==========================================
// 38. 初期起動
// ==========================================

function initialize() {
  ensureIds();

  initializeVisibility();

  initializeCategorySelect();

  initializeTimelineScroll();

  initializeEvents();

  renderFilterButtons();

  renderTagSelector();

  renderTimeline();

  renderPeopleList();

  updatePeopleCount();

  /*
   * 初回は「今日」に移動
   */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scrollToYear(new Date().getFullYear(), false);
    });
  });
}

// ==========================================
// START
// ==========================================

document.addEventListener("DOMContentLoaded", initialize);
