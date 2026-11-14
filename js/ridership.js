// Ridership timeline chart. Keep chart-specific state inside this IIFE.
(() => {
  const colors = {
    Red: "#DA291C",
    Orange: "#ED8B00",
    Blue: "#003DA5"
  };

  // SAMPLE data for Sprint 1. TODO: replace getSampleData() with real data.
  function getSampleData() {
    const start = new Date(2022, 0, 1);
    const end = new Date(2026, 9, 1);
    const dates = d3.timeMonth.range(start, end);
    const lineOffsets = { Red: 0, Orange: -1, Blue: 2 };

    return dates.flatMap((date, index) =>
      Object.keys(colors).map((line) => ({
        date,
        line,
        pct: Math.round(
          (50 + (28 * index) / (dates.length - 1) +
            lineOffsets[line] +
            1.5 * Math.sin(index * 0.8 + line.length)) *
            10
        ) / 10
      }))
    );
  }

  // TODO: For real data, calculate each line's percentage against its
  // same-calendar-month 2019 ridership: ridership / 2019 ridership * 100.
  function computePct(rows) {
    const baseline = new Map(
      rows
        .filter((row) => row.date.getFullYear() === 2019)
        .map((row) => [
          `${row.line}-${row.date.getMonth()}`,
          row.ridership
        ])
    );

    return rows
      .filter((row) => row.date.getFullYear() !== 2019)
      .map((row) => ({
        ...row,
        pct:
          (row.ridership /
            baseline.get(`${row.line}-${row.date.getMonth()}`)) *
          100
      }));
  }

  function drawRidershipChart(data) {
    const container = d3.select("#ridership-chart");
    const width = 800;
    const height = 200;
    const margin = { top: 18, right: 128, bottom: 34, left: 62 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", "MBTA ridership compared with 2019 levels");

    const chart = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleTime()
      .domain([new Date(2022, 0, 1), new Date(2026, 8, 1)])
      .range([0, innerWidth]);
    const y = d3.scaleLinear().domain([40, 105]).range([innerHeight, 0]);

    // Horizontal gridlines make percentage comparisons easier to read.
    chart
      .append("g")
      .attr("class", "gridlines")
      .call(d3.axisLeft(y).tickValues([40, 60, 80, 100]).tickSize(-innerWidth).tickFormat(""));

    chart
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat("%Y")));

    chart
      .append("g")
      .attr("class", "y-axis")
      .call(
        d3
          .axisLeft(y)
          .tickValues([40, 60, 80, 100])
          .tickFormat((value) => `${value}%`)
      );

    chart
      .append("text")
      .attr("class", "y-axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -46)
      .attr("text-anchor", "middle")
      .text("% of 2019 ridership");

    chart
      .append("line")
      .attr("class", "reference-line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", y(100))
      .attr("y2", y(100));

    chart
      .append("text")
      .attr("class", "reference-label")
      .attr("x", innerWidth + 8)
      .attr("y", y(100))
      .attr("dominant-baseline", "middle")
      .text("2019 level (100%)");

    const line = d3
      .line()
      .x((datum) => x(datum.date))
      .y((datum) => y(datum.pct));

    Object.keys(colors).forEach((lineName) => {
      chart
        .append("path")
        .datum(data.filter((datum) => datum.line === lineName))
        .attr("class", `ridership-line ${lineName.toLowerCase()}`)
        .attr("stroke", colors[lineName])
        .attr("d", line);
    });

    // Future sprints can add tooltips, brushing, and line highlighting here.
  }

  drawRidershipChart(getSampleData());
})();