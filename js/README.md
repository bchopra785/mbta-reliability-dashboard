# Put the JavaScript code you write in this folder

We recommend you separate the implementation details for individual visualizations using the [Reusable Charts](https://bost.ocks.org/mike/chart/) framework Mike Bostock advocates.
Broadly this means implementing visualizations as closures with getter-setter methods.
This can be further extended to [making updatable charts](https://www.toptal.com/d3-js/towards-reusable-d3-js-charts).

`dashboard.js` stores the shared line and inclusive monthly date selection in
`window.dashboardState`. Use `window.selectLine(line)`,
`window.selectDateRange(startDate, endDate)`, and `window.resetDashboard()`
to change it. Dates must be first-of-month JavaScript `Date` objects, or both
`null` to clear the range. Line and date changes notify registered charts; reset
also sends the default state so a chart can clear its brush.

After a chart has loaded its data and rendered, its owner exposes the
appropriate update function and registers it. View B's monthly timeline owns
the date brush and publishes inclusive month ranges. View A recomputes its
weighted averages from daily records in the chosen months (its dashed outline
shows the all-dates value); View C shades the corresponding months.

```js
window.updateBarChart = (state) => {
  // Update this chart using state.selectedLine, state.startDate, and state.endDate.
};
window.registerDashboardChart("bar");
```

The other names are `window.updateReliabilityChart` with `"reliability"` and
`window.updateRidershipChart` with `"ridership"`. Registration immediately
supplies the current state, including selections made while data was loading.
Updates are currently synchronous; each chart should apply the state without
calling the selection functions in response to that update. User-initiated
bar clicks, timeline legend selections, and brush changes call the selection
functions above.