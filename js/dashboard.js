// Shared selections for the dashboard's charts and controls.
(() => {
  const lines = ["All", "Red", "Orange", "Blue"];
  const lineButtons = document.querySelectorAll(".line-button[data-line]");
  const resetButton = document.querySelector(".reset-button");
  const notice = document.querySelector(".integration-notice");
  const chartNames = {
    bar: "updateBarChart",
    reliability: "updateReliabilityChart",
    ridership: "updateRidershipChart"
  };
  const chartUpdates = new Map();
  const failedCharts = new Set();

  window.dashboardState = {
    selectedLine: "All",
    startDate: null,
    endDate: null
  };

  function updateButtons() {
    lineButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.line === window.dashboardState.selectedLine));
    });
  }

  function snapshotState() {
    const { selectedLine, startDate, endDate } = window.dashboardState;
    return {
      selectedLine,
      startDate: startDate === null ? null : new Date(startDate.getTime()),
      endDate: endDate === null ? null : new Date(endDate.getTime())
    };
  }

  function updateNotice() {
    const pending = Object.keys(chartNames).filter((name) => !chartUpdates.has(name));
    const messages = [];
    if (pending.length) {
      messages.push(`Chart linking is in progress: ${pending.join(", ")}.`);
    }
    if (failedCharts.size) {
      messages.push(`Could not update: ${Array.from(failedCharts).join(", ")}. See the browser console.`);
    }
    notice.textContent = messages.join(" ");
    notice.hidden = messages.length === 0;
  }

  function updateChart(name, update) {
    try {
      update(snapshotState());
      failedCharts.delete(name);
    } catch (error) {
      failedCharts.add(name);
      console.error(`Could not update the ${name} chart.`, error);
    }
  }

  function notifyCharts() {
    chartUpdates.forEach((update, name) => updateChart(name, update));
    updateNotice();
  }

  window.registerDashboardChart = (name) => {
    if (!Object.hasOwn(chartNames, name)) {
      throw new TypeError(`Invalid dashboard chart: ${name}`);
    }
    const update = window[chartNames[name]];
    if (typeof update !== "function") {
      throw new TypeError(`${chartNames[name]} must be a function before registering ${name}.`);
    }
    chartUpdates.set(name, update);
    updateChart(name, update);
    updateNotice();
  };

  window.selectLine = (line) => {
    if (!lines.includes(line)) {
      throw new TypeError(`Invalid subway line: ${line}`);
    }

    window.dashboardState.selectedLine =
      line !== "All" && line === window.dashboardState.selectedLine ? "All" : line;
    updateButtons();
    notifyCharts();
  };

  window.selectDateRange = (startDate, endDate) => {
    if (startDate === null && endDate === null) {
      if (window.dashboardState.startDate === null && window.dashboardState.endDate === null) return;
      window.dashboardState.startDate = null;
      window.dashboardState.endDate = null;
      notifyCharts();
      return;
    }

    const validMonth = (value) =>
      value instanceof Date && !Number.isNaN(value.getTime()) && value.getDate() === 1;
    if (!validMonth(startDate) || !validMonth(endDate)) {
      throw new TypeError("Dates must both be valid Date objects on the first day of a month, or both null.");
    }
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    if (start > end) {
      throw new RangeError("The start month must not be after the end month.");
    }
    if (window.dashboardState.startDate?.getTime() === start.getTime() &&
        window.dashboardState.endDate?.getTime() === end.getTime()) return;
    window.dashboardState.startDate = start;
    window.dashboardState.endDate = end;
    notifyCharts();
  };

  window.resetDashboard = () => {
    window.dashboardState.selectedLine = "All";
    window.dashboardState.startDate = null;
    window.dashboardState.endDate = null;
    updateButtons();
    notifyCharts();
  };

  lineButtons.forEach((button) => {
    button.addEventListener("click", () => window.selectLine(button.dataset.line));
  });
  resetButton.addEventListener("click", window.resetDashboard);
  updateButtons();
  updateNotice();
})();
