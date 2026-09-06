import confetti from "../assets/vendor/canvas-confetti/confetti.module.mjs";

const palettes = {
  silver: ["#eef6ff", "#a7bed4", "#ffffff"],
  neon: ["#59d5e0", "#9b7bff", "#58f5b8"],
  gold: ["#f4c96b", "#fff1c4", "#c7903b"],
  black: ["#b478ff", "#e1e8ee", "#f4c96b"]
};

// One bounded engine per pack session; all exits share the same abort signal.
export class PackCelebration {
  constructor(canvas, signal) {
    this.canvas = canvas;
    this.destroyed = false;
    this.stopTimer = null;
    this.motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.fire = confetti.create(canvas, { resize: true, useWorker: false, disableForReducedMotion: true });
    this.onMotion = () => {
      clearTimeout(this.stopTimer);
      this.fire.reset();
      // Upstream caches the preference when creating a cannon. Refresh it
      // when motion is enabled again within the same pack session.
      if (!this.motion.matches) this.fire = confetti.create(canvas, { resize: true, useWorker: false, disableForReducedMotion: true });
    };
    this.motion.addEventListener("change", this.onMotion);
    signal.addEventListener("abort", () => this.destroy(), { once: true });
    if (signal.aborted) this.destroy();
  }

  burstAt(element, rarity = "silver", count = 64, y = 0.5) {
    if (this.destroyed || this.motion.matches || document.hidden) return;
    const bounds = this.canvas.getBoundingClientRect();
    const target = element.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const origin = {
      x: Math.max(0, Math.min(1, (target.left + target.width / 2 - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (target.top + target.height * y - bounds.top) / bounds.height))
    };
    const particleCount = Math.round(count * (window.innerWidth < 700 ? 0.65 : 1));
    // Upstream measures lifetime in frames. Bound wall-clock duration as well
    // so a busy GPU cannot stretch a burst indefinitely.
    clearTimeout(this.stopTimer);
    this.stopTimer = window.setTimeout(() => this.fire.reset(), 2800);
    const options = {
      origin, particleCount, colors: palettes[rarity] || palettes.silver,
      spread: 76, startVelocity: 26, gravity: 0.8, decay: 0.93,
      ticks: 100, scalar: 0.85, shapes: ["square", "circle"],
      disableForReducedMotion: true
    };
    if (rarity === "gold") {
      // Champagne fans frame the card instead of obscuring its portrait.
      this.fire({ ...options, particleCount: Math.ceil(particleCount / 2), angle: 55 });
      this.fire({ ...options, particleCount: Math.floor(particleCount / 2), angle: 125 });
    } else if (rarity === "black") {
      this.fire({ ...options, spread: 360, startVelocity: 20, gravity: 0.35, shapes: ["star", "circle"], ticks: 110 });
    } else {
      this.fire({ ...options, ...(rarity === "neon" ? { shapes: ["star", "circle"], gravity: 0.55 } : {}) });
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    clearTimeout(this.stopTimer);
    this.fire.reset();
    this.motion.removeEventListener("change", this.onMotion);
  }
}
