// Ridership timeline chart. Keep chart-specific state inside this IIFE.
(() => {
  const colors = {
    Red: "#DA291C",
    Orange: "#ED8B00",
    Blue: "#003DA5"
  };
  const DATA_PATH = "data/ridershipRecovery.csv";
  const VIEW_B_START = new Date(2022, 0, 1);
  const VIEW_B_END = new Date(2026, 7, 1);
  const parseDate = d3.timeParse("%Y-%m-%d");
  let currentState = {
    selectedLine: "All",
    startDate: null,
    endDate: null
  };
  let loadedData = [];
  let shadeSelection = null;
  let linePaths = null;
  let chartX = null;
  let chartY = null;
  let chartWidth = null;
  let pendingState = null;

  function showError(message) {
    const container = d3.select("#ridership-chart");
    container.selectAll("*").remove();
    container
      .append("p")
      .attr("class", "chart-error")
      .attr("role", "alert")
      .text(message);
  }

  function applyState(state) {
    currentState = state;
    if (!linePaths || !shadeSelection) {
      pendingState = state;
      return;
    }
    pendingState = null;
    if (linePaths) {
      linePaths
        .classed("selected-line", (datum) =>
          state.selectedLine !== "All" && datum[0].line === state.selectedLine
        )
        .classed("faded-line", (datum) =>
          state.selectedLine !== "All" && datum[0].line !== state.selectedLine
        );
    }
    if (!state.startDate || !state.endDate) {
      shadeSelection.attr("display", "none");
      return;
    }
    const start = new Date(state.startDate.getFullYear(), state.startDate.getMonth(), 1);
    const endExclusive = new Date(state.endDate.getFullYear(), state.endDate.getMonth() + 1, 1);
    const xStart = chartX(start);
    const xEnd = chartX(endExclusive);
    shadeSelection
      .attr("display", null)
      .attr("x", Math.max(0, Math.min(chartWidth, xStart)))
      .attr("width", Math.max(0, Math.min(chartWidth, xEnd) - Math.max(0, Math.min(chartWidth, xStart))));
  }

  window.updateRidershipChart = applyState;

  function drawRidershipChart(data) {
    const container = d3.select("#ridership-chart");
    container.selectAll("*").remove();

    const tooltip = container.append("div")
      .attr("class", "ridership-tooltip")
      .attr("role", "tooltip");

    const width = 960;
    const height = 480;
    const margin = { top: 46, right: 144, bottom: 58, left: 78 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    chartWidth = innerWidth;

    const availableDates = d3.extent(data, (row) => row.date);
    const endDate = availableDates[1] < VIEW_B_END ? availableDates[1] : VIEW_B_END;
    const x = d3.scaleTime()
      .domain([VIEW_B_START, endDate])
      .range([0, innerWidth]);
    chartX = x;

    const pctExtent = d3.extent(data, (row) => row.recoveryPct);
    let yMin = Math.floor(Math.min(40, pctExtent[0] - 5) / 20) * 20;
    let yMax = Math.ceil(Math.max(100, pctExtent[1] + 5) / 20) * 20;
    yMin = Math.min(yMin, 40);
    yMax = Math.max(yMax, 120);
    const y = d3.scaleLinear().domain([yMin, yMax]).nice().range([innerHeight, 0]);
    chartY = y;

    const svg = container.append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMinYMin meet")
      .attr("role", "img")
      .attr("aria-label", "MBTA subway ridership recovery relative to 2019");

    const chart = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    chart.append("g")
      .attr("class", "gridlines")
      .call(d3.axisLeft(y).ticks(6).tickSize(-innerWidth).tickFormat(""));

    chart.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat("%Y")));

    chart.append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(y).ticks(6).tickFormat((value) => `${value}%`));

    chart.append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -58)
      .attr("text-anchor", "middle")
      .text("Ridership recovery");

    chart.append("line")
      .attr("class", "reference-line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", y(100))
      .attr("y2", y(100));

    chart.append("text")
      .attr("class", "reference-label")
      .attr("x", innerWidth - 4)
      .attr("y", y(100) - 7)
      .attr("text-anchor", "end")
      .text("2019 ridership level");

    shadeSelection = chart.append("rect")
      .attr("class", "brush-shade")
      .attr("y", 0)
      .attr("height", innerHeight)
      .attr("display", "none");

    const line = d3.line()
      .defined((row) => Number.isFinite(row.recoveryPct))
      .x((row) => x(row.date))
      .y((row) => y(row.recoveryPct));

    linePaths = chart.selectAll(".ridership-line")
      .data(["Red", "Orange", "Blue"].map((lineName) =>
        data.filter((row) => row.line === lineName)
          .sort((a, b) => a.date - b.date)
      ))
      .join("path")
      .attr("class", (datum) => `ridership-line ${datum[0].line.toLowerCase()}-line`)
      .attr("stroke", (datum) => colors[datum[0].line])
      .attr("d", line);

    chart.selectAll(".ridership-point")
      .data(data)
      .join("circle")
      .attr("class", "ridership-point")
      .attr("cx", (datum) => x(datum.date))
      .attr("cy", (datum) => y(datum.recoveryPct))
      .attr("r", 9)
      .attr("fill", (datum) => colors[datum.line])
      .attr("fill-opacity", 0)
      .attr("stroke", "transparent")
      .attr("stroke-width", 0)
      .style("pointer-events", "none");

    const guide = chart.append("line")
      .attr("class", "ridership-guide")
      .attr("y1", 0)
      .attr("y2", innerHeight)
      .attr("display", "none")
      .style("pointer-events", "none");

    const hoverDots = chart.append("g")
      .attr("class", "ridership-hover-dots")
      .style("pointer-events", "none");

    const dates = Array.from(new Set(data.map((row) => row.date.getTime())))
      .map((timestamp) => new Date(timestamp))
      .sort((a, b) => a - b);
    const bisectDate = d3.bisector((date) => date).center;

    const positionTooltip = (event) => {
      const pos = d3.pointer(event, container.node());
      tooltip.classed("visible", true);
      const tooltipWidth = tooltip.node().offsetWidth;
      const tooltipHeight = tooltip.node().offsetHeight;
      const containerWidth = container.node().clientWidth;
      const containerHeight = container.node().clientHeight;
      let left = pos[0] + 12;
      let top = pos[1] - tooltipHeight - 12;
      if (left + tooltipWidth > containerWidth - 8) left = pos[0] - tooltipWidth - 12;
      if (left < 8) left = 8;
      if (top < 8) top = pos[1] + 12;
      if (top + tooltipHeight > containerHeight - 8) top = containerHeight - tooltipHeight - 8;
      tooltip.style("left", `${Math.max(8, left)}px`).style("top", `${Math.max(8, top)}px`);
    };

    const overlay = chart.append("rect")
      .attr("class", "ridership-overlay")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .attr("fill", "transparent");

    const handleMousemove = (event) => {
      const pointer = d3.pointer(event, chart.node());
      const hoveredDate = bisectDate(dates, x.invert(pointer[0]));
      const nearestDate = dates[hoveredDate];
      if (!nearestDate) return;

      const nearestX = x(nearestDate);
      guide.attr("display", null).attr("x1", nearestX).attr("x2", nearestX);

      const visibleLines = currentState.selectedLine === "All"
        ? ["Red", "Orange", "Blue"]
        : [currentState.selectedLine];
      const rows = visibleLines.map((lineName) => {
        const row = data.find((datum) =>
          datum.line === lineName && datum.date.getTime() === nearestDate.getTime()
        );
        return row ? { line: lineName, row } : null;
      }).filter(Boolean);

      const formatPercent = d3.format(".1f");
      tooltip.html(
        `<strong>${d3.timeFormat("%b %Y")(nearestDate)}</strong>` +
        rows.map(({ line: lineName, row }) =>
          `<br>${lineName} ${formatPercent(row.recoveryPct)}%`
        ).join("") +
        `<br><small>of the same month in 2019</small>`
      );
      positionTooltip(event);

      hoverDots.selectAll("circle")
        .data(rows, (datum) => datum.line)
        .join("circle")
        .attr("class", (datum) => `ridership-hover-dot ${datum.line.toLowerCase()}-dot`)
        .attr("cx", nearestX)
        .attr("cy", (datum) => y(datum.row.recoveryPct))
        .attr("r", 4)
        .attr("fill", (datum) => colors[datum.line])
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5);
    };

    const handleMouseleave = () => {
      tooltip.classed("visible", false);
      guide.attr("display", "none");
      hoverDots.selectAll("*").remove();
    };

    const handleOverlayClick = (event) => {
      const pointer = d3.pointer(event, chart.node());
      const hoveredDate = bisectDate(dates, x.invert(pointer[0]));
      const nearestDate = dates[hoveredDate];
      if (!nearestDate) return;

      let nearestLine = null;
      let nearestDistance = Infinity;
      ["Red", "Orange", "Blue"].forEach((lineName) => {
        const row = data.find((datum) =>
          datum.line === lineName && datum.date.getTime() === nearestDate.getTime()
        );
        if (!row) return;
        const distance = Math.abs(pointer[1] - y(row.recoveryPct));
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestLine = lineName;
        }
      });
      if (nearestLine && nearestDistance <= 14) {
        window.selectLine(nearestLine);
      }
    };

    overlay
      .on("mousemove", handleMousemove)
      .on("mouseleave", handleMouseleave)
      .on("click", handleOverlayClick);

    chart.selectAll(".ridership-hit-line")
      .data(["Red", "Orange", "Blue"].map((lineName) =>
        data.filter((row) => row.line === lineName).sort((a, b) => a.date - b.date)
      ))
      .join("path")
      .attr("class", (datum) => `ridership-hit-line ${datum[0].line.toLowerCase()}-hit-line`)
      .attr("d", line)
      .on("mousemove", handleMousemove)
      .on("mouseleave", handleMouseleave)
      .on("click", (event, datum) => {
        event.stopPropagation();
        window.selectLine(datum[0].line);
      });

    Object.entries(colors).forEach(([lineName, color], index) => {
      const legend = svg.append("g")
        .attr("class", "ridership-legend")
        .attr("transform", `translate(${margin.left + index * 138},20)`)
        .style("cursor", "pointer")
        .on("click", () => window.selectLine(lineName));
      legend.append("line")
        .attr("x1", 0)
        .attr("x2", 24)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", color)
        .attr("stroke-width", 3);
      legend.append("text")
        .attr("x", 31)
        .attr("y", 4)
        .text(`${lineName} Line`);
    });

    if (availableDates[1] < VIEW_B_END) {
      container.append("p")
        .attr("class", "chart-note")
        .text(`The source ends in ${d3.timeFormat("%B %Y")(availableDates[1])}; later months are not estimated.`);
    }

    if (pendingState) applyState(pendingState);
    if (typeof window.registerDashboardChart === "function") {
      window.registerDashboardChart("ridership");
    } else {
      window.addEventListener("DOMContentLoaded", () => {
        if (typeof window.registerDashboardChart === "function") {
          window.registerDashboardChart("ridership");
        }
      }, { once: true });
    }
  }

  d3.text(DATA_PATH)
    .then((text) => d3.csvParse(text.replace(/^\uFEFF/, "").trimStart(), (row) => ({
      date: parseDate(row.date),
      line: row.line,
      avgDailyRidership: Number(row.avg_daily_ridership),
      baseline2019: Number(row.baseline_2019),
      recoveryPct: Number(row.recovery_pct)
    })))
    .then((data) => {
      loadedData = data.filter((row) =>
        row.date &&
        ["Red", "Orange", "Blue"].includes(row.line) &&
        Number.isFinite(row.recoveryPct) &&
        row.date >= VIEW_B_START &&
        row.date <= VIEW_B_END
      );
      if (!loadedData.length) {
        showError("No ridership recovery data is available for the displayed date range.");
        return;
      }
      const invalid = loadedData.some((row) =>
        !row.date ||
        !["Red", "Orange", "Blue"].includes(row.line) ||
        !Number.isFinite(row.recoveryPct)
      );
      if (invalid) {
        showError("The ridership recovery data contains missing or invalid values.");
        return;
      }
      drawRidershipChart(loadedData);
    })
    .catch((error) => {
      showError("The ridership chart could not be loaded. No source values were substituted.");
      console.error("Could not load ridership recovery data.", error);
    });
})();