// Card Builder — Pack opening experience
import { STYLE_META } from "./constants.js";
import { $, clamp, sleep, showToast } from "./utils.js";
import { app } from "./app-core.js";
import { PackCelebration } from "./pack-celebration.js";

export let packPhase = "sealed";
export let packTearProgress = 0;
export let packAbortController = null;
export let packDust = null;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const rarityNames = { base: "BASE", silver: "SILVER", rwb: "TRICOLOR", neon: "NEON HIT", gold: "GOLD HIT", black: "BLACK LABEL" };

function sessionTimeout(signal, callback, delay) {
  if (signal.aborted) return;
  const cancel = () => clearTimeout(timer);
  const timer = window.setTimeout(() => {
    signal.removeEventListener("abort", cancel);
    if (!signal.aborted) callback();
  }, delay);
  signal.addEventListener("abort", cancel, { once: true });
}

function packFlash(className, signal) {
  if (signal?.aborted || reducedMotion()) return;
  const flash = document.createElement("div");
  flash.className = className;
  flash.setAttribute("aria-hidden", "true");
  $("#packOpening").appendChild(flash);
  const remove = () => flash.remove();
  signal.addEventListener("abort", remove, { once: true });
  sessionTimeout(signal, () => { remove(); signal.removeEventListener("abort", remove); }, 700);
}


// 零依赖浮尘粒子：缓慢上浮 + 横向漂移 + 呼吸闪烁，营造舞台尘埃氛围
class PackDust {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.particles = [];
    this.stars = [];
    this.animId = null;
    this.w = 0;
    this.h = 0;
    this.colors = ["#d8f7fb", "#c8a2ff", "#ffd666", "#e8f4ff", "#59d5e0"];
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  resize() {
    const p = this.canvas?.parentElement;
    if (!p) return;
    const r = p.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = r.width * dpr;
    this.canvas.height = r.height * dpr;
    this.canvas.style.width = r.width + "px";
    this.canvas.style.height = r.height + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = r.width;
    this.h = r.height;
  }
  start() {
    if (!this.ctx || this.reduced) return;
    this.resize();
    const count = Math.max(40, Math.min(90, Math.round((this.w * this.h) / 22000)));
    this.particles = Array.from({ length: count }, () => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      r: 0.6 + Math.random() * 1.9,
      vy: -(0.08 + Math.random() * 0.26),
      drift: (Math.random() - 0.5) * 0.14,
      phase: Math.random() * Math.PI * 2,
      speed: 0.004 + Math.random() * 0.009,
      o: 0.12 + Math.random() * 0.5,
      c: this.colors[Math.floor(Math.random() * this.colors.length)]
    }));
    // 顶部静态星点：独立呼吸闪烁，增加舞台纵深细节
    this.stars = Array.from({ length: Math.max(10, Math.round(this.w / 130)) }, () => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h * 0.58,
      r: 0.8 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      speed: 0.008 + Math.random() * 0.016,
      o: 0.2 + Math.random() * 0.5
    }));
    if (!this.animId) this._loop();
  }
  _loop() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    for (const s of this.stars) {
      s.phase += s.speed;
      const tw = 0.42 + 0.58 * Math.sin(s.phase);
      ctx.globalAlpha = s.o * tw;
      ctx.fillStyle = "#e8f0ff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of this.particles) {
      p.y += p.vy;
      p.x += p.drift + Math.sin(p.phase) * 0.14;
      p.phase += p.speed;
      if (p.y < -10) { p.y = this.h + 10; p.x = Math.random() * this.w; }
      if (p.x < -10) p.x = this.w + 10;
      if (p.x > this.w + 10) p.x = -10;
      const tw = 0.55 + 0.45 * Math.sin(p.phase * 2);
      ctx.globalAlpha = p.o * tw;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    this.animId = requestAnimationFrame(() => this._loop());
  }
  destroy() {
    if (this.animId) cancelAnimationFrame(this.animId);
    this.animId = null;
    this.particles = [];
    if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

function openPackExperience() {
  const library = app.loadLibrary();
  if (library.cards.length < 3) {
    showToast("卡牌库中至少需要 3 张卡片才能体验拆包", "warning");
    return;
  }
  packAbortController?.abort();
  packAbortController = new AbortController();
  const signal = packAbortController.signal;
  const pack = $("#packOpening");
  const envelope = $("#packEnvelope");
  const container = $("#packCards");
  const closeButton = $("#packCloseBtn");
  const stageEnvelope = $("#packStageEnvelope");
  const confettiCanvas = $("#packConfettiCanvas");
  const cardCount = Math.min(library.cards.length, library.cards.length >= 5 ? 5 : 3);
  const rarityOrder = { base: 0, silver: 1, rwb: 2, neon: 3, gold: 4, black: 5 };
  const cards = [...library.cards].sort(() => Math.random() - 0.5).slice(0, cardCount).sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]);

  pack.hidden = false;
  packPhase = "sealed";
  packTearProgress = 0;
  $("#packSeries").textContent = STYLE_META[cards.at(-1).style]?.name || "CUSTOM EDITION";
  envelope.style.cssText = "";
  envelope.className = "pack-envelope idle-wobble";
  envelope.dataset.frame = "1";
  stageEnvelope.hidden = false;
  stageEnvelope.style.opacity = "";
  stageEnvelope.style.transition = "";
  container.replaceChildren();
  container.style.display = "none";
  closeButton.classList.remove("visible");
  envelope.focus();

  // confetti engine
  const confetti = new PackCelebration(confettiCanvas, signal);
  const progress = $("#packRevealStatus");
  progress.hidden = true;
  progress.textContent = "";
  $("#packExitBtn").addEventListener("click", closePackExperience, { signal });

  // ambient dust engine
  packDust = new PackDust($("#packDust"));
  packDust.resize();
  packDust.start();
  const dust = packDust;
  signal.addEventListener("abort", () => dust.destroy(), { once: true });
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  motionQuery.addEventListener("change", () => {
    dust.destroy();
    dust.reduced = motionQuery.matches;
    if (!dust.reduced) dust.start();
    else pack.querySelectorAll(".pack-split-flash, .pack-flash-overlay, .pack-rarity-flash").forEach(node => node.remove());
  }, { signal });

  // backdrop spotlight follows pointer (smoothed by CSS transition)
  const spotlight = pack.querySelector(".pack-spotlight");
  pack.addEventListener("pointermove", (e) => {
    if (!spotlight || reducedMotion()) return;
    const rect = pack.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    spotlight.style.backgroundPosition = `center, ${x.toFixed(2)}% ${y.toFixed(2)}%`;
  }, { signal });

  // Confetti manages its own resize listener; keep the ambient canvas sharp.
  window.addEventListener("resize", () => {
    packDust?.resize();
  }, { signal });

  // mouse-follow tilt + foil sheen
  const onPackMove = (e) => {
    if (reducedMotion()) return;
    const rect = envelope.getBoundingClientRect();
    envelope.style.setProperty("--pack-mx", ((e.clientX - rect.left) / rect.width).toFixed(3));
    envelope.style.setProperty("--pack-my", ((e.clientY - rect.top) / rect.height).toFixed(3));
  };
  const onPackLeave = () => {
    envelope.style.setProperty("--pack-mx", "0.5");
    envelope.style.setProperty("--pack-my", "0.5");
  };
  envelope.addEventListener("pointermove", onPackMove, { signal });
  envelope.addEventListener("pointerleave", onPackLeave, { signal });

  let dragStartY = 0;

  const finishOpening = async () => {
    if (signal.aborted || ["opened", "revealing", "done"].includes(packPhase)) return;
    packPhase = "opened";
    packTearProgress = 1;
    envelope.classList.remove("tearing", "tear-critical", "idle-wobble");
    envelope.classList.add("split-open");

    // confetti burst from pack center
    confetti.burstAt(envelope, "silver", 70, 0.35);

    // full-screen flash
    packFlash("pack-split-flash", signal);

    await sleep(reducedMotion() ? 0 : 580);
    if (signal.aborted) return;
    await revealPackCards(cards, envelope, container, closeButton, confetti, signal);
  };

  // --- drag to tear ---
  envelope.addEventListener("pointerdown", (event) => {
    if (packPhase !== "sealed") return;
    dragStartY = event.clientY;
    packPhase = "tearing";
    envelope.classList.remove("idle-wobble");
    envelope.classList.add("tearing");
    envelope.setPointerCapture?.(event.pointerId);
  }, { signal });

  envelope.addEventListener("pointermove", (event) => {
    if (packPhase !== "tearing") return;
    packTearProgress = clamp((event.clientY - dragStartY) / 200, 0, 1);

    // map progress to frames 1→5
    const frame = 1 + Math.min(4, Math.floor(packTearProgress * 5));
    envelope.dataset.frame = String(frame);

    // rotate slightly as tearing progresses
    if (!reducedMotion()) envelope.style.transform = `perspective(800px) rotateZ(${packTearProgress * 1.5}deg) scale(${1 + packTearProgress * 0.02})`;

    if (packTearProgress >= 0.7) {
      envelope.classList.add("tear-critical");
      // micro sparks near the tear point
      if (Math.random() > 0.6) {
        confetti.burstAt(envelope, "silver", 3, packTearProgress);
      }
    }
    if (packTearProgress >= 0.98) finishOpening();
  }, { signal });

  const cancelTear = () => {
    if (packPhase !== "tearing") return;
    packPhase = "sealed";
    packTearProgress = 0;
    envelope.classList.remove("tearing", "tear-critical");
    envelope.classList.add("idle-wobble");
    envelope.dataset.frame = "1";
    envelope.style.transform = "";
  };
  envelope.addEventListener("pointercancel", cancelTear, { signal });
  envelope.addEventListener("pointerup", () => {
    if (packPhase !== "tearing") return;
    if (packTearProgress >= 0.72) { finishOpening(); return; }
    // snap back
    cancelTear();
  }, { signal });

  envelope.addEventListener("keydown", (event) => {
    if (packPhase === "sealed" && ["Enter", " "].includes(event.key)) { event.preventDefault(); finishOpening(); }
  }, { signal });

  // --- flash open button: instant burst ---
  $("#packFlashOpenBtn")?.addEventListener("click", async () => {
    if (packPhase !== "sealed") return;
    packPhase = "playing";
    envelope.classList.remove("idle-wobble");
    envelope.classList.add("flash-burst");

    // rapid frame cycle
    let f = 1;
    const rapid = reducedMotion() ? null : setInterval(() => {
      if (signal.aborted || reducedMotion()) { clearInterval(rapid); return; }
      f = f >= 5 ? 1 : f + 1;
      envelope.dataset.frame = String(f);
    }, 60);
    const stopRapid = () => clearInterval(rapid);
    signal.addEventListener("abort", stopRapid, { once: true });

    // white flash overlay
    packFlash("pack-flash-overlay", signal);

    // confetti burst immediately
    confetti.burstAt(envelope, "silver", 24, 0.35);

    await sleep(reducedMotion() ? 0 : 380);
    stopRapid();
    signal.removeEventListener("abort", stopRapid);
    if (signal.aborted) return;
    envelope.classList.remove("flash-burst");
    finishOpening();
  }, { signal });

  closeButton.addEventListener("click", () => {
    confetti.destroy();
    closePackExperience();
  }, { signal });
}

async function revealPackCards(cards, envelope, container, closeButton, confetti, signal) {
  const stageEnvelope = $("#packStageEnvelope");
  stageEnvelope.style.transition = "opacity 0.35s ease";
  stageEnvelope.style.opacity = "0";
  await sleep(reducedMotion() ? 0 : 350);
  if (signal.aborted || packPhase !== "opened") return;
  stageEnvelope.hidden = true;
  stageEnvelope.style.opacity = "";
  stageEnvelope.style.transition = "";

  container.style.display = "flex";
  container.innerHTML = cards.map((card, index) => `
    <button class="pack-card-slot rarity-${app.escapeHtml(card.rarity)}" type="button" data-pack-index="${index}" aria-label="翻开第 ${index + 1} 张卡">
      <span class="pack-card-inner">
        <span class="pack-card-face pack-card-face-front">
          <strong>CB</strong>
          <span class="pk-subtitle">ELITE COURT</span>
        </span>
        <span class="pack-card-face pack-card-face-back"><img src="${app.escapeHtml(card.thumbnail)}" alt="${app.escapeHtml(card.name)}"><span class="pack-card-glint" aria-hidden="true"></span></span>
      </span>
      <span class="pack-card-caption" aria-hidden="true"><span>${rarityNames[card.rarity] || "BASE"}</span><strong>${app.escapeHtml(card.name)}</strong></span>
    </button>
  `).join("");

  const slots = container.querySelectorAll(".pack-card-slot");
  slots.forEach((slot, i) => {
    sessionTimeout(signal, () => slot.classList.add("card-entered"), reducedMotion() ? 0 : 100 + i * 100);
  });

  packPhase = "revealing";
  const progress = $("#packRevealStatus");
  progress.hidden = false;
  progress.textContent = `REVEAL YOUR LINEUP · 0 / ${cards.length}`;
  let revealedCount = 0;
  slots.forEach((slot, index) => {
    slot.addEventListener("click", () => {
      const inner = slot.querySelector(".pack-card-inner");
      if (inner.classList.contains("revealed")) return;
      slot.classList.add("flipping");
      sessionTimeout(signal, () => slot.classList.remove("flipping"), reducedMotion() ? 0 : 600);
      inner.classList.add("revealed");
      slot.classList.add("is-revealed");
      slot.setAttribute("aria-label", `${cards[index].name}，已翻开`);
      revealedCount += 1;
      progress.textContent = `REVEAL YOUR LINEUP · ${revealedCount} / ${cards.length}`;

      if (["gold", "black", "neon"].includes(cards[index].rarity)) {
        // Align the celebration with the visible portrait halfway through the flip.
        sessionTimeout(signal, () => {
          flashPackRarity(cards[index].rarity, signal);
          confetti.burstAt(slot, cards[index].rarity, cards[index].rarity === "black" ? 88 : 64);
        }, reducedMotion() ? 0 : 320);
      }

      if (revealedCount === cards.length) {
        packPhase = "done";
        progress.textContent = `LINEUP COMPLETE · ${cards.length} / ${cards.length}`;
        closeButton.classList.add("visible");
        closeButton.focus();
      }
    }, { signal });
  });
  const library = app.loadLibrary();
  library.stats.packsOpened = Number(library.stats.packsOpened || 0) + 1;
  await app.saveLibraryResilient(library);
}

function flashPackRarity(rarity, signal = packAbortController?.signal) {
  if (signal) packFlash(`pack-rarity-flash flash-${rarity}`, signal);
}

function closePackExperience() {
  $("#packOpening").hidden = true;
  packPhase = "sealed";
  packAbortController?.abort();
  packAbortController = null;
  packDust?.destroy();
  packDust = null;
  $("#packMiniBtn")?.focus();
  const envelope = $("#packEnvelope");
  if (envelope) {
    envelope.className = "pack-envelope";
    envelope.style.cssText = "";
    envelope.dataset.frame = "1";
    const stageEnvelope = $("#packStageEnvelope");
    if (stageEnvelope) { stageEnvelope.hidden = false; stageEnvelope.style.opacity = ""; }
  }
}

// ===== END PACK REDESIGN v2 — Elite Court Real Image Pack =====


// Register on app-core
app.openPackExperience = openPackExperience;
app.closePackExperience = closePackExperience;

export { PackDust, openPackExperience, flashPackRarity, closePackExperience };
