(() => {
  const colors = {
    Red: "#DA291C",
    Orange: "#ED8B00",
    Blue: "#003DA5"
  };
  const parseDate = d3.timeParse("%Y-%m-%d");

  function drawChart(rows) {
    const container = d3.select("#reliability-chart");
    const width = 960;
    const height = 480;
    const margin = { top: 46, right: 24, bottom: 58, left: 78 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (rows.length === 0 || rows.some((row) =>
      !row.date || !Number.isFinite(row.excessMinutes) || !colors[row.line]
    )) {
      throw new Error("The monthly reliability data is empty or contains invalid values.");
    }

    const dates = d3.extent(rows, (row) => row.date);
    const values = d3.extent(rows, (row) => row.excessMinutes);
    const x = d3.scaleTime().domain(dates).range([0, innerWidth]);
    const y = d3
      .scaleLinear()
      .domain([Math.min(0, values[0]), Math.max(0, values[1])])
      .nice()
      .range([innerHeight, 0]);

    const svg = container
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr(
        "aria-label",
        "Monthly average excess subway trip time for the Red, Orange, and Blue lines from 2022 through August 2026"
      );

    svg
      .append("title")
      .text("Monthly average excess trip time by subway line");

    const chart = svg
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

    Object.entries(colors).forEach(([lineName, color], index) => {
      const lineData = rows
        .filter((row) => row.line === lineName)
        .sort((a, b) => a.date - b.date);
      chart
        .append("path")
        .datum(lineData)
        .attr("class", `reliability-line ${lineName.toLowerCase()}`)
        .attr("stroke", color)
        .attr("d", line);

      const legend = svg
        .append("g")
        .attr("class", "legend-item")
        .attr("transform", `translate(${margin.left + index * 138},20)`);
      legend
        .append("line")
        .attr("x1", 0)
        .attr("x2", 24)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", color);
      legend
        .append("text")
        .attr("x", 31)
        .attr("y", 4)
        .text(`${lineName} Line`);
    });
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