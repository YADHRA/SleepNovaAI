/* ==========================================================================
   SLEEP QUALITY PREDICTOR — CLIENT SCRIPT
   Sections: Utils, Navbar, Scroll Reveal, Stat Counters, Toasts, Charts,
             Prediction Flow, Init
   ========================================================================== */

(() => {
  "use strict";

  /* ---------------------------- Utils ------------------------------------ */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const cssVar = (name) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const COLORS = {
    gold: () => cssVar("--gold") || "#d4af37",
    goldSoft: () => cssVar("--gold-soft") || "#e8cf7a",
    good: () => cssVar("--good") || "#4fae7c",
    average: () => cssVar("--average") || "#d9a441",
    poor: () => cssVar("--poor") || "#d9614a",
    text: () => cssVar("--text-secondary") || "#b8ab97",
    grid: () => "rgba(242, 232, 216, 0.08)",
  };

  const CLASS_COLOR = {
    Good: COLORS.good,
    Average: COLORS.average,
    Poor: COLORS.poor,
  };

  /* Local session history mirrors backend /history, used to drive charts */
  const sessionHistory = [];

  /* ---------------------------- Navbar scroll ----------------------------- */
  const navbar = $("#navbar");
  const onScroll = () => {
    if (window.scrollY > 40) navbar.classList.add("scrolled");
    else navbar.classList.remove("scrolled");
    updateActiveNavLink();
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------------------------- Mobile nav toggle -------------------------- */
  const navToggle = $("#navToggle");
  const navLinks = $("#navLinks");
  navToggle.addEventListener("click", () => {
    navLinks.classList.toggle("open");
  });
  $$(".nav-link").forEach((link) =>
    link.addEventListener("click", () => navLinks.classList.remove("open"))
  );

  function updateActiveNavLink() {
    const sections = ["home", "features", "predict", "statistics", "about", "contact"];
    const scrollPos = window.scrollY + 140;
    let current = sections[0];
    for (const id of sections) {
      const el = document.getElementById(id);
      if (el && el.offsetTop <= scrollPos) current = id;
    }
    $$(".nav-link").forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === `#${current}`);
    });
  }

  /* ---------------------------- Scroll reveal (AOS) ------------------------ */
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("aos-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  $$("[data-aos]").forEach((el) => revealObserver.observe(el));

  /* ---------------------------- Animated stat counters ---------------------- */
  function animateCounter(el) {
    const target = parseInt(el.dataset.count, 10) || 0;
    const duration = 1400;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target).toLocaleString();
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const statObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          statObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );
  $$(".stat-num").forEach((el) => statObserver.observe(el));

  /* ---------------------------- Stress slider live value -------------------- */
  const stressSlider = $("#stress_level");
  const stressValue = $("#stressValue");
  stressSlider.addEventListener("input", () => {
    stressValue.textContent = stressSlider.value;
  });

  /* ---------------------------- Toast notifications -------------------------- */
  const toastContainer = $("#toastContainer");

  function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const icon = type === "success" ? "fa-circle-check success-icon" : "fa-circle-exclamation error-icon";
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("hide");
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  /* ---------------------------- Form validation ------------------------------ */
  function validateForm(form) {
    const requiredFields = $$("[required]", form);
    for (const field of requiredFields) {
      if (!field.value || (field.type === "number" && field.value.trim() === "")) {
        field.focus();
        showToast(`Please fill in all required fields.`, "error");
        return false;
      }
      if (field.type === "number") {
        const val = parseFloat(field.value);
        const min = field.min !== "" ? parseFloat(field.min) : -Infinity;
        const max = field.max !== "" ? parseFloat(field.max) : Infinity;
        if (isNaN(val) || val < min || val > max) {
          field.focus();
          showToast(`"${field.previousElementSibling?.textContent?.trim() || field.name}" is out of range.`, "error");
          return false;
        }
      }
    }
    return true;
  }

  /* ---------------------------- Collect form payload -------------------------- */
  function collectPayload(form) {
    const interruption = form.querySelector('input[name="sleep_interruptions"]:checked');
    return {
      sleep_duration: parseFloat($("#sleep_duration").value),
      bedtime: $("#bedtime").value,
      wake_time: $("#wake_time").value,
      exercise_duration: parseFloat($("#exercise_duration").value),
      screen_time: parseFloat($("#screen_time").value),
      caffeine_intake: $("#caffeine_intake").value,
      mood: $("#mood").value,
      water_intake: parseFloat($("#water_intake").value),
      daily_steps: parseFloat($("#daily_steps").value),
      age: parseFloat($("#age").value),
      gender: $("#gender").value,
      bmi: parseFloat($("#bmi").value),
      stress_level: parseFloat(stressSlider.value),
      sleep_interruptions: interruption ? interruption.value : "No",
    };
  }

  /* ---------------------------- Result rendering ------------------------------ */
  const resultEmpty = $("#resultEmpty");
  const resultBody = $("#resultBody");
  const gaugeFill = $("#gaugeFill");
  const gaugeScore = $("#gaugeScore");
  const resultLabel = $("#resultLabel");
  const resultConfidence = $("#resultConfidence");
  const probBars = $("#probBars");
  const suggestionsList = $("#suggestionsList");

  const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 85; // r=85, matches CSS

  function renderResult(data) {
    resultEmpty.hidden = true;
    resultBody.hidden = false;

    // Gauge
    const offset = GAUGE_CIRCUMFERENCE - (data.sleep_score / 100) * GAUGE_CIRCUMFERENCE;
    gaugeFill.style.stroke = CLASS_COLOR[data.prediction] ? CLASS_COLOR[data.prediction]() : COLORS.gold();
    requestAnimationFrame(() => {
      gaugeFill.style.strokeDashoffset = offset;
    });
    animateNumber(gaugeScore, 0, data.sleep_score, 900);

    // Label
    resultLabel.textContent = data.prediction.toUpperCase();
    resultLabel.className = `result-label ${data.prediction.toLowerCase()}`;

    // Confidence
    resultConfidence.textContent = `${data.confidence}%`;

    // Probability bars
    probBars.innerHTML = "";
    Object.entries(data.class_probabilities).forEach(([cls, pct]) => {
      const colorFn = CLASS_COLOR[cls] || COLORS.gold;
      const row = document.createElement("div");
      row.className = "prob-bar-row";
      row.innerHTML = `
        <span class="prob-bar-name">${cls}</span>
        <span class="prob-bar-track"><span class="prob-bar-fill" style="width:0%; background:${colorFn()}"></span></span>
        <span class="prob-bar-pct">${pct}%</span>
      `;
      probBars.appendChild(row);
      requestAnimationFrame(() => {
        row.querySelector(".prob-bar-fill").style.width = `${pct}%`;
      });
    });

    // Suggestions
    suggestionsList.innerHTML = "";
    data.suggestions.forEach((tip) => {
      const li = document.createElement("li");
      li.textContent = tip;
      suggestionsList.appendChild(li);
    });
  }

  function animateNumber(el, from, to, duration) {
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function resetResult() {
    resultBody.hidden = true;
    resultEmpty.hidden = false;
    gaugeFill.style.strokeDashoffset = GAUGE_CIRCUMFERENCE;
    gaugeScore.textContent = "0";
  }

  /* ---------------------------- Charts (Chart.js) ------------------------------ */
  let gaugeChart, trendChart, lifestyleChart, stressChart, screenChart;

  function initCharts() {
    if (typeof Chart === "undefined") {
      console.error("[Charts] Chart.js failed to load from CDN — statistics charts will be unavailable. Check your internet connection or ad-blocker.");
      return;
    }
    console.log("[Charts] Chart.js loaded, version:", Chart.version);

    const gridColor = COLORS.grid();
    const textColor = COLORS.text();
    Chart.defaults.color = textColor;
    Chart.defaults.font.family = "Poppins, sans-serif";

    // Each chart gets its OWN try/catch: one bad config must never
    // prevent the other charts from rendering.
    try {
      gaugeChart = new Chart($("#gaugeChart"), {
        type: "doughnut",
        data: {
          labels: ["Score", "Remaining"],
          datasets: [{
            data: [0, 100],
            backgroundColor: [COLORS.gold(), "rgba(242,232,216,0.06)"],
            borderWidth: 0,
          }],
        },
        options: {
          cutout: "75%",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
        },
      });
    } catch (err) {
      console.error("Gauge chart init failed:", err);
    }

    try {
      trendChart = new Chart($("#trendChart"), {
        type: "line",
        data: {
          labels: [],
          datasets: [{
            label: "Sleep Score",
            data: [],
            borderColor: COLORS.gold(),
            backgroundColor: "rgba(212,175,55,0.15)",
            tension: 0.4,
            fill: true,
            pointBackgroundColor: COLORS.goldSoft(),
            pointRadius: 4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { min: 0, max: 100, grid: { color: gridColor }, ticks: { color: textColor } },
            x: { grid: { display: false }, ticks: { color: textColor } },
          },
        },
      });
    } catch (err) {
      console.error("Trend chart init failed:", err);
    }

    try {
      lifestyleChart = new Chart($("#lifestyleChart"), {
        type: "radar",
        data: {
          labels: ["Sleep Dur.", "Exercise", "Low Screen", "Low Stress", "Hydration"],
          datasets: [{
            label: "Current",
            data: [0, 0, 0, 0, 0],
            borderColor: COLORS.gold(),
            backgroundColor: "rgba(212,175,55,0.18)",
            pointBackgroundColor: COLORS.goldSoft(),
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            r: {
              angleLines: { color: gridColor },
              grid: { color: gridColor },
              pointLabels: { color: textColor, font: { size: 10 } },
              ticks: { display: false, backdropColor: "transparent" },
              min: 0,
              max: 100,
            },
          },
        },
      });
    } catch (err) {
      console.error("Lifestyle chart init failed:", err);
    }

    try {
      stressChart = new Chart($("#stressChart"), {
        type: "scatter",
        data: {
          datasets: [{
            label: "Stress vs Score",
            data: [],
            backgroundColor: COLORS.poor(),
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { title: { display: true, text: "Stress Level", color: textColor }, min: 0, max: 10, grid: { color: gridColor }, ticks: { color: textColor } },
            y: { title: { display: true, text: "Sleep Score", color: textColor }, min: 0, max: 100, grid: { color: gridColor }, ticks: { color: textColor } },
          },
        },
      });
    } catch (err) {
      console.error("Stress chart init failed:", err);
    }

    try {
      screenChart = new Chart($("#screenChart"), {
        type: "scatter",
        data: {
          datasets: [{
            label: "Screen Time vs Score",
            data: [],
            backgroundColor: COLORS.goldSoft(),
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { title: { display: true, text: "Screen Time (min)", color: textColor }, grid: { color: gridColor }, ticks: { color: textColor } },
            y: { title: { display: true, text: "Sleep Score", color: textColor }, min: 0, max: 100, grid: { color: gridColor }, ticks: { color: textColor } },
          },
        },
      });
    } catch (err) {
      console.error("Screen time chart init failed:", err);
    }

    // Safety net: force every chart to recompute its size once the page has
    // fully settled (fonts loaded, layout stable) and again on window resize.
    // This is the standard fix for Chart.js canvases that initialize at 0x0.
    const allCharts = () => [gaugeChart, trendChart, lifestyleChart, stressChart, screenChart];
    console.log("[Charts] Init results:", {
      gaugeChart: !!gaugeChart,
      trendChart: !!trendChart,
      lifestyleChart: !!lifestyleChart,
      stressChart: !!stressChart,
      screenChart: !!screenChart,
    });
    const gaugeCanvas = document.getElementById("gaugeChart");
    if (gaugeCanvas) {
      const rect = gaugeCanvas.getBoundingClientRect();
      console.log("[Charts] gaugeChart canvas size at init:", rect.width, "x", rect.height);
    }
    setTimeout(() => {
      allCharts().forEach((c) => c && c.resize());
      if (gaugeCanvas) {
        const rect2 = gaugeCanvas.getBoundingClientRect();
        console.log("[Charts] gaugeChart canvas size after resize:", rect2.width, "x", rect2.height);
      }
    }, 60);
    window.addEventListener("resize", () => {
      allCharts().forEach((c) => c && c.resize());
    });
  }

  function updateCharts(payload, result) {
    // Guard: if any chart failed to initialize (CDN issue, browser quirk, etc.),
    // skip chart updates silently rather than breaking the prediction flow.
    if (!gaugeChart || !trendChart || !lifestyleChart || !stressChart || !screenChart) {
      console.warn("Skipping chart update — one or more charts are not initialized.");
      return;
    }

    // Gauge chart
    gaugeChart.data.datasets[0].data = [result.sleep_score, 100 - result.sleep_score];
    gaugeChart.data.datasets[0].backgroundColor[0] = CLASS_COLOR[result.prediction]
      ? CLASS_COLOR[result.prediction]()
      : COLORS.gold();
    gaugeChart.update();

    // Weekly trend (last 7 predictions this session)
    const last7 = sessionHistory.slice(-7);
    trendChart.data.labels = last7.map((_, i) => `#${i + 1}`);
    trendChart.data.datasets[0].data = last7.map((h) => h.result.sleep_score);
    trendChart.update();

    // Lifestyle radar — normalize current inputs to 0-100 "good direction" scores
    const sleepDurScore = Math.max(0, Math.min(100, (payload.sleep_duration / 9) * 100));
    const exerciseScore = Math.max(0, Math.min(100, (payload.exercise_duration / 60) * 100));
    const screenScore = Math.max(0, Math.min(100, 100 - (payload.screen_time / 180) * 100));
    const stressScore = Math.max(0, Math.min(100, 100 - (payload.stress_level / 10) * 100));
    const hydrationScore = Math.max(0, Math.min(100, (payload.water_intake / 3.5) * 100));
    lifestyleChart.data.datasets[0].data = [
      sleepDurScore, exerciseScore, screenScore, stressScore, hydrationScore,
    ];
    lifestyleChart.update();

    // Stress vs sleep scatter (accumulate across session)
    stressChart.data.datasets[0].data = sessionHistory.map((h) => ({
      x: h.payload.stress_level,
      y: h.result.sleep_score,
    }));
    stressChart.update();

    // Screen time vs sleep scatter
    screenChart.data.datasets[0].data = sessionHistory.map((h) => ({
      x: h.payload.screen_time,
      y: h.result.sleep_score,
    }));
    screenChart.update();
  }

  /* ---------------------------- Prediction flow --------------------------------- */
  const form = $("#predictForm");
  const predictBtn = $("#predictBtn");
  const btnText = predictBtn.querySelector(".btn-text");
  const btnSpinner = predictBtn.querySelector(".btn-spinner");

  function setLoading(isLoading) {
    predictBtn.disabled = isLoading;
    btnSpinner.hidden = !isLoading;
    btnText.textContent = isLoading ? "Analyzing..." : "Predict";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;

    const payload = collectPayload(form);
    setLoading(true);

    try {
      const res = await fetch("/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Prediction failed. Please try again.");
      }

      renderResult(data);
      sessionHistory.push({ payload, result: data });
      showToast(`Prediction complete: ${data.prediction} sleep quality.`, "success");

      // Chart updates are a visual bonus, not critical — never let them
      // block the success flow or surface a scary error for a real prediction.
      try {
        updateCharts(payload, data);
      } catch (chartErr) {
        console.error("Chart update failed:", chartErr);
      }

      // Smooth scroll to result on small screens
      if (window.innerWidth < 1080) {
        $("#resultCard").scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } catch (err) {
      showToast(err.message || "Something went wrong.", "error");
    } finally {
      setLoading(false);
    }
  });

  form.addEventListener("reset", () => {
    setTimeout(() => {
      stressValue.textContent = stressSlider.value;
      resetResult();
    }, 0);
  });

  /* ---------------------------- Init --------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    $("#year").textContent = new Date().getFullYear();
    initCharts();
    onScroll();
  });
})();