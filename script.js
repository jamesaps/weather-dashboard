// API Key
var apiKey = '60138034af71780e3420402cea540efb';

var geoApiURLPrefix = 'http://api.openweathermap.org/geo/1.0/direct?';

async function getLatAndLonByLocationName(location) {
    // instantiate return object
    var coordinates = {};

    // create query string portion of URL from user input
    var queryString = `q=${location}`;
    // create App ID portion of URL using API key
    var appId = `appid=${apiKey}`;

    // construct url using components above
    var url = geoApiURLPrefix + [queryString, appId].join('&');

    // Attempt to perform fetch request on URL. If this returns a 404, despite being caught, Google Chrome will display this error in the browser
    try {
        var response = await fetch(url);

        if (!response.ok) {
            throw new Error(response.statusText);
        }

        var locations = await response.json();

        if (locations.length === 0) {
            throw new Error(`Location ${location} was not recognised.`)
        }

        var { lat, lon } = locations[0]

        coordinates.lat = lat;
        coordinates.lon = lon;

        return coordinates;
    } catch (error) {
        // Advise user of error - this will be updated to actually propagate the error to the context that calls this function.
        alert(error);
    }
}

getLatAndLonByLocationName('London')