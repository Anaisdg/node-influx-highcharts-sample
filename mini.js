const { InfluxDB, Point, HttpError } = require('@influxdata/influxdb-client')
const { url, token, org, bucket } = require('./env')
const { OrgsAPI, BucketsAPI } = require('@influxdata/influxdb-client-apis')
const influxDB = new InfluxDB({ url, token })
console.log(`Using organization "${url}"`)

// =
// const Influx = require('influx');
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const hanalei = require('./data/tides-hanalei.js');
const hilo = require('./data/tides-hilo.js');
const honolulu = require('./data/tides-honolulu.js');
const kahului = require('./data/tides-kahului.js');
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.static(path.join(__dirname, 'public')));
app.set('port', 3000);

const queryApi = new InfluxDB({ url, token }).getQueryApi(org)
const fluxQuery =
    'from(bucket:"ocean_tides") |> range(start:0) |> filter(fn: (r) => r.location == "Hanalei Bay, Kauai Island, Hawaii")'

queryApi.queryRows(fluxQuery, {
    next(row, tableMeta) {
        const o = tableMeta.toObject(row)
        console.log(
            `${o}`
            // `${o._time} ${o._measurement} in '${o.location}': ${o._field}=${o._value}`
        )
    },
    error(error) {
        console.error(error)
        console.log('\nFinished ERROR queryRows')
    },
    complete(results) {
        console.log('\nFinished SUCCESS queryRows', results)
    },
})