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

console.log('*** WRITE POINTS ***')
    // create a write API, expecting point timestamps in nanoseconds (can be also 's', 'ms', 'us')
const writeApi = new InfluxDB({ url, token }).getWriteApi(org, bucket, 's')
    // setup default tags for all writes through this API
    // writeApi.useDefaultTags({location: hostname()})

const writeDataToInflux = (locationObj) => {
    locationObj.rawtide.rawTideObs.forEach(tidePoint => {
        writeApi.writePoint(
                new Point('tide')
                .tag('unit', locationObj.rawtide.tideInfo[0].units)
                .tag('location', locationObj.rawtide.tideInfo[0].tideSite)
                .floatField('height', tidePoint.height)
                .timestamp(tidePoint.epoch)
            )
            // .catch(error => {
            //     console.error(`Error writing data to InfluxDB! ${err.stack}`)
            // });
    });
}


recreateBucket('ocean_tides')
    .then(() => console.log('\nFinished SUCCESS recreateBucket'))
    .catch(error => {
        console.error(error)
        console.log('\nFinished ERROR recreateBucket')
    })
    .then(() => {
        app.listen(app.get('port'), () => {
            console.log(`Listening on ${app.get('port')}.`);
        });
        writeDataToInflux(hanalei);
        writeDataToInflux(hilo);
        writeDataToInflux(honolulu);
        writeDataToInflux(kahului);
    })
    .then(() => console.log('\nFinish calling writeDataTo Influx SUCCESS'))
    .catch(error => console.log({ error }));

const queryApi = new InfluxDB({ url, token }).getQueryApi(org)

// const fluxQuery =
//     `from(bucket:"ocean_tides") |> range(start:0) |> filter(fn: (r) => r.location == "/(?i)(${place})/")`

console.log('*** QUERY ROWS ***')
    // Execute query and receive table metadata and rows.
    // https://v2.docs.influxdata.com/v2.0/reference/syntax/annotated-csv/

app.get('/api/v1/tide/:place', (request, response) => {
    const { place } = request.params;
    console.log(place)
    const results = []
    queryApi.queryRows(`from(bucket:"ocean_tides") |> range(start:0) |> filter(fn: (r) => r.location =~ /(?i)(${place})/)`, {
        next(row, tableMeta) {
            const o = tableMeta.toObject(row)
                // console.log(
                //     `${o._time} ${o._measurement} in '${o.location}': ${o._field}=${o._value}`
                // )
            results.push(o)
        },
        error(error) {
            console.error(error)
            console.log('\nFinished ERROR queryRows')
        },
        complete() {
            response.status(200).json(results)
            console.log('\nFinished SUCCESS queryRows')
        },
    })

});

async function recreateBucket(name) {
    console.log('*** Get organization by name ***')
    const orgsAPI = new OrgsAPI(influxDB)
    const organizations = await orgsAPI.getOrgs({ org })
    if (!organizations || !organizations.orgs || !organizations.orgs.length) {
        console.error(`No organization named "${org}" found!`)
    }
    const orgID = organizations.orgs[0].id
    console.log(`Using organization "${org}" identified by "${orgID}"`)

    console.log('*** Get buckets by name ***')
    const bucketsAPI = new BucketsAPI(influxDB)
    try {
        const buckets = await bucketsAPI.getBuckets({ orgID, name })
        if (buckets && buckets.buckets && buckets.buckets.length) {
            console.log(`Bucket named "${name}" already exists"`)
            const bucketID = buckets.buckets[0].id
                // console.log(`*** Delete Bucket "${name}" identified by "${bucketID}" ***`)
                // await bucketsAPI.deleteBucketsID({ bucketID })
        } else {
            console.log(`*** Create Bucket "${name}" ***`)
                // creates a bucket, entity properties are specified in the "body" property
            const bucket = await bucketsAPI.postBuckets({ body: { orgID, name } })
            console.log(
                JSON.stringify(
                    bucket,
                    (key, value) => (key === 'links' ? undefined : value),
                    2
                )
            )
        }
    } catch (e) {
        if (e instanceof HttpError && e.statusCode == 404) {
            // OK, bucket not found
        } else {
            throw e

        }
    }
}