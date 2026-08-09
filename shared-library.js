// ============================================================
// Shared Card Library (共享卡牌库)
// 按 docs/PRD_共享卡牌库_Codex_Spec.md（v2.0）§2 实现。
// 依赖 app.js 暴露的 window.CardBuilder 接口：
//   getFullState() / captureThumbnail(w, h, format) / loadFullState(state)
// 以及全局函数：$ / drawCardToCanvas / normalizeState / closeLibraryDrawer /
// showToast / downloadBlob / PROJECT_VERSION / STYLE_META / RARITY_META /
// EFFECT_META / compactText / POSITION_MAP
// ============================================================

(function () {
  "use strict";

  const API_BASE = ""; // 同源
  const AUTHOR_KEY = "cardbuilder_shared_author";
  const TOKENS_KEY = "cardbuilder_shared_tokens";
  const IS_GITHUB_PAGES = window.location.hostname.endsWith(".github.io");

  let sharedCards = [];
  let sharedFilters = { rarity: "ALL", style: "ALL", slabType: "ALL" };
  let currentDetail = null;
  let currentDetailSide = "front";

  // ---------- API ----------
  async function apiListCards() {
    const res = await fetch(`${API_BASE}/api/cards`);
    if (!res.ok) throw new Error(`List failed: ${res.status}`);
    return (await res.json()).cards;
  }

  async function apiPublishCard(author, card) {
    const res = await fetch(`${API_BASE}/api/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, card }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Publish failed: ${res.status}`);
    }
    return res.json();
  }

  async function apiGetCard(id) {
    const res = await fetch(`${API_BASE}/api/cards/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`Get failed: ${res.status}`);
    return res.json();
  }

  async function apiDeleteCard(id, token) {
    const res = await fetch(`${API_BASE}/api/cards/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Delete failed: ${res.status}`);
    }
    return res.json();
  }

  // ---------- Token / 昵称 ----------
  function getTokens() {
    try {
      return JSON.parse(localStorage.getItem(TOKENS_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveToken(sharedId, token) {
    const tokens = getTokens();
    tokens[sharedId] = token;
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  }

  function getToken(sharedId) {
    return getTokens()[sharedId] || null;
  }

  function removeToken(sharedId) {
    const tokens = getTokens();
    delete tokens[sharedId];
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  }

  function getSavedAuthor() {
    return localStorage.getItem(AUTHOR_KEY) || "";
  }

  function saveAuthor(name) {
    localStorage.setItem(AUTHOR_KEY, String(name || "").trim().slice(0, 24));
  }

  // ---------- 图片内联 ----------
  async function fetchAsDataUrl(url) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return url; // 转换失败则保留原路径
    }
  }

  async function inlineRelativeImages(fullState) {
    const state = JSON.parse(JSON.stringify(fullState));
    const plan = {
      playerImg: [640, 800, 0.82],
      logoImg: [180, 180, 0.82],
      signatureData: [600, 240, 0.85],
      customFoilMask: [512, 512, 0.85],
    };
    for (const field of Object.keys(plan)) {
      const value = state[field];
      if (typeof value !== "string") continue;
      if (!value.startsWith("data:")) {
        // 相对路径/URL → 转 data URL；失败则保留原路径
        state[field] = await fetchAsDataUrl(value);
      }
      if (typeof state[field] === "string" && state[field].startsWith("data:")) {
        // 压缩到规范允许的 fullState 体积（MAX_FULLSTATE_CHARS=2MB）内
        const [maxWidth, maxHeight, quality] = plan[field];
        const compacted = await compactStoredImage(state[field], maxWidth, maxHeight, quality);
        if (compacted) state[field] = compacted;
      }
    }
    return state;
  }

  // ---------- 发布 ----------
  async function publishCurrentCard() {
    const state = window.CardBuilder.getFullState();
    if (!state) {
      showToast("请先制作一张卡牌");
      return;
    }

    const publishBtn = document.getElementById("shared-publish-btn");
    if (publishBtn) {
      publishBtn.disabled = true;
      publishBtn.textContent = "发布中...";
    }
    try {
      showToast("正在生成共享卡牌快照...");
      const thumbnail = await window.CardBuilder.captureThumbnail(360, 504, "image/jpeg");
      const inlinedState = await inlineRelativeImages(state.fullState);
      const authorInput = document.getElementById("shared-author-input");
      const author = (authorInput?.value || "").trim() || "匿名";
      saveAuthor(author);

      const card = {
        id: state.id || `cb_${Date.now().toString(36)}`,
        name: state.name,
        team: state.team,
        style: state.style,
        effect: state.effect,
        rarity: state.rarity,
        slabType: state.slabType,
        badges: state.badges || [],
        thumbnail,
        fullState: inlinedState,
        createdAt: Date.now(),
      };

      // §4 发布前强校验：error 阻断，warn 需确认
      const publishWarnings = validatePlayerMeta({ name: state.name, team: state.team, fullState: state.fullState });
      const errorWarnings = publishWarnings.filter((w) => w.level === "error");
      if (errorWarnings.length) {
        showToast("队伍与官方注册不符，请修正后再发布");
        return;
      }
      const warnWarnings = publishWarnings.filter((w) => w.level === "warn");
      if (warnWarnings.length && !window.confirm(`检测到 ${warnWarnings.length} 项信息可能有误，仍要发布吗？`)) {
        return;
      }

      const result = await apiPublishCard(author, card);
      saveToken(result.id, result.token);
      await loadSharedCards();
      showToast(`已发布到共享卡牌库（${result.card.name || card.name}）`);
    } catch (err) {
      console.error("Publish error:", err);
      showToast("发布失败: " + err.message);
    } finally {
      if (publishBtn) {
        publishBtn.disabled = false;
        publishBtn.textContent = "✦ PUBLISH CURRENT CARD";
      }
    }
  }

  // ---------- 网格 ----------
  async function loadSharedCards() {
    if (IS_GITHUB_PAGES) {
      const grid = document.getElementById("shared-grid");
      const countEl = document.getElementById("shared-count");
      if (countEl) countEl.textContent = "STATIC EDITION";
      if (grid) {
        grid.innerHTML = '<div class="shared-empty">GitHub Pages 静态版不包含共享卡牌库服务。请使用 MY COLLECTION 保存本地卡牌；在本地 Node 服务中可使用发布与共享功能。</div>';
      }
      return;
    }
    try {
      sharedCards = await apiListCards();
      renderSharedGrid();
    } catch (err) {
      console.error("Load shared cards error:", err);
      showToast("共享卡牌库加载失败: " + err.message);
    }
  }

  function normalizeSlabType(val) {
    return (val || "").toUpperCase().replace(/[\s-]+/g, "_");
  }

  function renderSharedGrid() {
    const grid = document.getElementById("shared-grid");
    const countEl = document.getElementById("shared-count");
    if (!grid) return;

    const filtered = sharedCards.filter((item) => {
      const c = item.card || {};
      if (sharedFilters.rarity !== "ALL" && (c.rarity || "").toUpperCase() !== sharedFilters.rarity) return false;
      if (sharedFilters.style !== "ALL" && (c.style || "").toUpperCase() !== sharedFilters.style) return false;
      if (sharedFilters.slabType !== "ALL" && normalizeSlabType(c.slabType) !== sharedFilters.slabType) return false;
      return true;
    });

    if (countEl) countEl.textContent = `${filtered.length} CARDS`;

    if (sharedCards.length === 0) {
      grid.innerHTML = '<div class="shared-empty">还没有共享卡牌，先做一张卡发布吧！</div>';
      return;
    }
    if (filtered.length === 0) {
      grid.innerHTML = '<div class="shared-empty">没有符合筛选条件的卡片</div>';
      return;
    }

    grid.innerHTML = filtered.map((item) => {
      const c = item.card || {};
      return `
        <div class="shared-card-item" data-shared-id="${item.id}" role="button" tabindex="0"
             aria-label="查看 ${c.name || "Card"} by ${item.author}">
          <div class="shared-card-thumb">
            <img src="${c.thumbnailUrl}" alt="${c.name || "Card"}" loading="lazy" width="180" height="252">
          </div>
          <div class="shared-card-info">
            <div class="shared-card-name">${c.name || "UNNAMED"}</div>
            ${item.featured ? '<span class="shared-card-featured">官方展示</span>' : ""}
            <div class="shared-card-meta">
              <span class="shared-card-team">${c.team || ""}</span>
              <span class="shared-card-rarity rarity-${(c.rarity || "base").toLowerCase()}">${(c.rarity || "BASE").toUpperCase()}</span>
            </div>
            <div class="shared-card-author">by ${item.author}</div>
          </div>
        </div>`;
    }).join("");

    grid.querySelectorAll(".shared-card-item").forEach((el) => {
      el.addEventListener("click", () => openSharedDetail(el.dataset.sharedId));
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") openSharedDetail(el.dataset.sharedId);
      });
    });

    // UI POLISH v3：共享卡片逐张入场
    grid.querySelectorAll(".shared-card-item").forEach((card, index) => {
      const delay = Math.min(index * 60, 1200);
      card.style.opacity = "0";
      card.style.transform = "translateY(12px)";
      card.style.transition = "none";
      requestAnimationFrame(() => {
        card.style.transition = `opacity 300ms ease ${delay}ms, transform 300ms ease ${delay}ms`;
        card.style.opacity = "1";
        card.style.transform = "translateY(0)";
      });
    });
  }

  // ---------- 检视弹层 ----------
  function resolveData(full) {
    return {
      ...full,
      name: compactText(full.playerName, "PLAYER NAME"),
      number: compactText(full.playerNumber, "00"),
      pos: compactText(full.playerPosition, "SF"),
      posFull: POSITION_MAP[full.playerPosition] || compactText(full.playerPosition, "PLAYER"),
      team: compactText(full.teamName, "CUSTOM TEAM"),
      abbr: compactText(full.teamAbbr, "TEAM").toUpperCase().slice(0, 4),
      season: compactText(full.cardSeason, "2023-24"),
      c1: full.colorPrimary,
      c2: full.colorSecondary,
      height: compactText(full.playerHeight),
      weight: compactText(full.playerWeight),
      hometown: compactText(full.playerHometown),
      draft: compactText(full.playerDraft),
      gp: compactText(full.statGP, "0"),
      ppg: compactText(full.statPPG, "0.0"),
      rpg: compactText(full.statRPG, "0.0"),
      apg: compactText(full.statAPG, "0.0"),
      fg: compactText(full.statFG, "0.0"),
      tp: compactText(full.stat3P, "0.0"),
      cardNum: compactText(full.cardNum, "OPEN"),
      cardId: compactText(full.cardId, "CB-000"),
      bio: compactText(full.playerBio, "Custom player profile."),
      styleMeta: STYLE_META[full.style],
      effectMeta: EFFECT_META[full.effect],
      rarityMeta: RARITY_META[full.rarity],
    };
  }

  async function openSharedDetail(sharedId) {
    const modal = document.getElementById("shared-detail-modal");
    if (!modal) return;

    // 检视弹层打开前关闭卡牌库抽屉与遮罩，避免遮罩拦截弹层点击。
    closeLibraryDrawer();
    modal.classList.add("active");
    document.body.style.overflow = "hidden";

    try {
      showToast("正在加载共享卡牌...");
      const data = await apiGetCard(sharedId);
      currentDetail = data;
      currentDetailSide = "front";
      await renderDetailContent(data, sharedId);
    } catch (err) {
      console.error("Load detail error:", err);
      const body = modal.querySelector(".shared-detail-body");
      if (body) body.innerHTML = `<div class="shared-empty">加载失败：${escapeHtmlText(err.message || "请重试")}</div>`;
    }
  }

  function escapeHtmlText(value) {
    const node = document.createElement("div");
    node.textContent = String(value ?? "");
    return node.innerHTML;
  }

  async function renderDetailContent(data, sharedId) {
    const body = document.querySelector(".shared-detail-body");
    if (!body) return;

    const card = data.card || {};
    const fullState = card.fullState || {};
    const token = getToken(sharedId);
    const createdDate = new Date(data.createdAt).toLocaleString("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
    const full = normalizeState(fullState);
    const cardWarnings = validatePlayerMeta({ name: card.name, team: card.team, fullState });
    const warningsHtml = cardWarnings.length
      ? `<div class="player-warnings">${cardWarnings.map((w) =>
          `<div class="player-warning player-warning-${w.level}">${escapeHtmlText(`[${w.level.toUpperCase()}] ${w.msg}`)}</div>`).join("")}</div>`
      : "";
    const positionName = normalizePositionName(full.playerPosition);

    const stats = [
      ["PPG", fullState.statPPG], ["RPG", fullState.statRPG], ["APG", fullState.statAPG],
      ["FG%", fullState.statFG], ["3P%", fullState.stat3P], ["GP", fullState.statGP],
      ["Height", fullState.playerHeight], ["Weight", fullState.playerWeight],
    ].filter(([, value]) => value !== undefined && value !== null && value !== "");
    const statsHtml = stats.length
      ? `<div class="shared-detail-stats">${stats.map(([label, value]) =>
          `<div class="shared-detail-stat"><span class="stat-label">${label}</span><span class="stat-value">${escapeHtmlText(value)}</span></div>`
        ).join("")}</div>`
      : "";

    const badgesHtml = (card.badges || []).length
      ? `<div class="shared-detail-badges">${(card.badges || []).map((badge) =>
          `<span class="shared-detail-badge">${escapeHtmlText(String(badge).toUpperCase())}</span>`).join("")}</div>`
      : "";

    body.innerHTML = `
      <div class="shared-detail-preview">
        <canvas id="shared-detail-canvas" width="360" height="504" aria-label="卡牌正反面预览"></canvas>
        <div class="shared-detail-flip-btns">
          <button class="btn-flip active" data-side="front" type="button" aria-label="正面">FRONT</button>
          <button class="btn-flip" data-side="back" type="button" aria-label="反面">BACK</button>
        </div>
      </div>
      <div class="shared-detail-info">
        <h2 class="shared-detail-name">${card.name || "UNNAMED"}</h2>
        <div class="shared-detail-author">by ${data.author} · ${createdDate}</div>
        ${warningsHtml}
        <div class="shared-detail-tags">
          <span class="tag-style">${(card.style || "").toUpperCase()}</span>
          <span class="tag-rarity rarity-${(card.rarity || "base").toLowerCase()}">${(card.rarity || "BASE").toUpperCase()}</span>
          <span class="tag-effect">${(card.effect || "NONE").toUpperCase()}</span>
          <span class="tag-slab">${(card.slabType || "RAW").toUpperCase()}</span>
          ${positionName ? `<span class="tag-position">${escapeHtmlText(positionName)}</span>` : ""}
          ${badgesHtml}
        </div>
        ${statsHtml}
        <div class="shared-detail-actions">
          <button id="shared-load-btn" class="btn-action btn-primary" type="button" aria-label="加载到编辑器">▶ LOAD TO EDITOR</button>
          <button id="shared-download-btn" class="btn-action btn-secondary" type="button" aria-label="下载项目 JSON">⬇ DOWNLOAD JSON</button>
          ${token ? `<button id="shared-delete-btn" class="btn-action btn-danger" type="button" aria-label="删除此卡牌">✕ DELETE</button>` : ""}
        </div>
      </div>`;

    await drawDetailCanvas(full);

    // 正反面切换
    body.querySelectorAll(".btn-flip").forEach((btn) => {
      btn.addEventListener("click", async () => {
        body.querySelectorAll(".btn-flip").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentDetailSide = btn.dataset.side;
        await drawDetailCanvas(normalizeState(fullState));
      });
    });

    // 加载到编辑器
    document.getElementById("shared-load-btn")?.addEventListener("click", () => {
      if (window.CardBuilder?.loadFullState) {
        window.CardBuilder.loadFullState(card.fullState);
        closeSharedDetail();
        closeLibraryDrawer();
      }
    });

    // 下载项目 JSON
    document.getElementById("shared-download-btn")?.addEventListener("click", () => {
      const payload = JSON.stringify({
        ...card.fullState,
        version: PROJECT_VERSION,
        rotX: 0,
        rotY: 0,
        autoRotY: 0,
        flipped: false,
      }, null, 2);
      downloadBlob(new Blob([payload], { type: "application/json" }), `${(card.name || "card").replace(/\s+/g, "_")}.json`);
    });

    // 删除
    document.getElementById("shared-delete-btn")?.addEventListener("click", async () => {
      if (!window.confirm("确定要删除这张共享卡牌吗？此操作不可撤销。")) return;
      try {
        await apiDeleteCard(sharedId, token);
        removeToken(sharedId);
        closeSharedDetail();
        await loadSharedCards();
        showToast("已从共享卡牌库删除");
      } catch (err) {
        showToast("删除失败: " + err.message);
      }
    });
  }

  async function drawDetailCanvas(full) {
    const canvas = document.getElementById("shared-detail-canvas");
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    await drawCardToCanvas(context, resolveData(full), currentDetailSide, 0, 0, canvas.width, canvas.height);
  }

  function closeSharedDetail() {
    currentDetail = null;
    const modal = document.getElementById("shared-detail-modal");
    if (modal) modal.classList.remove("active");
    document.body.style.overflow = "";
  }

  // ---------- 初始化 ----------
  function initSharedLibrary() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSharedDetail();
    });

    document.getElementById("shared-detail-modal")?.addEventListener("click", (e) => {
      if (e.target.id === "shared-detail-modal" || e.target.classList.contains("shared-detail-overlay")) {
        closeSharedDetail();
      }
    });

    document.getElementById("shared-detail-close")?.addEventListener("click", closeSharedDetail);
    document.getElementById("shared-publish-btn")?.addEventListener("click", publishCurrentCard);
    document.getElementById("shared-refresh-btn")?.addEventListener("click", loadSharedCards);

    document.querySelectorAll(".shared-filter-select").forEach((sel) => {
      sel.addEventListener("change", (e) => {
        const field = e.target.dataset.filterField;
        sharedFilters[field] = e.target.value;
        renderSharedGrid();
      });
    });

    const authorInput = document.getElementById("shared-author-input");
    if (authorInput) authorInput.value = getSavedAuthor();

    if (IS_GITHUB_PAGES) {
      authorInput && (authorInput.disabled = true);
      document.getElementById("shared-publish-btn")?.setAttribute("disabled", "");
      document.getElementById("shared-refresh-btn")?.setAttribute("disabled", "");
      document.querySelectorAll(".shared-filter-select").forEach((select) => {
        select.disabled = true;
      });
    }

    document.querySelectorAll(".library-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".library-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const target = tab.dataset.tab;
        document.getElementById("local-library-panel")?.classList.toggle("hidden", target !== "local");
        document.getElementById("shared-library-panel")?.classList.toggle("hidden", target !== "shared");
        if (target === "shared") loadSharedCards();
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSharedLibrary);
  } else {
    initSharedLibrary();
  }
})();
