import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Cloud, CloudRain, Sun, Moon, Wind, Droplets, RefreshCw, AlertCircle } from 'lucide-react';

/**
 * WeatherWidget Component
 * Displays real-time weather for Lahore
 * Features:
 * - Cached data (10 min TTL)
 * - Fast loading with spinner
 * - Contextual messages based on weather
 * - Icon representation
 */
const WeatherWidget = ({ showDetails = true, compact = false }) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isNightInLahore = () => {
    const hourString = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Asia/Karachi',
    }).format(new Date());
    const hour = Number(hourString);
    return hour >= 19 || hour < 6;
  };

  const shouldRenderNight = (iconCode) => {
    if (!iconCode) return isNightInLahore();

    const normalizedCode = iconCode.toLowerCase();
    if (normalizedCode.endsWith('n')) return true;
    if (normalizedCode.endsWith('d')) return isNightInLahore();

    return isNightInLahore();
  };

  const getDisplayIconCode = (iconCode) => {
    if (!iconCode) return null;
    if (iconCode.toLowerCase().endsWith('d') && shouldRenderNight(iconCode)) {
      return `${iconCode.slice(0, -1)}n`;
    }
    return iconCode;
  };

  useEffect(() => {
    fetchWeather();
    // Refresh every 10 minutes to match backend cache TTL
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchWeather = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/weather/lahore/`,
        {
          timeout: 5000, // Non-blocking timeout
        }
      );
      setWeather(response.data);
    } catch (err) {
      console.error('Weather fetch error:', err);
      setError('Failed to load weather data');
    } finally {
      setLoading(false);
    }
  };

  const getWeatherIcon = (condition, iconCode) => {
    const isNight = shouldRenderNight(iconCode);
    if (!condition) {
      return isNight ? <Moon className="w-8 h-8 text-indigo-500" /> : <Sun className="w-8 h-8 text-yellow-500" />;
    }

    const conditionLower = condition.toLowerCase();
    if (conditionLower.includes('rain') || conditionLower.includes('drizzle')) {
      return <CloudRain className="w-8 h-8 text-blue-500" />;
    }
    if (conditionLower.includes('cloud')) {
      return <Cloud className="w-8 h-8 text-gray-500" />;
    }
    if (conditionLower.includes('clear') || conditionLower.includes('sunny')) {
      return isNight ? <Moon className="w-8 h-8 text-indigo-500" /> : <Sun className="w-8 h-8 text-yellow-500" />;
    }
    return isNight ? <Moon className="w-8 h-8 text-indigo-500" /> : <Sun className="w-8 h-8 text-yellow-500" />;
  };

  const getDisplayCondition = (condition, iconCode) => {
    if (!condition) return 'Weather unavailable';

    if (shouldRenderNight(iconCode)) {
      const conditionLower = condition.toLowerCase();
      if (conditionLower.includes('clear') || conditionLower.includes('sunny')) {
        return 'Clear Night';
      }
    }

    return condition;
  };

  const getDisplayMessage = (message, condition, iconCode) => {
    if (!message) return null;

    if (shouldRenderNight(iconCode)) {
      const conditionLower = (condition || '').toLowerCase();
      if (conditionLower.includes('clear') || conditionLower.includes('sunny')) {
        return 'Calm night weather in Lahore';
      }
      if (message.toLowerCase().includes('day')) {
        return 'Current evening weather conditions in Lahore';
      }
    }

    return message;
  };

  const handleRefresh = () => {
    fetchWeather();
  };

  if (compact) {
    return (
      <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg p-3 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getWeatherIcon(weather?.condition, weather?.icon_code)}
            <div>
              <div className="text-sm font-semibold">Lahore</div>
              <div className="text-lg font-bold">{weather?.temperature}°C</div>
            </div>
          </div>
          {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 w-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-3 text-white">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Weather in Lahore</h2>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-1.5 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh weather"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading && !weather ? (
          <div className="flex items-center justify-center py-6">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
              <p className="text-gray-600">Loading weather...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        ) : weather ? (
          <>
            {/* Temperature and Condition */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-5xl font-bold text-gray-800 mb-1">
                  {Math.round(weather.temperature)}°C
                </div>
                <p className="text-base text-gray-600 font-semibold">{getDisplayCondition(weather.condition, weather.icon_code)}</p>
                {weather.contextual_message && (
                  <p className="text-sm text-blue-600 mt-1.5 font-medium">
                    {getDisplayMessage(weather.contextual_message, weather.condition, weather.icon_code)}
                  </p>
                )}
              </div>
              <div className="text-5xl">
                {getDisplayIconCode(weather.icon_code) ? (
                  <img
                    src={`https://openweathermap.org/img/wn/${getDisplayIconCode(weather.icon_code)}@2x.png`}
                    alt={weather.condition}
                    className="w-16 h-16"
                  />
                ) : (
                  getWeatherIcon(weather.condition, weather.icon_code)
                )}
              </div>
            </div>

            {/* Details */}
            {showDetails && (
              <div className="bg-white rounded-lg p-3 grid grid-cols-2 gap-3 border border-gray-200">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Humidity</p>
                    <p className="text-base font-semibold text-gray-800">{weather.humidity}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Wind className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Wind Speed</p>
                    <p className="text-base font-semibold text-gray-800">{weather.wind_speed} m/s</p>
                  </div>
                </div>
              </div>
            )}

            {/* Last Updated */}
            <p className="text-xs text-gray-500 mt-4 text-center">
              Last updated: {new Date(weather.updated_at).toLocaleTimeString()}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default WeatherWidget;
