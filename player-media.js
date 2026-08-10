"use strict";

(() => {
  const modal = document.getElementById("playerMediaModal");
  const openButton = document.getElementById("playerMediaOpenBtn");
  const grid = document.getElementById("playerMediaGrid");
  const count = document.getElementById("playerMediaCount");
  const playerName = document.getElementById("playerMediaPlayerName");
  const tabs = document.getElementById("playerMediaTabs");
  if (!modal || !openButton || !grid || !tabs) return;

  let activeCategory = "recommended";
  let requestController = null;
  let lastFocused = null;

  const categoryNames = {
    game_action: "比赛",
    training: "训练",
    media_day: "媒体日",
    milestone: "里程碑",
    commemorative: "纪念",
    celebration: "庆祝",
    profile: "肖像",
    headshot_fallback: "头像回退",
  };

  function setEmpty(message) {
    grid.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "player-media-empty";
    empty.textContent = message;
    grid.appendChild(empty);
    count.textContent = "0 ASSETS";
  }

  function formatDate(value) {
    if (!value) return "日期待补充";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(date);
  }

  function createMediaCard(media, currentMediaId) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "player-media-card";
    button.classList.toggle("is-selected", media.mediaId === currentMediaId);
    button.setAttribute("aria-label", `选择${media.title || categoryNames[media.category] || "球员照片"}`);

    const thumb = document.createElement("div");
    thumb.className = "player-media-thumb";
    const image = document.createElement("img");
    image.src = media.thumbUrl;
    image.alt = media.title || "球员影像";
    image.loading = "lazy";
    image.decoding = "async";
    image.onerror = () => {
      image.style.display = "none";
      thumb.classList.add("thumb-error");
    };
    const badge = document.createElement("span");
    badge.className = `player-media-badge${media.fallback ? " fallback" : ""}`;
    badge.textContent = media.fallback ? "临时回退" : (categoryNames[media.category] || media.category || "MEDIA");
    thumb.append(image, badge);

    const meta = document.createElement("div");
    meta.className = "player-media-meta";
    const title = document.createElement("strong");
    title.textContent = media.title || categoryNames[media.category] || "球员影像";
    const context = document.createElement("span");
    context.textContent = `${media.teamAtCapture || "TEAM N/A"} · ${formatDate(media.capturedAt)}`;
    const credit = document.createElement("span");
    credit.textContent = media.creditLine || media.provider || "来源待补充";
    meta.append(title, context, credit);
    button.append(thumb, meta);

    button.addEventListener("click", async () => {
      button.disabled = true;
      const applied = await window.CardBuilderMediaBridge?.applyMedia(media);
      button.disabled = false;
      if (applied) closeModal();
    });
    return button;
  }

  async function loadMedia() {
    const player = window.CardBuilderMediaBridge?.getCurrentPlayer();
    playerName.textContent = player?.displayName || "未识别球员";
    if (!player?.playerId) {
      setEmpty("当前姓名未匹配到 25 名种子球员。请先选择或输入完整球员姓名。");
      return;
    }

    requestController?.abort();
    requestController = new AbortController();
    setEmpty("正在读取已审核影像…");
    try {
      const params = new URLSearchParams();
      if (activeCategory !== "recommended") params.set("category", activeCategory);
      const response = await fetch(`/api/players/${encodeURIComponent(player.playerId)}/media?${params}`, {
        signal: requestController.signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Media API ${response.status}`);
      const payload = await response.json();
      const items = Array.isArray(payload.media) ? payload.media : [];
      grid.replaceChildren(...items.map((media) => createMediaCard(media, player.playerMediaId)));
      count.textContent = `${items.length} ASSET${items.length === 1 ? "" : "S"}`;
      if (!items.length) setEmpty("此分类暂无已授权照片。完成供应商授权或管理员上传审核后会自动出现在这里。");
    } catch (error) {
      if (error.name === "AbortError") return;
      console.warn("Unable to load player media", error);
      setEmpty("影像库暂时不可用。你仍可使用“上传照片”，现有卡牌不会受到影响。");
    }
  }

  function openModal() {
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("player-media-opened");
    loadMedia();
    modal.querySelector(".player-media-close")?.focus();
  }

  function closeModal() {
    requestController?.abort();
    modal.hidden = true;
    document.body.classList.remove("player-media-opened");
    lastFocused?.focus?.();
  }

  openButton.addEventListener("click", openModal);
  modal.querySelectorAll("[data-player-media-close]").forEach((button) => button.addEventListener("click", closeModal));
  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-media-category]");
    if (!button) return;
    activeCategory = button.dataset.mediaCategory;
    tabs.querySelectorAll("[data-media-category]").forEach((tab) => tab.classList.toggle("active", tab === button));
    loadMedia();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });
})();
