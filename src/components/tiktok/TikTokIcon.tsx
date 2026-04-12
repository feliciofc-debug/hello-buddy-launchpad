import React from 'react';

interface TikTokIconProps {
  className?: string;
}

export const TikTokIcon: React.FC<TikTokIconProps> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.88-2.88 2.89 2.89 0 012.88-2.88c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.3a6.34 6.34 0 0010.86 4.46 6.34 6.34 0 001.83-4.46V8.76a8.26 8.26 0 004.79 1.52V6.84a4.85 4.85 0 01-1.04-.15z"/>
  </svg>
);
