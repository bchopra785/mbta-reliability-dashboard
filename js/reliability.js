(() => {
  const colors = {
    Red: "#DA291C",
    Orange: "#ED8B00",
    Blue: "#003DA5"
  };
  const lineNames = Object.keys(colors);
  const parseDate = d3.timeParse("%Y-%m-%d");
  const formatMonth = d3.timeFormat("%B %Y");
  let chart = null;
  let x = null;
  let brush = null;
  let brushGroup = null;
  let linePaths = null;
  let currentState = {
    selectedLine: "All",
    startDate: null,
    endDate: null
  };
  let syncingBrush = false;
  let dates = [];

  function applyState(state) {
    currentState = state;
    if (!chart) return;

    linePaths
      .classed("selected-line", (datum) =>
        state.selectedLine !== "All" && datum.line === state.selectedLine
      )
      .classed("faded-line", (datum) =>
        state.selectedLine !== "All" && datum.line !== state.selectedLine
      );

    if (!brushGroup) return;
    const selection = state.startDate && state.endDate
      ? [
        x(state.startDate),
        x(new Date(state.endDate.getFullYear(), state.endDate.getMonth() + 1, 1))
      ]
      : null;
    syncingBrush = true;
    brushGroup.call(brush.move, selection);
    syncingBrush = false;
  }

  window.updateReliabilityChart = applyState;

  function drawChart(rows) {
    const container = d3.select("#reliability-chart");
    const width = 960;
    const height = 480;
    const margin = { top: 54, right: 24, bottom: 58, left: 78 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (rows.length === 0 || rows.some((row) =>
      !row.date || !Number.isFinite(row.excessMinutes) || !colors[row.line]
    )) {
      throw new Error("The monthly reliability data is empty or contains invalid values.");
    }

    dates = Array.from(new Set(rows.map((row) => row.date.getTime())))
      .map((timestamp) => new Date(timestamp))
      .sort((a, b) => a - b);
    const lastDate = dates[dates.length - 1];
    x = d3.scaleTime()
      .domain([dates[0], new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 1)])
      .range([0, innerWidth]);
    const values = d3.extent(rows, (row) => row.excessMinutes);
    const y = d3.scaleLinear()
      .domain([Math.min(0, values[0]), Math.max(0, values[1])])
      .nice()
      .range([innerHeight, 0]);

    container.selectAll("*").remove();
    const tooltip = container.append("div")
      .attr("class", "reliability-tooltip")
      .attr("role", "tooltip")
      .attr("aria-hidden", "true");

    const svg = container
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr(
        "aria-label",
        "Monthly average excess subway trip time for the Red, Orange, and Blue lines from 2022 through August 2026. Drag to select a date range."
      );

    svg
      .append("title")
      .text("Monthly average excess trip time by subway line");

    chart = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    chart
      .append("g")
      .attr("class", "gridlines")
      .call(d3.axisLeft(y).ticks(6).tickSize(-innerWidth).tickFormat(""));

    chart
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(d3.timeYear.every(1))
          .tickFormat(d3.timeFormat("%Y"))
      );

    chart
      .append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(y).ticks(6).tickFormat((value) => `${value} min`));

    chart
      .append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -58)
      .attr("text-anchor", "middle")
      .text("Extra minutes per trip");

    chart
      .append("line")
      .attr("class", "zero-line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", y(0))
      .attr("y2", y(0));

    chart
      .append("text")
      .attr("class", "zero-label")
      .attr("x", innerWidth - 4)
      .attr("y", y(0) - 7)
      .attr("text-anchor", "end")
      .text("0 min benchmark");

    const line = d3
      .line()
      .defined((row) => Number.isFinite(row.excessMinutes))
      .x((row) => x(row.date))
      .y((row) => y(row.excessMinutes));

    linePaths = chart.selectAll(".reliability-line")
      .data(lineNames.map((lineName) => ({
        line: lineName,
        values: rows
          .filter((row) => row.line === lineName)
          .sort((a, b) => a.date - b.date)
      })))
      .join("path")
      .attr("class", (datum) => `reliability-line ${datum.line.toLowerCase()}`)
      .attr("stroke", (datum) => colors[datum.line])
      .attr("d", (datum) => line(datum.values));

    const legend = svg.selectAll(".legend-item")
      .data(lineNames)
      .join("g")
      .attr("class", "legend-item")
      .attr("transform", (lineName, index) =>
        `translate(${margin.left + index * 138},20)`
      )
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("aria-label", (lineName) => `Select ${lineName} Line`)
      .on("click", (event, lineName) => window.selectLine(lineName))
      .on("keydown", (event, lineName) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          window.selectLine(lineName);
        }
      });
    legend.append("line")
      .attr("x1", 0)
      .attr("x2", 24)
      .attr("y1", 0)
      .attr("y2", 0)
      .attr("stroke", (lineName) => colors[lineName]);
    legend.append("text")
      .attr("x", 31)
      .attr("y", 4)
      .text((lineName) => `${lineName} Line`);

    const formatValue = d3.format(".4f");
    const positionTooltip = (event) => {
      const position = d3.pointer(event, container.node());
      tooltip.classed("visible", true).attr("aria-hidden", "false");
      const tooltipWidth = tooltip.node().offsetWidth;
      const tooltipHeight = tooltip.node().offsetHeight;
      const containerWidth = container.node().clientWidth;
      const containerHeight = container.node().clientHeight;
      let left = position[0] + 12;
      let top = position[1] - tooltipHeight - 12;
      if (left + tooltipWidth > containerWidth - 8) left = position[0] - tooltipWidth - 12;
      if (left < 8) left = 8;
      if (top < 8) top = position[1] + 12;
      if (top + tooltipHeight > containerHeight - 8) top = containerHeight - tooltipHeight - 8;
      tooltip.style("left", `${Math.max(8, left)}px`).style("top", `${Math.max(8, top)}px`);
    };

    const showTooltip = (event) => {
      const pointer = d3.pointer(event, chart.node());
      const hoveredDate = d3.bisector((date) => date).center(dates, x.invert(pointer[0]));
      const nearestDate = dates[hoveredDate];
      if (!nearestDate) return;

      const monthRows = lineNames.map((lineName) =>
        rows.find((row) =>
          row.line === lineName && row.date.getTime() === nearestDate.getTime()
        )
      );
      tooltip.html(
        `<strong>${formatMonth(nearestDate)}</strong>` +
        monthRows.map((row, index) => row
          ? `<br><span class="${currentState.selectedLine === lineNames[index] ? "tooltip-selected" : ""}">` +
            `${lineNames[index]} Line: ${formatValue(row.excessMinutes)} min</span>`
          : "").join("")
      );
      positionTooltip(event);
    };

    const hideTooltip = () => {
      tooltip.classed("visible", false).attr("aria-hidden", "true");
    };

    const brushEnded = (event) => {
      if (syncingBrush) return;
      if (!event.selection) {
        if (currentState.startDate || currentState.endDate) {
          window.selectDateRange(null, null);
        }
        return;
      }

      const [left, right] = event.selection;
      const bisect = d3.bisector((date) => date);
      const startIndex = Math.max(0, bisect.right(dates, x.invert(left)) - 1);
      const endIndex = Math.min(
        dates.length - 1,
        Math.max(startIndex, bisect.left(dates, x.invert(right)) - 1)
      );
      const startDate = dates[startIndex];
      const endDate = dates[endIndex];
      if (!startDate || !endDate) return;

      const snappedSelection = [
        x(startDate),
        x(new Date(endDate.getFullYear(), endDate.getMonth() + 1, 1))
      ];
      syncingBrush = true;
      brushGroup.call(brush.move, snappedSelection);
      syncingBrush = false;
      window.selectDateRange(startDate, endDate);
    };

    brush = d3.brushX()
      .extent([[0, 0], [innerWidth, innerHeight]])
      .on("end", brushEnded);
    brushGroup = chart.append("g")
      .attr("class", "reliability-brush")
      .call(brush);
    brushGroup.selectAll(".overlay, .selection, .handle")
      .on("mousemove.tooltip", showTooltip)
      .on("mouseleave.tooltip", hideTooltip);

    chart.append("text")
      .attr("class", "brush-hint")
      .attr("x", innerWidth)
      .attr("y", innerHeight + 42)
      .attr("text-anchor", "end")
      .text("Drag to select months · click a line to highlight");

    applyState(currentState);
    if (typeof window.registerDashboardChart === "function") {
      window.registerDashboardChart("reliability");
    }
  }

  d3.csv("data/monthlyExcessTripTime.csv", (row) => ({
    date: parseDate(row.date),
    line: row.line,
    excessMinutes: Number(row.excess_minutes)
  }))
    .then(drawChart)
    .catch((error) => {
      d3.select("#reliability-chart")
        .append("p")
        .attr("class", "chart-error")
        .attr("role", "alert")
        .text("The reliability chart could not be loaded. Please try again later.");
      console.error("Could not load monthly excess trip time data.", error);
    });
})();
