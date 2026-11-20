# Put any data files in this folder

Ideally your data is a CSV file.

`monthlyExcessComponents.csv` aggregates `delayData.csv` by subway line and
month. `date` is the first day of the month, and the remaining numeric columns
are sums of estimated passengers and the raw weighted trip, travel, and wait
time components. To calculate a passenger-weighted excess average over a date
range, sum the relevant actual and baseline components across the selected
months, subtract baseline from actual, and divide by the summed `est_pax`.

Regenerate this file from the project root with:

```sh
python3 scripts/prepare_monthly_excess.py
```

The existing `monthlyExcessTripTime.csv` remains available for the reliability
chart.

*Do not commit personally identifying or confidential data!*
If you do so, it is a pain to remove it later and it may have already been crawled by other sources. But [here is how you do so](https://help.github.com/en/github/authenticating-to-github/removing-sensitive-data-from-a-repository).