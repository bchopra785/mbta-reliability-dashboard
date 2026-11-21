/* Owner: Briyant */

(function () {
  const DATA_PATH = "data/delayData.csv";
  const CONTAINER = "#bar-chart";
  const LINE_ORDER = ["Red", "Orange", "Blue"];
  const DEFAULT_COLORS = { Red: "#da291c", Orange: "#ed8b00", Blue: "#003da5" };
  const parseDate = d3.timeParse("%Y-%m-%d");

  const COLS = {
    line: ["route_id", "Route Id", "routeId", "route"],
    pax: ["est_pax", "Est Pax", "estPax"],
    trip: ["weighted_trip_time", "Weighted Trip Time"],
    blTrip: ["weighted_bl_trip_time", "Weighted Bl Trip Time"],
    travel: ["weighted_travel_time", "Weighted Travel Time"],
    blTravel: ["weighted_bl_travel_time", "Weighted Bl Travel Time"],
    wait: ["weighted_wait_time", "Weighted Wait Time"],
    blWait: ["weighted_bl_wait_time", "Weighted Bl Wait Time"]
  };

  let currentState = {
    selectedLine: "All",
    startDate: null,
    endDate: null
  };
  let loadedRows = [];
  let allData = [];

  function lineColor(line) {
    if (typeof LINE_COLORS !== "undefined" && LINE_COLORS[line]) {
      return LINE_COLORS[line];
    }
    return DEFAULT_COLORS[line];
  }

  function getNumber(row, names) {
    for (let i = 0; i < names.length; i++) {
      const value = row[names[i]];
      if (value !== undefined && value !== "") {
        return +value;
      }
    }
    return 0;
  }

  function getLine(row) {
    for (let i = 0; i < COLS.line.length; i++) {
      const value = row[COLS.line[i]];
      if (value !== undefined && value !== "") {
        const text = String(value).trim().toLowerCase();
        return text.charAt(0).toUpperCase() + text.slice(1);
      }
    }
    return "";
  }

  function summarize(rows) {
    const groups = d3.group(rows, getLine);
    const results = [];

    groups.forEach(function (lineRows, line) {
      if (LINE_ORDER.indexOf(line) === -1) return;

      const pax = d3.sum(lineRows, function (d) { return getNumber(d, COLS.pax); });
      const tripDiff = d3.sum(lineRows, function (d) { return getNumber(d, COLS.trip); })
        - d3.sum(lineRows, function (d) { return getNumber(d, COLS.blTrip); });
      const travelDiff = d3.sum(lineRows, function (d) { return getNumber(d, COLS.travel); })
        - d3.sum(lineRows, function (d) { return getNumber(d, COLS.blTravel); });
      const waitDiff = d3.sum(lineRows, function (d) { return getNumber(d, COLS.wait); })
        - d3.sum(lineRows, function (d) { return getNumber(d, COLS.blWait); });

      if (pax === 0) return;
      results.push({
        line: line,
        total: tripDiff / pax,
        inTrain: travelDiff / pax,
        outOfTrain: waitDiff / pax,
        paxHoursLost: tripDiff / 60
      });
    });

    return results;
  }

  function updateBarChart(state) {
    currentState = state;
    render();
  }

  window.updateBarChart = updateBarChart;

  function handleClick(event, datum) {
    window.selectLine(currentState.selectedLine === datum.line ? "All" : datum.line);
  }

  function render() {
    const container = d3.select(CONTAINER).classed("bar-chart", true);
    container.selectAll("*").remove();

    container.append("h3")
      .attr("class", "chart-title")
      .text("A. Which line has the most excess trip time?");
    container.append("p")
      .attr("class", "chart-subtitle")
      .text("Average excess minutes per trip, split into in-train and out-of-train time");

    const hasRange = currentState.startDate && currentState.endDate;
    const endExclusive = hasRange
      ? new Date(currentState.endDate.getFullYear(), currentState.endDate.getMonth() + 1, 1)
      : null;
    const data = hasRange
      ? summarize(loadedRows.filter((row) =>
        row.date >= currentState.startDate && row.date < endExclusive
      ))
      : allData.slice();

    if (data.length === 0) {
      const formatMonth = d3.timeFormat("%B %Y");
      container.append("p")
        .attr("class", "range-no-data")
        .attr("role", "status")
        .text(hasRange
          ? `No daily data is available from ${formatMonth(currentState.startDate)} through ${formatMonth(currentState.endDate)}.`
          : "No daily excess trip time data is available.");
      return;
    }

    data.sort(function (a, b) {
      return LINE_ORDER.indexOf(a.line) - LINE_ORDER.indexOf(b.line);
    });

    const width = 560;
    const height = 260;
    const margin = { top: 10, right: 90, bottom: 50, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const maxValue = d3.max(allData, function (d) {
      return Math.max(d.total, d.inTrain + d.outOfTrain);
    });
    const x = d3.scaleLinear()
      .domain([0, maxValue || 1])
      .range([0, innerWidth])
      .nice();
    const y = d3.scaleBand()
      .domain(data.map(function (d) { return d.line; }))
      .range([0, innerHeight])
      .padding(0.35);

    const svg = container.append("svg")
      .attr("viewBox", "0 0 " + width + " " + height)
      .attr("preserveAspectRatio", "xMinYMin meet");
    const chart = svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    chart.append("g")
      .attr("class", "grid")
      .attr("transform", "translate(0," + innerHeight + ")")
      .call(d3.axisBottom(x).ticks(5).tickSize(-innerHeight).tickFormat(""));

    chart.append("g")
      .attr("class", "axis x-axis")
      .attr("transform", "translate(0," + innerHeight + ")")
      .call(d3.axisBottom(x).ticks(5));

    chart.append("text")
      .attr("class", "axis-title")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 40)
      .text("Average excess minutes per trip (sorted, worst on top)");

    const barGroups = chart.selectAll(".bar-group")
      .data(data)
      .join("g")
      .attr("class", "bar-group")
      .attr("transform", function (d) { return "translate(0," + y(d.line) + ")"; })
      .on("click", handleClick);

    if (hasRange) {
      barGroups.append("rect")
        .attr("class", "all-years-outline")
        .attr("x", -3)
        .attr("y", -3)
        .attr("width", function (d) {
          const allYears = allData.find(function (row) { return row.line === d.line; });
          return x(allYears ? Math.max(0, allYears.inTrain + allYears.outOfTrain) : 0) + 6;
        })
        .attr("height", y.bandwidth() + 6)
        .attr("rx", 4);
    }

    barGroups.append("rect")
      .attr("class", "bar-outline")
      .attr("x", -3)
      .attr("y", -3)
      .attr("width", function (d) { return x(Math.max(0, d.inTrain + d.outOfTrain)) + 6; })
      .attr("height", y.bandwidth() + 6)
      .attr("rx", 4);

    barGroups.append("rect")
      .attr("class", "bar-in-train")
      .attr("x", 0)
      .attr("width", function (d) { return x(Math.max(0, d.inTrain)); })
      .attr("height", y.bandwidth())
      .attr("fill", function (d) { return lineColor(d.line); });

    barGroups.append("rect")
      .attr("class", "bar-out-of-train")
      .attr("x", function (d) { return x(Math.max(0, d.inTrain)); })
      .attr("width", function (d) { return x(Math.max(0, d.outOfTrain)); })
      .attr("height", y.bandwidth())
      .attr("fill", function (d) { return lineColor(d.line); });

    barGroups.append("text")
      .attr("class", "bar-label")
      .attr("x", -12)
      .attr("y", y.bandwidth() / 2)
      .text(function (d) { return d.line; });

    barGroups.append("text")
      .attr("class", "value-label")
      .attr("x", function (d) { return x(Math.max(0, d.inTrain + d.outOfTrain)) + 8; })
      .attr("y", y.bandwidth() / 2)
      .text(function (d) { return d3.format(".2f")(d.total) + " min"; });

    const tooltip = container.append("div").attr("class", "bar-chart-tooltip");
    barGroups
      .classed("selected", function (d) {
        return currentState.selectedLine !== "All" && d.line === currentState.selectedLine;
      })
      .classed("faded", function (d) {
        return currentState.selectedLine !== "All" && d.line !== currentState.selectedLine;
      })
      .on("mousemove", function (event, d) {
        const pos = d3.pointer(event, container.node());
        let html = "<div class='tooltip-title'>" + d.line + " Line</div>"
          + "Excess time per trip: " + d3.format(".2f")(d.total) + " min<br>"
          + "In-train: " + d3.format(".2f")(d.inTrain) + " min<br>"
          + "Out-of-train: " + d3.format(".2f")(d.outOfTrain) + " min";
        if (d.paxHoursLost > 0) {
          html += "<br>Passenger hours lost: " + d3.format(",.0f")(d.paxHoursLost);
        }
        tooltip
          .html(html)
          .style("left", (pos[0] + 16) + "px")
          .style("top", (pos[1] - 10) + "px")
          .classed("visible", true);
      })
      .on("mouseleave", function () {
        tooltip.classed("visible", false);
      });

    const legend = container.append("div").attr("class", "legend");
    if (hasRange) {
      const allYearsItem = legend.append("div").attr("class", "legend-item");
      allYearsItem.append("span").attr("class", "legend-swatch all-years");
      allYearsItem.append("span").text("Dashed outline = all available dates");
    }
    const inTrainItem = legend.append("div").attr("class", "legend-item");
    inTrainItem.append("span").attr("class", "legend-swatch in-train");
    inTrainItem.append("span").text("Dark = in-train excess time");
    const outItem = legend.append("div").attr("class", "legend-item");
    outItem.append("span").attr("class", "legend-swatch out-of-train");
    outItem.append("span").text("Light = out-of-train excess time");

    container.append("p")
      .attr("class", "hint")
      .text(hasRange
        ? "Bars show the selected date range. Click a bar to highlight a line."
        : "Click a bar to highlight a line. Hover for exact values.");
  }

  d3.csv(DATA_PATH, function (row) {
    return {
      ...row,
      date: parseDate(row.svc_date)
    };
  })
    .then(function (rows) {
      loadedRows = rows.filter(function (row) {
        return row.date && LINE_ORDER.indexOf(getLine(row)) !== -1;
      });
      if (loadedRows.length === 0) {
        throw new Error("The daily excess trip time data contains no valid subway line records.");
      }
      allData = summarize(loadedRows);
      render();
      if (typeof window.registerDashboardChart === "function") {
        window.registerDashboardChart("bar");
      }
    })
    .catch(function (error) {
      const container = d3.select(CONTAINER);
      container.selectAll("*").remove();
      container.append("p")
        .attr("class", "chart-error")
        .attr("role", "alert")
        .text("The excess trip time chart could not be loaded. Please try again later.");
      console.error("Could not load daily excess trip time data.", error);
    });

  window.barChart = {
    setSelectedLine: function (line) {
      window.selectLine(line || "All");
    }
  };
})();
