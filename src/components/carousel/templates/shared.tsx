import React from 'react';

export const ProgressDots = ({ current, total, activeColor, inactiveColor }: {
  current: number; total: number; activeColor: string; inactiveColor: string;
}) => (
  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
    {Array.from({ length: total }).map((_, i) => (
      <div key={i} style={{
        width: i === current ? 28 : 10,
        height: 10,
        borderRadius: 5,
        background: i === current ? activeColor : inactiveColor,
        transition: 'all 0.3s',
        boxShadow: i === current ? `0 0 8px ${activeColor}60` : 'none',
      }} />
    ))}
  </div>
);

export const LogoBadge = ({ logoUrl }: { logoUrl?: string }) => {
  if (!logoUrl) return null;
  return (
    <div style={{
      position: 'absolute', bottom: 35, right: 35,
      width: 56, height: 56, borderRadius: 14, overflow: 'hidden',
      background: 'rgba(255,255,255,0.1)',
      border: '1px solid rgba(255,255,255,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  );
};
