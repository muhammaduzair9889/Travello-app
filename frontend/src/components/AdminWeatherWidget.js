import React from 'react';
import WeatherWidget from './WeatherWidget';

/**
 * Weather Display for Admin Dashboard
 * Shows weather widget in a dedicated section
 */
const AdminWeatherWidget = () => {
  return (
    <div className="w-full">
      <WeatherWidget showDetails={true} compact={false} />
    </div>
  );
};

export default AdminWeatherWidget;
