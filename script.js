// API Key
var apiKey = '60138034af71780e3420402cea540efb';

var geoApiURLPrefix = 'http://api.openweathermap.org/geo/1.0/direct?';
var currentWeatherApiURLPrefix = 'https://api.openweathermap.org/data/2.5/weather?';
var forecastWeatherApiURLPrefix = 'https://api.openweathermap.org/data/2.5/forecast?';

var weatherApiImagePrefix = 'https://openweathermap.org/img/wn/';

var hourForDailyTemperature = 12;

var d = new Date()
var timezoneOffset = d.getTimezoneOffset();

var apiError = '';

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

    var response = await fetch(url);

    if (!response.ok) {
        updateApiError('An API Error occurred. Please try again later.');
        throw new Error(response.statusText);
    }

    var locations = await response.json();

    if (locations.length === 0) {
        updateApiError('Location not found.');
        throw new Error(`Location ${location} was not recognised.`)
    }

    var { name, lat, lon } = locations[0];

    coordinates.name = name;
    coordinates.lat = lat;
    coordinates.lon = lon;

    return coordinates;

}

async function getCurrentWeatherData(coordinates) {
    // instantiate current weather data return object
    var currentWeatherData = {};

    // construct url using user provided latitude and longitude
    var url = currentWeatherApiURLPrefix + `lat=${coordinates.lat}&lon=${coordinates.lon}&appid=${apiKey}`;

    var response = await fetch(url);

    if (!response.ok) {
        updateApiError('An API Error occurred. Please try again later.');
        throw new Error(response.statusText);
    }

    var weatherData = await response.json();

    // offset date to show weather-local timezone despite dayjs being configured to user-local timezone
    var date = dayjs(weatherData.dt * 1000 + weatherData.timezone * 1000 + timezoneOffset * 60 * 1000)

    currentWeatherData.location = coordinates.name;
    currentWeatherData.date = date;
    currentWeatherData.temperature = convertTemperatureInKtoC(weatherData.main.temp).toFixed(2); // API returns weather in Kelvin so we convert to Celsius using a helper function before returning
    currentWeatherData.wind = convertMpsToKph(weatherData.wind.speed).toFixed(2); // API returns m/s so we convert to kph first
    currentWeatherData.humidity = weatherData.main.humidity;
    currentWeatherData.weatherIcons = weatherData.weather.map(condition => condition.icon);

    return currentWeatherData;
}

async function get5DayForecast(coordinates) {
    var forecast = [];

    // construct url
    var url = forecastWeatherApiURLPrefix + `lat=${coordinates.lat}&lon=${coordinates.lon}&appid=${apiKey}`;

    var response = await fetch(url);

    if (!response.ok) {
        updateApiError('An API Error occurred. Please try again later.');
        throw new Error(response.statusText);
    }

    var forecastData = await response.json();
    forecastData.location = coordinates.name;

    return forecastData;
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
                temperature: convertTemperatureInKtoC(forecastInstance.main.temp).toFixed(2),
                wind: convertMpsToKph(forecastInstance.wind.speed).toFixed(2),
                humidity: forecastInstance.main.humidity,
                weatherIcons: forecastInstance.weather.map(condition => condition.icon)
            });
        }
    }

    return dailyForecast;
}

async function searchForWeatherByLocation(location) {
    apiError = '';

    try {
        var locationCoordinates = await getLatAndLonByLocationName(location);

        getCurrentWeatherData(locationCoordinates).then((weatherData) => {
            updateTodayUI(weatherData);
        });

        get5DayForecast(locationCoordinates).then((forecastData) => {
            var forecastSummary = getDailyForecastAtHour(forecastData, hourForDailyTemperature);
            updateForecastUI(forecastSummary);
        });

    } catch (error) {

    }

    console.log(apiError);
}

function updateApiError(newError) {
    if (apiError === '') {
        apiError = newError;
    }
}

function updateTodayUI(weatherData) {
    var todaySection = document.getElementById('today');

    clearElement(todaySection);

    var todayDateFormattedAsString = weatherData.date.format('DD/MM/YYYY');

    var headingElement = document.createElement('h2');
    headingElement.classList.add('mb-3', 'fw-bold');
    headingElement.textContent = `${weatherData.location} (${todayDateFormattedAsString})`;

    for (var i = 0; i < weatherData.weatherIcons.length; ++i) {
        var iconCode = weatherData.weatherIcons[i];
        var weatherIcon = createWeatherIcon(iconCode);

        headingElement.append(weatherIcon);
    }

    todaySection.appendChild(headingElement);

    var temperatureString = `Temp: ${weatherData.temperature} °C`;
    var windString = `Wind: ${weatherData.wind} km/h`;
    var humidityString = `Humidity: ${weatherData.humidity}%`;

    [temperatureString, windString, humidityString].forEach(contents => {
        createAndAppendWeatherDetail(contents, todaySection);
    })
}

function createAndAppendWeatherDetail(contents, destination, additionalClasses) {
    var weatherDetailElement = document.createElement('p');
    weatherDetailElement.classList.add('weather-detail');

    if (additionalClasses !== undefined) {
        weatherDetailElement.classList.add(...additionalClasses);
    }
    weatherDetailElement.textContent = contents;

    destination.appendChild(weatherDetailElement);
}

function createWeatherIcon(code) {
    var weatherIconUrl = `${weatherApiImagePrefix}${code}@2x.png`;

    var weatherIcon = document.createElement('img');
    weatherIcon.setAttribute('src', weatherIconUrl);
    weatherIcon.setAttribute('height', '50px');
    weatherIcon.setAttribute('alt', 'weather icon');

    return weatherIcon;
}

function updateForecastUI(forecastData) {
    var forecastSection = document.getElementById('forecast');

    clearElement(forecastSection);

    var forecastHeading = document.createElement('h3');
    forecastHeading.classList.add('fw-bold', 'fs-4');
    forecastHeading.textContent = '5-Day Forecast:';
    forecastSection.appendChild(forecastHeading);

    var fluidContainer = document.createElement('div');
    fluidContainer.classList.add('container-fluid');
    forecastSection.appendChild(fluidContainer);

    var containerRow = document.createElement('div');
    containerRow.classList.add('row');
    fluidContainer.appendChild(containerRow);

    for (var i = 0; i < forecastData.length && i < 5; ++i) {
        var forecastDateFormattedAsString = forecastData[i].time.format('DD/MM/YYYY')

        var flexContainer = document.createElement('div');
        flexContainer.classList.add('col-md', 'd-flex', 'align-items-stretch', 'ps-0');

        containerRow.appendChild(flexContainer);

        var forecastCardElement = document.createElement('div');
        forecastCardElement.classList.add('forecast-card', 'w-100', 'bg-primary', 'forecast-card', 'p-2', 'pe-0', 'mb-2');
        flexContainer.appendChild(forecastCardElement);

        var forecastCardDateElement = document.createElement('div');
        forecastCardDateElement.classList.add('fw-bold');
        forecastCardDateElement.textContent = forecastDateFormattedAsString;
        forecastCardElement.appendChild(forecastCardDateElement);

        var iconContainer = document.createElement('div');
        forecastCardElement.appendChild(iconContainer)

        for (var j = 0; j < forecastData[i].weatherIcons.length; ++j) {
            var iconCode = forecastData[i].weatherIcons[j];
            var weatherIcon = createWeatherIcon(iconCode);

            iconContainer.appendChild(weatherIcon);
        }

        var temperatureString = `Temp: ${forecastData[i].temperature} °C`;
        var windString = `Wind: ${forecastData[i].wind} km/h`;
        var humidityString = `Humidity: ${forecastData[i].humidity}%`;

        [temperatureString, windString, humidityString].forEach(contents => {
            createAndAppendWeatherDetail(contents, forecastCardElement, ['mb-2']);
        })
    }
}

function clearElement(element) {
    element.innerHTML = '';
}

(async () => {
    var londonCoordinates = await getLatAndLonByLocationName('London');
    var currentWeather = await getCurrentWeatherData(londonCoordinates);
    var fiveDayForecast = await get5DayForecast(londonCoordinates);

    getDailyForecastAtHour(fiveDayForecast, 12);

    searchForWeatherByLocation('arizona')
})();

