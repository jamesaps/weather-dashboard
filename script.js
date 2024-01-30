// API Key
var apiKey = '60138034af71780e3420402cea540efb';

var geoApiURLPrefix = 'http://api.openweathermap.org/geo/1.0/direct?';
var currentWeatherApiURLPrefix = 'https://api.openweathermap.org/data/2.5/weather?';
var forecastWeatherApiURLPrefix = 'https://api.openweathermap.org/data/2.5/forecast?';

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

        var { lat, lon } = locations[0];

        coordinates.lat = lat;
        coordinates.lon = lon;

        return coordinates;
    } catch (error) {
        throw error;
    }
}

async function getCurrentWeatherData(lat, lon) {
    // instantiate current weather data return object
    var currentWeatherData = {};

    // construct url using user provided latitude and longitude
    var url = currentWeatherApiURLPrefix + `lat=${lat}&lon=${lon}&appid=${apiKey}`;

    try {
        var response = await fetch(url);

        if (!response.ok) {
            throw new Error(response.statusText);
        }

        var weatherData = await response.json();

        console.log(weatherData);

        currentWeatherData.temperature = convertTemperatureInKtoC(weatherData.main.temp); // API returns weather in Kelvin so we convert to Celsius using a helper function before returning
        currentWeatherData.wind = convertMpsToKph(weatherData.wind.speed); // API returns m/s so we convert to kph first
        currentWeatherData.humidity = weatherData.main.humidity;
        currentWeatherData.weatherIcon = weatherData.weather.icon;

        return currentWeatherData;
    } catch (error) {
        throw error;
    }
}

async function get5DayForecast(lat, lon) {
    var forecast = [];

    // construct url
    var url = forecastWeatherApiURLPrefix + `lat=${lat}&lon=${lon}&appid=${apiKey}`;

    try {
        var response = await fetch(url);

        if (!response.ok) {
            throw new Error(response.statusText);
        }

        var forecastData = await response.json();

        return forecastData;
    } catch (error) {
        throw error;
    }
}

function convertTemperatureInKtoC(temperature) {
    return temperature - 273.15;
}

function convertMpsToKph(mps) {
    // convert meters per second to kilometers per hour

    return mps * 3.6;
}

function getDailyForecastAtHour(forecast, hour) {
    var dailyForecast = [];

    var timezoneOffset = forecast.city.timezone; // offset from UTC in seconds

    for (var i = 0; i < forecast.list.length; ++i) {
        var forecastInstance = forecast.list[i]

        // gets time local to weather location
        var time = dayjs(forecastInstance.dt_txt);

        if (time.hour() === hour) {
            dailyForecast.push({
                time: time,
                temperature: convertTemperatureInKtoC(forecastInstance.main.temp),
                wind: convertMpsToKph(forecastInstance.wind.speed),
                humidity: forecastInstance.main.humidity,
                weatherIcon: forecastInstance.weather.icon
            });
        }
    }

    return dailyForecast;
}

(async () => {
    var londonCoordinates = await getLatAndLonByLocationName('London');
    var currentWeather = await getCurrentWeatherData(londonCoordinates.lat, londonCoordinates.lon);
    var fiveDayForecast = await get5DayForecast(londonCoordinates.lat, londonCoordinates.lon);

    getDailyForecastAtHour(fiveDayForecast, 12);
})();

