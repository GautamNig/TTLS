// src/components/ui/LoadingSpinner.jsx
import React from 'react';

const LoadingSpinner = ({ message = "Loading..." }) => {
  return (
    <div className="min-h-screen flex items-center justify-center text-white">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
        <div>{message}</div>
      </div>
    </div>
  );
};

export default LoadingSpinner;