
"use strict";

// Open-Meteo public REST API endpoints
const GEOCODING_API =
  "https://geocoding-api.open-meteo.com/v1/search";

const WEATHER_API =
  "https://api.open-meteo.com/v1/forecast";

// Get HTML elements
const searchForm = document.getElementById("searchForm");
const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const statusMessage = document.getElementById("statusMessage");
const weatherDashboard = document.getElementById("weatherDashboard");

const elements = {
  cityName: document.getElementById("cityName"),
  locationDetails: document.getElementById("locationDetails"),
  updatedAt: document.getElementById("updatedAt"),
  weatherIcon: document.getElementById("weatherIcon"),
  temperature: document.getElementById("temperature"),
  weatherDescription: document.getElementById("weatherDescription"),
  feelsLike: document.getElementById("feelsLike"),
  humidity: document.getElementById("humidity"),
  windSpeed: document.getElementById("windSpeed"),
  feelsMetric: document.getElementById("feelsMetric"),
  precipitation: document.getElementById("precipitation"),
  dayIcon: document.getElementById("dayIcon"),
  dayStatus: document.getElementById("dayStatus"),
  coordinates: document.getElementById("coordinates")
};

// Translate Open-Meteo weather codes into descriptions and icons
const weatherConditions = {
  0:  { description: "Clear sky", icon: "☀️" },
  1:  { description: "Mainly clear", icon: "🌤️" },
  2:  { description: "Partly cloudy", icon: "⛅" },
  3:  { description: "Overcast", icon: "☁️" },
  45: { description: "Fog", icon: "🌫️" },
  48: { description: "Depositing rime fog", icon: "🌫️" },
  51: { description: "Light drizzle", icon: "🌦️" },
  53: { description: "Moderate drizzle", icon: "🌦️" },
  55: { description: "Dense drizzle", icon: "🌧️" },
  56: { description: "Light freezing drizzle", icon: "🌧️" },
  57: { description: "Dense freezing drizzle", icon: "🌧️" },
  61: { description: "Slight rain", icon: "🌦️" },
  63: { description: "Moderate rain", icon: "🌧️" },
  65: { description: "Heavy rain", icon: "🌧️" },
  66: { description: "Light freezing rain", icon: "🌧️" },
  67: { description: "Heavy freezing rain", icon: "🌧️" },
  71: { description: "Slight snowfall", icon: "🌨️" },
  73: { description: "Moderate snowfall", icon: "🌨️" },
  75: { description: "Heavy snowfall", icon: "❄️" },
  77: { description: "Snow grains", icon: "❄️" },
  80: { description: "Slight rain showers", icon: "🌦️" },
  81: { description: "Moderate rain showers", icon: "🌧️" },
  82: { description: "Violent rain showers", icon: "⛈️" },
  85: { description: "Slight snow showers", icon: "🌨️" },
  86: { description: "Heavy snow showers", icon: "❄️" },
  95: { description: "Thunderstorm", icon: "⛈️" },
  96: { description: "Thunderstorm with slight hail", icon: "⛈️" },
  99: { description: "Thunderstorm with heavy hail", icon: "⛈️" }
};

// Display loading, success, and error messages
function showStatus(message, type = "loading") {
  statusMessage.textContent = message;
  statusMessage.className = "status-message";

  if (type === "error") {
    statusMessage.classList.add("error");
  }

  statusMessage.hidden = false;
}

function hideStatus() {
  statusMessage.hidden = true;
}

// Make an HTTP request and safely parse the JSON response
async function fetchJSON(url) {
  let response;

  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(
      "Unable to connect. Please check your internet connection."
    );
  }

  // Fetch does not automatically reject HTTP error responses
  if (!response.ok) {
    throw new Error(
      `Weather service error (HTTP ${response.status}). Please try again.`
    );
  }

  try {
    return await response.json();
  } catch (error) {
    throw new Error("The server returned invalid JSON data.");
  }
}

// Step 1: Find a city's latitude and longitude
async function getCityCoordinates(city) {
  const params = new URLSearchParams({
    name: city,
    count: "1",
    language: "en",
    format: "json"
  });

  const data = await fetchJSON(
    `${GEOCODING_API}?${params.toString()}`
  );

  // Validate the nested JSON response
  if (!Array.isArray(data.results) || data.results.length === 0) {
    throw new Error(
      `City "${city}" was not found. Check the spelling and try again.`
    );
  }

  const place = data.results[0];

  if (
    typeof place.latitude !== "number" ||
    typeof place.longitude !== "number"
  ) {
    throw new Error("Location coordinates are unavailable.");
  }

  return {
    name: place.name,
    country: place.country || "",
    admin: place.admin1 || "",
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone || "auto"
  };
}

// Step 2: Fetch current weather using the city's coordinates
async function getCurrentWeather(place) {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "precipitation",
      "weather_code",
      "wind_speed_10m"
    ].join(","),
    timezone: place.timezone,
    forecast_days: "1"
  });

  const data = await fetchJSON(
    `${WEATHER_API}?${params.toString()}`
  );

  // The API returns current weather inside a nested object
  if (!data.current) {
    throw new Error("Current weather data is unavailable.");
  }

  const weather = data.current;

  // Validate required fields before displaying them
  const requiredFields = [
    "temperature_2m",
    "relative_humidity_2m",
    "apparent_temperature",
    "is_day",
    "precipitation",
    "weather_code",
    "wind_speed_10m"
  ];

  for (const field of requiredFields) {
    if (
      typeof weather[field] !== "number" ||
      !Number.isFinite(weather[field])
    ) {
      throw new Error("The weather service returned incomplete data.");
    }
  }

  return {
    temperature: weather.temperature_2m,
    humidity: weather.relative_humidity_2m,
    feelsLike: weather.apparent_temperature,
    isDay: weather.is_day,
    precipitation: weather.precipitation,
    weatherCode: weather.weather_code,
    windSpeed: weather.wind_speed_10m,
    time: weather.time,
    temperatureUnit: data.current_units?.temperature_2m || "°C",
    windUnit: data.current_units?.wind_speed_10m || "km/h",
    humidityUnit: data.current_units?.relative_humidity_2m || "%"
  };
}

// Step 3: Render the weather data on the dashboard
function renderWeather(place, weather) {
  const condition = weatherConditions[weather.weatherCode] || {
    description: "Weather condition unavailable",
    icon: "🌍"
  };

  // Location information
  elements.cityName.textContent = place.name;

  const locationParts = [place.admin, place.country].filter(Boolean);
  elements.locationDetails.textContent =
    locationParts.join(", ") || "Location details unavailable";

  // Main weather information
  elements.weatherIcon.textContent = condition.icon;
  elements.weatherDescription.textContent = condition.description;
  elements.temperature.textContent =
    Math.round(weather.temperature);

  elements.feelsLike.textContent =
    `Feels like ${Math.round(weather.feelsLike)}°C`;

  // Weather metric cards
  elements.humidity.textContent =
    Math.round(weather.humidity);

  elements.windSpeed.textContent =
    weather.windSpeed.toFixed(1);

  elements.feelsMetric.textContent =
    Math.round(weather.feelsLike);

  elements.precipitation.textContent =
    weather.precipitation.toFixed(1);

  // Day/night information
  elements.dayIcon.textContent = weather.isDay ? "☀️" : "🌙";
  elements.dayStatus.textContent =
    weather.isDay ? "Daytime" : "Nighttime";

  // Coordinates
  elements.coordinates.textContent =
    `Lat ${place.latitude.toFixed(2)}°, Lon ${place.longitude.toFixed(2)}°`;

  // Format the observation time returned by the API
  if (weather.time) {
    const date = new Date(weather.time);

    elements.updatedAt.textContent =
      Number.isNaN(date.getTime())
        ? "Latest observation"
        : `Observation: ${date.toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short"
          })}`;
  } else {
    elements.updatedAt.textContent = "Latest observation";
  }

  weatherDashboard.hidden = false;
}

// Step 4: Search and display the weather for a city
async function searchWeather(city) {
  const trimmedCity = city.trim();

  if (!trimmedCity) {
    showStatus("Please enter a city name.", "error");
    cityInput.focus();
    return;
  }

  searchBtn.disabled = true;
  searchBtn.textContent = "Loading...";
  weatherDashboard.hidden = true;
  showStatus("Fetching live weather data...");

  try {
    // First request: city name -> geographic coordinates
    const place = await getCityCoordinates(trimmedCity);

    // Second request: coordinates -> current weather
    const weather = await getCurrentWeather(place);

    // Display the processed JSON data
    renderWeather(place, weather);
    hideStatus();

    cityInput.value = place.name;
  } catch (error) {
    console.error("Weather dashboard error:", error);
    showStatus(
      error.message || "Something went wrong. Please try again.",
      "error"
    );
  } finally {
    // Always restore the search button
    searchBtn.disabled = false;
    searchBtn.innerHTML = 'Search <span>→</span>';
  }
}

// Handle form submission
searchForm.addEventListener("submit", function (event) {
  event.preventDefault();
  searchWeather(cityInput.value);
});

// Handle popular city buttons
document.querySelectorAll(".city-chip").forEach((button) => {
  button.addEventListener("click", function () {
    const city = button.dataset.city;
    cityInput.value = city;
    searchWeather(city);
  });
});
