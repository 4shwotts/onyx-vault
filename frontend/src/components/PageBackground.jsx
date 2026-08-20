import React from 'react';

export default function PageBackground() {
  return (
    <div className="chrome-bg-wrapper">
      <img
        src="/chrome-background.jpg"
        alt="Liquid Chrome Background"
        className="chrome-bg-image"
      />
      <div className="chrome-bg-overlay" />
    </div>
  );
}