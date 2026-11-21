/* Owner: Briyant */

(function () {
  const DATA_PATH = "data/monthlyExcessComponents.csv";
  const CONTAINER = "#bar-chart";
  const LINES = ["Red", "Orange", "Blue"];
  const COLORS = { Red: "#da291c", Orange: "#ed8b00", Blue: "#003da5" };
  const DURATION = 500;

  const parseDate = d3.timeParse("%Y-%m-%d");
  const formatMonth = d3.timeFormat("%b %Y");
  const formatMinutes = d3.format(".2f");
  const formatHours = d3.format(",.0f");

  const width = 560;
  const height = 270;
  const margin = { top: 10, right: 120, bottom: 50, left: 80 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = d3.scaleLinear().range([0, innerWidth]);
  const y = d3.scaleBand().range([0, innerHeight]).padding(0.35);

  let rows = [];
  let allMonths = new Map();
  let parts = null;

  /* Helpers */

  function lineColor(line) {
    return COLORS[line];
  }

  // Show an element when the condition is true, hide it otherwise
  function displayIf(condition) {
    if (condition) {
      return null;
    }
    return "none";
  }

  function hasRange(state) {
    return state.startDate !== null && state.endDate !== null;
  }

  function inRange(row, state) {
    if (!hasRange(state)) {
      return true;
    }
    return row.date >= state.startDate && row.date <= state.endDate;
  }

  // Sum each component and the passengers first, then divide
  function summarize(subset) {
    const results = [];
    LINES.forEach(function (line) {
      const lineRows = subset.filter(function (d) { return d.line === line; });
      if (lineRows.length === 0) {
        return;
      }
      const pax = d3.sum(lineRows, function (d) { return d.pax; });
      if (pax === 0) {
        return;
      }
      const tripDiff = d3.sum(lineRows, function (d) { return d.trip - d.blTrip; });
      const travelDiff = d3.sum(lineRows, function (d) { return d.travel - d.blTravel; });
      const waitDiff = d3.sum(lineRows, function (d) { return d.wait - d.blWait; });
      results.push({
        line: line,
        total: tripDiff / pax,
        inTrain: travelDiff / pax,
        outOfTrain: waitDiff / pax,
        paxHoursLost: tripDiff / 60,
        months: lineRows.length
      });
    });
    return results;
  }

  // Where each bar ends (negative parts are drawn as zero)
  function barEnd(d) {
    return Math.max(0, d.inTrain) + Math.max(0, d.outOfTrain);
  }

  function rangeText(state) {
    if (hasRange(state)) {
      return formatMonth(state.startDate) + " to " + formatMonth(state.endDate);
    }
    const extent = d3.extent(rows, function (d) { return d.date; });
    return "All months (" + formatMonth(extent[0]) + " to " + formatMonth(extent[1]) + ")";
  }

  function showMessage(text) {
    const container = d3.select(CONTAINER).classed("bar-chart", true);
    container.selectAll("*").remove();
    container.append("p").attr("class", "chart-message").text(text);
  }

  /* Build the parts that don't change */

  function setup() {
    const container = d3.select(CONTAINER).classed("bar-chart", true);
    container.selectAll("*").remove();

    container.append("h2")
    .text("View A: Which line has the most excess trip time?");
    container.append("p")
      .attr("class", "chart-subtitle")
      .text("Average excess minutes per trip, split into in-train and out-of-train time");

    const rangeLabel = container.append("p").attr("class", "range-label");

    const svg = container.append("svg")
      .attr("viewBox", "0 0 " + width + " " + height)
      .attr("preserveAspectRatio", "xMinYMin meet");

    const chart = svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    const grid = chart.append("g")
      .attr("class", "grid")
      .attr("transform", "translate(0," + innerHeight + ")");

    const xAxis = chart.append("g")
      .attr("class", "axis x-axis")
      .attr("transform", "translate(0," + innerHeight + ")");

    chart.append("text")
      .attr("class", "axis-title")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 40)
      .text("Average excess minutes per trip (sorted, worst on top)");

    const barLayer = chart.append("g").attr("class", "bars");

    const emptyNote = chart.append("text")
      .attr("class", "chart-message")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight / 2)
      .attr("text-anchor", "middle")
      .style("display", "none")
      .text("No data for the selected months.");

    const tooltip = container.append("div").attr("class", "bar-chart-tooltip");

    const legend = container.append("div").attr("class", "legend");
    const inTrainItem = legend.append("div").attr("class", "legend-item");
    inTrainItem.append("span").attr("class", "legend-swatch in-train");
    inTrainItem.append("span").text("Dark = in-train excess time");
    const outItem = legend.append("div").attr("class", "legend-item");
    outItem.append("span").attr("class", "legend-swatch out-of-train");
    outItem.append("span").text("Light = out-of-train excess time");
    const allItem = legend.append("div").attr("class", "legend-item all-years-item");
    allItem.append("span").attr("class", "legend-swatch all-years");
    allItem.append("span").text("Dashed outline = all-months total");

    container.append("p")
      .attr("class", "hint")
      .text("Click a bar to select a line. Brush the timeline in View B to recalculate for those months. Hover for exact values.");

    return {
      container: container,
      rangeLabel: rangeLabel,
      grid: grid,
      xAxis: xAxis,
      barLayer: barLayer,
      emptyNote: emptyNote,
      tooltip: tooltip,
      allItem: allItem
    };
  }

  /* Tooltip */

  function showTooltip(event, d, state) {
    const pos = d3.pointer(event, parts.container.node());
    let html = "<div class='tooltip-title'>" + d.line + " Line</div>"
      + "<div class='tooltip-range'>" + rangeText(state) + "</div>"
      + "Excess time per trip: " + formatMinutes(d.total) + " min<br>"
      + "In-train: " + formatMinutes(d.inTrain) + " min<br>"
      + "Out-of-train: " + formatMinutes(d.outOfTrain) + " min<br>"
      + "Passenger hours lost: " + formatHours(d.paxHoursLost);
    if (hasRange(state)) {
      html += "<br>All months: " + formatMinutes(d.allTotal) + " min";
    }
    parts.tooltip.html(html).classed("visible", true);

    // Flip the tooltip to the left of the mouse when it would run off the right edge
    const boxWidth = parts.tooltip.node().offsetWidth;
    const containerWidth = parts.container.node().clientWidth;
    let left = pos[0] + 16;
    if (left + boxWidth > containerWidth) {
      left = pos[0] - boxWidth - 16;
    }
    if (left < 0) {
      left = 0;
    }
    parts.tooltip
      .style("left", left + "px")
      .style("top", (pos[1] + 16) + "px");
  }

  function hideTooltip() {
    parts.tooltip.classed("visible", false);
  }

  /* Clicking a bar */

  function handleSelect(line) {
    if (typeof window.selectLine === "function") {
      window.selectLine(line);
    }
  }

  /* Draw / update from the shared state */

  function render(state) {
    const ranged = hasRange(state);
    const subset = rows.filter(function (d) { return inRange(d, state); });
    const data = summarize(subset);

    data.forEach(function (d) {
      d.allTotal = allMonths.get(d.line).total;
    });
    data.sort(function (a, b) { return b.total - a.total; });

    parts.rangeLabel.text("Showing: " + rangeText(state));
    parts.allItem.style("display", displayIf(ranged));
    parts.emptyNote.style("display", displayIf(data.length === 0));

    // Scales (leave room for the all-months outline when brushing)
    const maxValue = d3.max(data, function (d) {
      let value = Math.max(barEnd(d), d.total);
      if (ranged) {
        value = Math.max(value, d.allTotal);
      }
      return value;
    });
    x.domain([0, maxValue || 1]).nice();
    y.domain(data.map(function (d) { return d.line; }));

    const t = d3.transition().duration(DURATION);

    parts.grid.transition(t)
      .call(d3.axisBottom(x).ticks(5).tickSize(-innerHeight).tickFormat(""));
    parts.xAxis.transition(t)
      .call(d3.axisBottom(x).ticks(5));

    // One group per line, matched by line name so bars slide when re-sorted
    const groups = parts.barLayer.selectAll(".bar-group")
      .data(data, function (d) { return d.line; })
      .join(
        function (enter) {
          const g = enter.append("g")
            .attr("class", "bar-group")
            .attr("tabindex", 0)
            .attr("role", "button")
            .attr("transform", function (d) { return "translate(0," + y(d.line) + ")"; });
          g.append("rect").attr("class", "bar-outline").attr("x", -3).attr("y", -3).attr("rx", 4);
          g.append("rect").attr("class", "bar-in-train").attr("x", 0).attr("width", 0);
          g.append("rect").attr("class", "bar-out-of-train").attr("x", 0).attr("width", 0);
          g.append("rect").attr("class", "all-years-outline").attr("x", 0);
          g.append("text").attr("class", "bar-label").attr("x", -12);
          g.append("text").attr("class", "value-label");
          g.append("text").attr("class", "value-sublabel");
          return g;
        },
        function (update) { return update; },
        function (exit) { return exit.remove(); }
      );

    groups
      .attr("aria-label", function (d) {
        return d.line + " Line: " + formatMinutes(d.total) + " excess minutes per trip";
      })
      .classed("selected", function (d) { return d.line === state.selectedLine; })
      .classed("faded", function (d) {
        return state.selectedLine !== "All" && d.line !== state.selectedLine;
      })
      .on("click", function (event, d) { handleSelect(d.line); })
      .on("keydown", function (event, d) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleSelect(d.line);
        }
      })
      .on("mousemove", function (event, d) { showTooltip(event, d, state); })
      .on("mouseleave", hideTooltip);

    groups.transition(t)
      .attr("transform", function (d) { return "translate(0," + y(d.line) + ")"; });

    const band = y.bandwidth();

    groups.select(".bar-outline")
      .attr("height", band + 6)
      .transition(t)
      .attr("width", function (d) { return x(barEnd(d)) + 6; });

    groups.select(".bar-in-train")
      .attr("height", band)
      .attr("fill", function (d) { return lineColor(d.line); })
      .transition(t)
      .attr("width", function (d) { return x(Math.max(0, d.inTrain)); });

    groups.select(".bar-out-of-train")
      .attr("height", band)
      .attr("fill", function (d) { return lineColor(d.line); })
      .transition(t)
      .attr("x", function (d) { return x(Math.max(0, d.inTrain)); })
      .attr("width", function (d) { return x(Math.max(0, d.outOfTrain)); });

    groups.select(".all-years-outline")
      .attr("y", band * 0.2)
      .attr("height", band * 0.6)
      .style("display", displayIf(ranged))
      .transition(t)
      .attr("width", function (d) { return x(Math.max(0, d.allTotal)); });

    groups.select(".bar-label")
      .attr("y", band / 2)
      .text(function (d) { return d.line; });

    function labelX(d) {
      let end = barEnd(d);
      if (ranged) {
        end = Math.max(end, d.allTotal);
      }
      return x(end) + 8;
    }

    groups.select(".value-label")
      .text(function (d) { return formatMinutes(d.total) + " min"; })
      .transition(t)
      .attr("x", labelX)
      .attr("y", function () {
        if (ranged) {
          return band / 2 - 8;
        }
        return band / 2;
      });

    groups.select(".value-sublabel")
      .style("display", displayIf(ranged))
      .text(function (d) { return "all months: " + formatMinutes(d.allTotal); })
      .transition(t)
      .attr("x", labelX)
      .attr("y", band / 2 + 12);
  }

  /* Load data and connect to the dashboard */

  d3.csv(DATA_PATH)
    .then(function (raw) {
      rows = raw.map(function (d) {
        return {
          date: parseDate(d.date),
          line: d.line,
          pax: +d.est_pax,
          trip: +d.weighted_trip_time,
          blTrip: +d.weighted_bl_trip_time,
          travel: +d.weighted_travel_time,
          blTravel: +d.weighted_bl_travel_time,
          wait: +d.weighted_wait_time,
          blWait: +d.weighted_bl_wait_time
        };
      }).filter(function (d) {
        return d.date !== null && LINES.indexOf(d.line) !== -1;
      });

      if (rows.length === 0) {
        showMessage("The bar chart couldn't find any Red, Orange, or Blue Line rows in " + DATA_PATH + ".");
        return;
      }

      summarize(rows).forEach(function (d) {
        allMonths.set(d.line, d);
      });
      console.table(Array.from(allMonths.values()));  // Tableau: Red 5.547, Orange 2.959, Blue 2.120

      parts = setup();

      window.updateBarChart = function (state) {
        render(state);
      };

      if (typeof window.registerDashboardChart === "function") {
        window.registerDashboardChart("bar");   // immediately sends the current state
      } else {
        render({ selectedLine: "All", startDate: null, endDate: null });
      }
    })
    .catch(function (error) {
      console.error("barchart: could not load " + DATA_PATH, error);
      showMessage("The bar chart data couldn't be loaded. Check that " + DATA_PATH + " exists and the page is running on a local server.");
    });
})();