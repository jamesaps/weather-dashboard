// API Key
var apiKey = '60138034af71780e3420402cea540efb';

var geoApiURLPrefix = 'https://api.openweathermap.org/geo/1.0/direct?';
var currentWeatherApiURLPrefix = 'https://api.openweathermap.org/data/2.5/weather?';
var forecastWeatherApiURLPrefix = 'https://api.openweathermap.org/data/2.5/forecast?';

var weatherApiImagePrefix = 'https://openweathermap.org/img/wn/';

var todaySection = document.getElementById('today');
var forecastSection = document.getElementById('forecast');
var searchButton = document.getElementById('search-button');

var hourForDailyTemperature = 12; // the temperature at noon is used for daily temperature

var timezoneOffset = new Date().getTimezoneOffset();

var apiError = ''; // non empty string when an api error occurs - globally scoped because it is accessed in numerous closures
var loading = false; // application state to indicate if an api request is being handled
var sleepTime = 1000; // configures how many milliseconds to sleep for when function is called
var previousSearchLimit = 10; // max number of locations to display to user that were previously searched

var searchForm = document.getElementById('search-form');

var localStorageCoordinates = [];

if (searchForm.attachEvent) {
    searchForm.attachEvent('submit', processSearch)
} else {
    searchForm.addEventListener('submit', processSearch);
}

setUpLocalStores();
renderPreviouslySearchedLocations();

function setUpLocalStores() {
    var coordinates = localStorage.getItem('coordinates');

    if (coordinates !== null) {
        localStorageCoordinates = JSON.parse(coordinates);
    }
}

function renderPreviouslySearchedLocations() {
    if (localStorageCoordinates.length === 0) {
        return;
    }

    var historyContainer = document.getElementById('history');
    clearElement(historyContainer);

    var historyHr = document.getElementById('history-hr');
    historyHr.classList.remove('d-none');

    for (var i = 0, j = localStorageCoordinates.length - 1; i < previousSearchLimit && j >= 0; ++i, --j) {
        var locationName = localStorageCoordinates[j].name;
        var trimmedLocationName = localStorageCoordinates[j].trimmedName;

        var historyButton = document.createElement('button');
        historyButton.classList.add('btn', 'btn-secondary', 'mb-2');
        historyButton.setAttribute('type', 'button');

        historyButton.dataset.name = trimmedLocationName;
        historyButton.textContent = locationName;

        historyButton.addEventListener('click', function (event) {
            searchForWeatherByLocation(event.target.dataset.name);
        });

        historyContainer.appendChild(historyButton);
    }
}

function processSearch(event) {
    event.preventDefault();

    if (loading) {
        return;
    }

    var searchInput = document.getElementById('search-input');
    var searchTerm = searchInput.value;

    if (searchTerm === '') {
        searchTerm = searchInput.getAttribute('placeholder');
    }

    searchForWeatherByLocation(searchTerm);
}

function putApplicationInLoadingState() {
    loading = true;

    searchButton.disabled = true;

    clearElement(todaySection);
    clearElement(forecastSection);

    var spinnerContainer = document.createElement('div');
    spinnerContainer.classList.add('d-flex', 'justify-content-center', 'my-3');
    todaySection.appendChild(spinnerContainer);

    var spinnerBorder = document.createElement('div');
    spinnerBorder.classList.add('spinner-border', 'text-primary');
    spinnerBorder.setAttribute('role', 'status');
    spinnerContainer.appendChild(spinnerBorder);
}

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
        throw new Error(`Location ${location} was not recognised.`);
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
    var date = dayjs(weatherData.dt * 1000 + weatherData.timezone * 1000 + timezoneOffset * 60 * 1000);

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

    for (var i = 0; i < forecast.list.length; ++i) {
        var forecastInstance = forecast.list[i];

        // gets time local to weather location
        var time = dayjs(forecastInstance.dt * 1000 + forecast.city.timezone * 1000 + timezoneOffset * 60 * 1000);

        // API returns a temperature value each 3 hours, so we cover a 3-hour period from the time we specified in configuration (hourForDailyTemperature)
        if (time.hour() >= hourForDailyTemperature && time.hour() < hourForDailyTemperature + 3) {
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
    if (loading) {
        return;
    }

    apiError = '';

    putApplicationInLoadingState();

    // limits load on API during development and also allows user to view loading functionality - not suitable for production, but more for demonstrative purposes
    await sleep(sleepTime);

    try {
        var locationCoordinates = getLocationCoordinatesFromLocalStorage(location);

        if (locationCoordinates === undefined) { // if not found in local storage
            await sleep(sleepTime * 1.5); // emulate network connections taking longer

            locationCoordinates = await getLatAndLonByLocationName(location);

            addLocationCoordinatesToLocalStorage(location, locationCoordinates);
        }

        var [weatherData, forecastData] = await Promise.all([
            getCurrentWeatherData(locationCoordinates), get5DayForecast(locationCoordinates)]);

        var forecastSummary = getDailyForecastAtHour(forecastData, hourForDailyTemperature);

        updateTodayUI(weatherData);
        updateForecastUI(forecastSummary);
    } catch (error) {
        resetUI();

        if (apiError !== '') {
            alert(apiError);
        } else {
            alert(error);
        }
    }

    searchButton.disabled = false;
    loading = false;
}

function getLocationCoordinatesFromLocalStorage(location) {
    var locationTrimmedToLowerCase = location.trim().toLowerCase();
    renderPreviouslySearchedLocations();

    var coordinates = localStorageCoordinates.find((element) => element.trimmedName === locationTrimmedToLowerCase);

    // Move coordinates to end of the storage so they appear first in history list even
    if (coordinates !== undefined) {
        localStorageCoordinates = localStorageCoordinates.filter(element => element.trimmedName !== locationTrimmedToLowerCase);

        localStorageCoordinates.push(coordinates);
        saveLocationCoordinatesToLocalStorage();
    }

    return coordinates;
}

function addLocationCoordinatesToLocalStorage(location, coordinates) {
    var locationTrimmedToLowerCase = location.trim().toLowerCase();

    if (getLocationCoordinatesFromLocalStorage(location) !== undefined) {
        return;
    }

    coordinates.trimmedName = locationTrimmedToLowerCase;

    localStorageCoordinates.push(coordinates);
    saveLocationCoordinatesToLocalStorage();
}

function saveLocationCoordinatesToLocalStorage() {
    var localStorageCoordinatesStringified = JSON.stringify(localStorageCoordinates);

    localStorage.setItem('coordinates', localStorageCoordinatesStringified);
    renderPreviouslySearchedLocations();
}

function resetUI() {
    clearElement(todaySection);
    clearElement(forecastSection);

    var headingElement = document.createElement('h3');
    headingElement.classList.add('p-3', 'text-center')
    headingElement.textContent = 'Search for weather forecasts ';
    todaySection.append(headingElement);

    var subHeadingElement = document.createElement('span');
    subHeadingElement.classList.add('text-primary');
    subHeadingElement.textContent = 'all over the world';
    headingElement.appendChild(subHeadingElement);
}

function updateApiError(newError) {
    if (apiError === '') {
        apiError = newError;
    }
}

function updateTodayUI(weatherData) {
    clearElement(todaySection);

    var todayDateFormattedAsString = weatherData.date.format('DD/MM/YYYY');

    var headingElement = document.createElement('h2');
    headingElement.classList.add('mb-3', 'fw-bold');
    headingElement.textContent = `${weatherData.location} (${todayDateFormattedAsString})`;

    for (var i = 0; i < weatherData.weatherIcons.length; ++i) {
        var iconCode = weatherData.weatherIcons[i];
        var weatherIcon = createWeatherIcon(iconCode);
        weatherIcon.classList.add('bg-secondary', 'p-2', 'rounded-1', 'ms-3')

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
    clearElement(forecastSection);

    var forecastHeading = document.createElement('h3');
    forecastHeading.classList.add('fw-bold', 'fs-4');
    forecastHeading.textContent = '5-Day Forecast:';
    forecastSection.appendChild(forecastHeading);

    var containerRow = document.createElement('div');
    containerRow.classList.add('row');
    forecastSection.appendChild(containerRow);

    for (var i = 0; i < forecastData.length && i < 5; ++i) {
        var forecastDateFormattedAsString = forecastData[i].time.format('DD/MM/YYYY');

        var flexContainer = document.createElement('div');
        flexContainer.classList.add('col-md', 'd-flex', 'align-items-stretch');

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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}