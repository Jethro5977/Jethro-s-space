// Card Builder — Pack opening experience
import { STYLE_META } from "./constants.js";
import { $, clamp, sleep, showToast } from "./utils.js";
import { app } from "./app-core.js";

export let packPhase = "sealed";
export let packTearProgress = 0;
export let packAbortController = null;
export let packDust = null;

class PackConfetti {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.particles = [];
    this.animId = null;
    this.colors = ["#b478ff","#59d5e0","#ffd666","#e85d75","#58dca8","#f4c44e","#8ed6e6","#c8a2ff"];
    this.w = 0;
    this.h = 0;
  }
  resize() {
    const p = this.canvas.parentElement;
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
  burst(x, y, count) {
    if (!this.w) this.resize();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = 3 + Math.random() * 9;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - 4,
        g: 0.10 + Math.random() * 0.08,
        s: 2.5 + Math.random() * 5,
        c: this.colors[Math.floor(Math.random() * this.colors.length)],
        r: Math.random() * 360,
        rs: (Math.random() - 0.5) * 14,
        o: 1,
        d: 0.013 + Math.random() * 0.012,
        sh: ["r","d","s"][Math.floor(Math.random() * 3)],
        t: 0
      });
    }
    if (!this.animId) this._loop();
  }
  _loop() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.g;
      p.vx *= 0.99;
      p.r += p.rs;
      p.o -= p.d;
      p.t++;
      if (p.o <= 0) return false;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r * Math.PI / 180);
      ctx.globalAlpha = p.o;
      ctx.fillStyle = p.c;
      if (p.sh === "r") {
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      } else if (p.sh === "d") {
        ctx.beginPath();
        ctx.moveTo(0, -p.s);
        ctx.lineTo(p.s * 0.55, 0);
        ctx.lineTo(0, p.s);
        ctx.lineTo(-p.s * 0.55, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const rad = (i % 2 === 0 ? p.s : p.s * 0.4);
          const a = (i * Math.PI / 5) - Math.PI / 2;
          ctx[i === 0 ? "moveTo" : "lineTo"](Math.cos(a) * rad, Math.sin(a) * rad);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      return true;
    });
    if (this.particles.length > 0) {
      this.animId = requestAnimationFrame(() => this._loop());
    } else {
      this.animId = null;
    }
  }
  destroy() {
    if (this.animId) cancelAnimationFrame(this.animId);
    this.particles = [];
    this.animId = null;
    if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
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
  container.replaceChildren();
  container.style.display = "none";
  closeButton.classList.remove("visible");
  envelope.focus();

  // confetti engine
  const confetti = new PackConfetti(confettiCanvas);

  // ambient dust engine
  packDust = new PackDust($("#packDust"));
  packDust.resize();
  packDust.start();

  // backdrop spotlight follows pointer (smoothed by CSS transition)
  const spotlight = pack.querySelector(".pack-spotlight");
  pack.addEventListener("pointermove", (e) => {
    if (!spotlight) return;
    const rect = pack.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    spotlight.style.backgroundPosition = `center, ${x.toFixed(2)}% ${y.toFixed(2)}%`;
  }, { signal });

  // keep both canvases sharp if the window is resized mid-open
  window.addEventListener("resize", () => {
    confetti.resize();
    packDust?.resize();
  }, { signal });

  // mouse-follow tilt + foil sheen
  const onPackMove = (e) => {
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
    if (["opened", "revealing", "done"].includes(packPhase)) return;
    packPhase = "opened";
    packTearProgress = 1;
    envelope.classList.remove("tearing", "tear-critical", "idle-wobble");
    envelope.classList.add("split-open");

    // confetti burst from pack center
    const packRect = pack.getBoundingClientRect();
    const envRect = envelope.getBoundingClientRect();
    const cx = envRect.left - packRect.left + envRect.width / 2;
    const cy = envRect.top - packRect.top + envRect.height * 0.35;
    confetti.burst(cx, cy, 80);

    // full-screen flash
    const flash = document.createElement("div");
    flash.className = "pack-split-flash";
    document.body.appendChild(flash);
    window.setTimeout(() => flash.remove(), 700);

    await sleep(580);
    revealPackCards(cards, envelope, container, closeButton, confetti);
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
    envelope.style.transform = `perspective(800px) rotateZ(${packTearProgress * 1.5}deg) scale(${1 + packTearProgress * 0.02})`;

    if (packTearProgress >= 0.7) {
      envelope.classList.add("tear-critical");
      // micro sparks near the tear point
      if (Math.random() > 0.6) {
        const packRect = pack.getBoundingClientRect();
        const envRect = envelope.getBoundingClientRect();
        confetti.burst(
          envRect.left - packRect.left + envRect.width * (0.3 + Math.random() * 0.4),
          envRect.top - packRect.top + envRect.height * packTearProgress,
          3
        );
      }
    }
    if (packTearProgress >= 0.98) finishOpening();
  }, { signal });

  envelope.addEventListener("pointerup", () => {
    if (packPhase !== "tearing") return;
    if (packTearProgress >= 0.72) { finishOpening(); return; }
    // snap back
    packPhase = "sealed";
    packTearProgress = 0;
    envelope.classList.remove("tearing", "tear-critical");
    envelope.classList.add("idle-wobble");
    envelope.dataset.frame = "1";
    envelope.style.transform = "";
  }, { signal });

  envelope.addEventListener("keydown", (event) => {
    if (["Enter", " "].includes(event.key)) { event.preventDefault(); finishOpening(); }
  }, { signal });

  // --- flash open button: instant burst ---
  $("#packFlashOpenBtn")?.addEventListener("click", async () => {
    if (packPhase !== "sealed") return;
    packPhase = "playing";
    envelope.classList.remove("idle-wobble");
    envelope.classList.add("flash-burst");

    // rapid frame cycle
    let f = 1;
    const rapid = setInterval(() => {
      f = f >= 5 ? 1 : f + 1;
      envelope.dataset.frame = String(f);
    }, 60);

    // white flash overlay
    const overlay = document.createElement("div");
    overlay.className = "pack-flash-overlay";
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 650);

    // confetti burst immediately
    const packRect = pack.getBoundingClientRect();
    confetti.burst(packRect.width / 2, packRect.height * 0.38, 100);

    await sleep(380);
    clearInterval(rapid);
    envelope.classList.remove("flash-burst");
    finishOpening();
  }, { signal });

  closeButton.addEventListener("click", () => {
    confetti.destroy();
    closePackExperience();
  }, { signal });
}

async function revealPackCards(cards, envelope, container, closeButton, confetti) {
  const stageEnvelope = $("#packStageEnvelope");
  stageEnvelope.style.transition = "opacity 0.35s ease";
  stageEnvelope.style.opacity = "0";
  await sleep(350);
  if (packPhase !== "opened") return;
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
        <span class="pack-card-face pack-card-face-back"><img src="${app.escapeHtml(card.thumbnail)}" alt="${app.escapeHtml(card.name)}"></span>
      </span>
    </button>
  `).join("");

  const slots = container.querySelectorAll(".pack-card-slot");
  slots.forEach((slot, i) => {
    window.setTimeout(() => slot.classList.add("card-entered"), 150 + i * 120);
  });

  packPhase = "revealing";
  let revealedCount = 0;
  slots.forEach((slot, index) => {
    slot.addEventListener("click", () => {
      const inner = slot.querySelector(".pack-card-inner");
      if (inner.classList.contains("revealed")) return;
      slot.classList.add("flipping");
      slot.addEventListener("animationend", () => slot.classList.remove("flipping"), { once: true });
      inner.classList.add("revealed");
      slot.setAttribute("aria-label", `${cards[index].name}，已翻开`);
      revealedCount += 1;

      if (["gold", "black", "neon"].includes(cards[index].rarity)) {
        flashPackRarity(cards[index].rarity);
        if (confetti) {
          const packRect = $("#packOpening").getBoundingClientRect();
          const slotRect = slot.getBoundingClientRect();
          confetti.burst(
            slotRect.left - packRect.left + slotRect.width / 2,
            slotRect.top - packRect.top + slotRect.height / 2,
            35
          );
        }
      }

      if (revealedCount === cards.length) {
        packPhase = "done";
        closeButton.classList.add("visible");
        closeButton.focus();
      }
    }, { signal: packAbortController.signal });
  });
  const library = app.loadLibrary();
  library.stats.packsOpened = Number(library.stats.packsOpened || 0) + 1;
  await app.saveLibraryResilient(library);
}

function flashPackRarity(rarity) {
  const flash = document.createElement("div");
  flash.className = `pack-rarity-flash flash-${rarity}`;
  document.body.appendChild(flash);
  window.setTimeout(() => flash.remove(), 620);
}

function closePackExperience() {
  $("#packOpening").hidden = true;
  packPhase = "sealed";
  packAbortController?.abort();
  packAbortController = null;
  packDust?.destroy();
  packDust = null;
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

export { PackConfetti, PackDust, openPackExperience, flashPackRarity, closePackExperience };
