import { send, setBusy } from "../assets/ui.js";
import { t, applyI18n, initLanguage } from "../assets/i18n.js";

const TOTAL = 6;

const STEPS = [
  { titleKey: "welcomeStep1Title", bodyKey: "welcomeStep1Body" },
  { titleKey: "welcomeStep2Title", bodyKey: "welcomeStep2Body" },
  { titleKey: "welcomeStep3Title", bodyKey: "welcomeStep3Body" },
  { titleKey: "welcomeStep4Title", bodyKey: "welcomeStep4Body" },
  { titleKey: "welcomeStep5Title", bodyKey: "welcomeStep5Body" },
  { titleKey: "welcomeStep6Title", bodyKey: "welcomeStep6Body" },
];

const nodes = {
  title: document.getElementById("step-title"),
  body: document.getElementById("step-body"),
  counter: document.getElementById("step-counter"),
  announcer: document.getElementById("step-announcer"),
  back: document.getElementById("back"),
  next: document.getElementById("next"),
  skip: document.getElementById("skip"),
  dots: document.getElementById("dots"),
  mascot: document.getElementById("mascot-img"),
};

let step = 0;
let closing = false;

function renderDots() {
  nodes.dots.replaceChildren();
  for (let index = 0; index < TOTAL; index += 1) {
    const dot = document.createElement("li");
    dot.className = `welcome__dot${index === step ? " is-active" : ""}${index < step ? " is-done" : ""}`;
    nodes.dots.append(dot);
  }
}

function render() {
  const current = STEPS[step];
  nodes.title.textContent = t(current.titleKey);
  nodes.body.textContent = t(current.bodyKey);
  nodes.counter.textContent = t("welcomeStepOf", [String(step + 1), String(TOTAL)]);
  nodes.announcer.textContent = `${t("welcomeStepOf", [String(step + 1), String(TOTAL)])}: ${t(current.titleKey)}`;

  nodes.back.disabled = step === 0;
  nodes.skip.hidden = step === TOTAL - 1;
  nodes.next.textContent = step === TOTAL - 1 ? t("welcomeFinish") : t("welcomeNext");

  renderDots();
  nodes.title.focus({ preventScroll: true });
}

function go(delta) {
  step = Math.min(TOTAL - 1, Math.max(0, step + delta));
  render();
}

async function markSeen() {
  await send({ type: "setSetting", key: "onboardingSeen", value: true });
}

async function finish() {
  if (closing) return;
  closing = true;
  setBusy(nodes.next, true, t("welcomeClose"));
  await markSeen();
  window.location.replace("../dashboard/dashboard.html#overview");
}

async function skipTour() {
  if (closing) return;
  closing = true;
  setBusy(nodes.skip, true, t("welcomeClose"));
  await markSeen();
  window.location.replace("../dashboard/dashboard.html#overview");
}

nodes.back.addEventListener("click", () => go(-1));
nodes.next.addEventListener("click", () => {
  if (step === TOTAL - 1) {
    finish();
    return;
  }
  go(1);
});
nodes.skip.addEventListener("click", skipTour);

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    go(-1);
    return;
  }
  if (event.key === "ArrowRight" || event.key === "Enter") {
    event.preventDefault();
    if (step === TOTAL - 1) finish();
    else go(1);
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    skipTour();
  }
});

initLanguage().then(() => {
  applyI18n();
  render();
});
