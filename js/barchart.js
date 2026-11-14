/* Owner: Briyant */
   
(function () {
  const DATA_PATH = "data/delayData.csv";
  const CONTAINER = "#bar-chart";
  const LINE_ORDER = ["Red", "Orange", "Blue"];
  const DEFAULT_COLORS = { Red: "#da291c", Orange: "#ed8b00", Blue: "#003da5" };

  // Sample numbers so the chart still renders if the CSV fails to load
  const SAMPLE_DATA = [
    { line: "Red", inTrain: 4.1, outOfTrain: 1.4, total: 5.547, paxHoursLost: 0 },
    { line: "Orange", inTrain: 2.1, outOfTrain: 0.9, total: 2.959, paxHoursLost: 0 },
    { line: "Blue", inTrain: 1.3, outOfTrain: 0.8, total: 2.12, paxHoursLost: 0 }
  ];

  // Possible column names in the CSV (Tableau-style or snake_case)
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

  let selectedLine = null;
  let barGroups = null;

  /* Helpers */

  // Use the shared colors from config.js if they exist
  function lineColor(line) {
    if (typeof LINE_COLORS !== "undefined" && LINE_COLORS[line]) {
      return LINE_COLORS[line];
    }
    return DEFAULT_COLORS[line];
  }

  // Read a number from whichever column name exists in the row
  function getNumber(row, names) {
    for (let i = 0; i < names.length; i++) {
      const value = row[names[i]];
      if (value !== undefined && value !== "") {
        return +value;
      }
    }
    return 0;
  }

  // Read the line name and format it as "Red", "Orange", or "Blue"
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

  /* Calculations (sum each column first, then divide) */

  function summarize(rows) {
    const groups = d3.group(rows, getLine);
    const results = [];

    groups.forEach(function (lineRows, line) {
      if (LINE_ORDER.indexOf(line) === -1) {
        return;
      }

      const pax = d3.sum(lineRows, function (d) { return getNumber(d, COLS.pax); });
      const tripDiff = d3.sum(lineRows, function (d) { return getNumber(d, COLS.trip); })
        - d3.sum(lineRows, function (d) { return getNumber(d, COLS.blTrip); });
      const travelDiff = d3.sum(lineRows, function (d) { return getNumber(d, COLS.travel); })
        - d3.sum(lineRows, function (d) { return getNumber(d, COLS.blTravel); });
      const waitDiff = d3.sum(lineRows, function (d) { return getNumber(d, COLS.wait); })
        - d3.sum(lineRows, function (d) { return getNumber(d, COLS.blWait); });

      if (pax === 0) {
        return;
      }

      results.push({
        line: line,
        total: tripDiff / pax,          // Average Excess Trip Minutes
        inTrain: travelDiff / pax,      // Excess In-Vehicle Travel Minutes
        outOfTrain: waitDiff / pax,     // Excess Wait Minutes
        paxHoursLost: tripDiff / 60     // Net Excess Passenger Hours
      });
    });

    return results;
  }

  /* Selection (click a bar) */

  function updateSelection() {
    if (barGroups === null) {
      return;
    }
    barGroups
      .classed("selected", function (d) { return d.line === selectedLine; })
      .classed("faded", function (d) { return selectedLine !== null && d.line !== selectedLine; });
  }

  function handleClick(event, d) {
    if (selectedLine === d.line) {
      selectedLine = null;
    } else {
      selectedLine = d.line;
    }
    updateSelection();

    // Let the other views know which line was picked
    const node = d3.select(CONTAINER).node();
    node.dispatchEvent(new CustomEvent("lineSelected", {
      detail: { line: selectedLine },
      bubbles: true
    }));
  }

  /* Drawing */

  function draw(data) {
    data.sort(function (a, b) { return b.total - a.total; });

    const container = d3.select(CONTAINER).classed("bar-chart", true);
    container.selectAll("*").remove();

    container.append("h3")
      .attr("class", "chart-title")
      .text("A. Which line has the most excess trip time?");
    container.append("p")
      .attr("class", "chart-subtitle")
      .text("Average excess minutes per trip, split into in-train and out-of-train time");

    const width = 560;
    const height = 260;
    const margin = { top: 10, right: 90, bottom: 50, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container.append("svg")
      .attr("viewBox", "0 0 " + width + " " + height)
      .attr("preserveAspectRatio", "xMinYMin meet");

    const chart = svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Scales
    const maxValue = d3.max(data, function (d) {
      return Math.max(d.total, d.inTrain + d.outOfTrain);
    });
    const x = d3.scaleLinear()
      .domain([0, maxValue])
      .range([0, innerWidth])
      .nice();
    const y = d3.scaleBand()
      .domain(data.map(function (d) { return d.line; }))
      .range([0, innerHeight])
      .padding(0.35);

    // Gridlines
    chart.append("g")
      .attr("class", "grid")
      .attr("transform", "translate(0," + innerHeight + ")")
      .call(d3.axisBottom(x).ticks(5).tickSize(-innerHeight).tickFormat(""));

    // X axis
    chart.append("g")
      .attr("class", "axis x-axis")
      .attr("transform", "translate(0," + innerHeight + ")")
      .call(d3.axisBottom(x).ticks(5));

    chart.append("text")
      .attr("class", "axis-title")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 40)
      .text("Average excess minutes per trip (sorted, worst on top)");

    // One group per line holding both segments
    barGroups = chart.selectAll(".bar-group")
      .data(data)
      .join("g")
      .attr("class", "bar-group")
      .attr("transform", function (d) { return "translate(0," + y(d.line) + ")"; })
      .on("click", handleClick);

    // Outline shown only when the line is selected
    barGroups.append("rect")
      .attr("class", "bar-outline")
      .attr("x", -3)
      .attr("y", -3)
      .attr("width", function (d) { return x(Math.max(0, d.inTrain + d.outOfTrain)) + 6; })
      .attr("height", y.bandwidth() + 6)
      .attr("rx", 4);

    // Dark segment: in-train
    barGroups.append("rect")
      .attr("class", "bar-in-train")
      .attr("x", 0)
      .attr("width", function (d) { return x(Math.max(0, d.inTrain)); })
      .attr("height", y.bandwidth())
      .attr("fill", function (d) { return lineColor(d.line); });

    // Light segment: out-of-train
    barGroups.append("rect")
      .attr("class", "bar-out-of-train")
      .attr("x", function (d) { return x(Math.max(0, d.inTrain)); })
      .attr("width", function (d) { return x(Math.max(0, d.outOfTrain)); })
      .attr("height", y.bandwidth())
      .attr("fill", function (d) { return lineColor(d.line); });

    // Line names on the left
    barGroups.append("text")
      .attr("class", "bar-label")
      .attr("x", -12)
      .attr("y", y.bandwidth() / 2)
      .text(function (d) { return d.line; });

    // Total minutes at the end of each bar
    barGroups.append("text")
      .attr("class", "value-label")
      .attr("x", function (d) { return x(Math.max(0, d.inTrain + d.outOfTrain)) + 8; })
      .attr("y", y.bandwidth() / 2)
      .text(function (d) { return d3.format(".2f")(d.total) + " min"; });

    // Tooltip (details on demand)
    const tooltip = container.append("div").attr("class", "bar-chart-tooltip");

    barGroups
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

    // Legend (only what this view shows)
    const legend = container.append("div").attr("class", "legend");
    const inTrainItem = legend.append("div").attr("class", "legend-item");
    inTrainItem.append("span").attr("class", "legend-swatch in-train");
    inTrainItem.append("span").text("Dark = in-train excess time");
    const outItem = legend.append("div").attr("class", "legend-item");
    outItem.append("span").attr("class", "legend-swatch out-of-train");
    outItem.append("span").text("Light = out-of-train excess time");

    container.append("p")
      .attr("class", "hint")
      .text("Click a bar to select a line. Hover for exact values.");

    updateSelection();
  }

  /* Load data */

  d3.csv(DATA_PATH)
    .then(function (rows) {
      const data = summarize(rows);
      if (data.length === 0) {
        console.warn("barChart: no matching rows in " + DATA_PATH + ", using sample data. Check the column names.");
        draw(SAMPLE_DATA);
        return;
      }
      console.table(data);   // compare with Tableau: Red 5.547, Orange 2.959, Blue 2.120
      draw(data);
    })
    .catch(function (error) {
      console.warn("barChart: could not load " + DATA_PATH + ", using sample data.", error);
      draw(SAMPLE_DATA);
    });

  // Lets other views (or main.js) set the selected line
  window.barChart = {
    setSelectedLine: function (line) {
      selectedLine = line;
      updateSelection();
    }
  };
})();