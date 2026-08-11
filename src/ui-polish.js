// Card Builder — UI micro-interactions

function createRipple(event) {
  const button = event.currentTarget;
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.4;
  const ripple = document.createElement("span");
  ripple.className = "ui-ripple";
  ripple.style.width = ripple.style.height = size + "px";
  ripple.style.left = (event.clientX - rect.left - size / 2) + "px";
  ripple.style.top = (event.clientY - rect.top - size / 2) + "px";
  button.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
}

function spawnTearParticles(tearElement) {
  const rect = tearElement.getBoundingClientRect();
  for (let i = 0; i < 6; i++) {
    const particle = document.createElement("span");
    particle.className = "ui-tear-particle";
    particle.style.left = (rect.left + Math.random() * rect.width) + "px";
    particle.style.top = (rect.top + rect.height * 0.9) + "px";
    particle.style.setProperty("--dx", (Math.random() - 0.5) * 60 + "px");
    particle.style.setProperty("--dy", -(Math.random() * 40 + 10) + "px");
    document.body.appendChild(particle);
    particle.addEventListener("animationend", () => particle.remove(), { once: true });
  }
}

function flashColorOutput(outputEl) {
  if (!outputEl) return;
  outputEl.classList.remove("ui-color-flash");
  void outputEl.offsetWidth;
  outputEl.classList.add("ui-color-flash");
  outputEl.addEventListener("animationend", () => outputEl.classList.remove("ui-color-flash"), { once: true });
}

document.querySelectorAll(
  ".choice-btn, .effect-btn, .rarity-btn, .slab-btn, " +
  ".badge-grid button, .export-btn, .action-row, " +
  ".workshop-btn, .library-action-btn"
).forEach((btn) => btn.addEventListener("pointerdown", createRipple));




export { createRipple, spawnTearParticles, flashColorOutput };
