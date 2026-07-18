import React from 'react';
import type { SlideTemplateProps } from './types';
import { ProgressDots } from './shared';

const gold = '#D4AF37';

export const ElegantSerifCover: React.FC<SlideTemplateProps> = ({ title, body, primaryColor, logoUrl, totalSlides, businessName }) => (
  <div style={{
    width: 1080, height: 1350, position: 'relative', overflow: 'hidden',
    background: '#FAF8F5',
    fontFamily: "Georgia, 'Times New Roman', serif",
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
    padding: '100px',
  }}>
    {/* Gold frame */}
    <div style={{ position: 'absolute', top: 30, left: 30, right: 30, bottom: 30, border: `2px solid ${primaryColor || gold}`, borderRadius: 4 }} />
    <div style={{ position: 'absolute', top: 36, left: 36, right: 36, bottom: 36, border: `1px solid ${primaryColor || gold}40` }} />

    {/* Corner ornaments */}
    <div style={{ position: 'absolute', top: 45, left: 45, width: 40, height: 40, borderTop: `3px solid ${primaryColor || gold}`, borderLeft: `3px solid ${primaryColor || gold}` }} />
    <div style={{ position: 'absolute', top: 45, right: 45, width: 40, height: 40, borderTop: `3px solid ${primaryColor || gold}`, borderRight: `3px solid ${primaryColor || gold}` }} />
    <div style={{ position: 'absolute', bottom: 45, left: 45, width: 40, height: 40, borderBottom: `3px solid ${primaryColor || gold}`, borderLeft: `3px solid ${primaryColor || gold}` }} />
    <div style={{ position: 'absolute', bottom: 45, right: 45, width: 40, height: 40, borderBottom: `3px solid ${primaryColor || gold}`, borderRight: `3px solid ${primaryColor || gold}` }} />

    {/* Nome da empresa no topo */}
    {businessName && (
      <span style={{
        color: '#1A1A1A', fontSize: businessName.length > 20 ? 52 : 64, fontWeight: 800,
        letterSpacing: 4, textTransform: 'uppercase' as const, textAlign: 'center' as const,
        fontFamily: "Georgia, 'Times New Roman', serif",
        marginBottom: 30,
      }}>{businessName}</span>
    )}

    {/* Ornamental separator */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
      <div style={{ width: 60, height: 1, background: primaryColor || gold }} />
      <span style={{ color: primaryColor || gold, fontSize: 20 }}>✦</span>
      <div style={{ width: 60, height: 1, background: primaryColor || gold }} />
    </div>

    <h1 style={{
      color: '#1A1A1A', fontSize: 72, fontWeight: 700, textAlign: 'center',
      lineHeight: 1.15, margin: 0, marginBottom: 30,
      fontFamily: "Georgia, 'Times New Roman', serif",
    }}>
      {title}
    </h1>

    {/* Gold underline */}
    <div style={{ width: 100, height: 3, background: `linear-gradient(90deg, transparent, ${primaryColor || gold}, transparent)`, marginBottom: 30 }} />

    {body && (
      <p style={{ color: '#666', fontSize: 30, textAlign: 'center', lineHeight: 1.6, margin: 0, maxWidth: 750, fontFamily: "system-ui, -apple-system, sans-serif", fontWeight: 400 }}>
        {body}
      </p>
    )}

    <div style={{ position: 'absolute', bottom: 60, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <ProgressDots current={0} total={totalSlides} activeColor={primaryColor || gold} inactiveColor="#D4D0C8" />
    </div>

    {logoUrl && <img src={logoUrl} alt="Logo" style={{ position: 'absolute', top: 40, left: 60, maxWidth: 240, maxHeight: 120, objectFit: 'contain', opacity: 0.85 }} />}
  </div>
);

export const ElegantSerifContent: React.FC<SlideTemplateProps> = ({ title, body, number, primaryColor, logoUrl, totalSlides, imageUrl }) => (
  <div style={{
    width: 1080, height: 1350, position: 'relative', overflow: 'hidden',
    background: '#FAF8F5',
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    display: 'flex', flexDirection: 'column', padding: '80px',
  }}>
    {/* Frame */}
    <div style={{ position: 'absolute', top: 30, left: 30, right: 30, bottom: 30, border: `1.5px solid ${primaryColor || gold}50` }} />

    {/* Number with ornamental underline */}
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 36 }}>
      <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 72, fontWeight: 700, color: primaryColor || gold, lineHeight: 1 }}>
        {String(number || 1).padStart(2, '0')}
      </span>
      <div style={{ width: 50, height: 3, background: primaryColor || gold, marginTop: 8 }} />
    </div>

    {/* Title */}
    <h2 style={{
      color: '#1A1A1A', fontSize: 52, fontWeight: 700, lineHeight: 1.15,
      margin: 0, marginBottom: 28,
      fontFamily: "Georgia, 'Times New Roman', serif",
    }}>
      {title}
    </h2>

    {/* Separator */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
      <div style={{ width: 40, height: 1, background: primaryColor || gold }} />
      <span style={{ color: primaryColor || gold, fontSize: 14 }}>✦</span>
      <div style={{ flex: 1, height: 1, background: `${primaryColor || gold}30` }} />
    </div>

    {/* Body */}
    {body && (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, marginTop: 16 }}>
        {body.includes('\n') ? (
          body.split('\n').filter(Boolean).map((line, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 20,
              background: '#FAF8F5', borderRadius: 16,
              padding: '22px 30px',
              border: `1px solid ${primaryColor || gold}20`,
            }}>
              <span style={{ color: primaryColor || gold, fontSize: 22, flexShrink: 0 }}>◆</span>
              <p style={{
                color: '#333', fontSize: 36,
                fontWeight: 500, lineHeight: 1.4, margin: 0,
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}>{line}</p>
            </div>
          ))
        ) : (
          <div style={{
            background: '#FAF8F5', borderRadius: 20,
            padding: '36px 40px', border: `1px solid ${primaryColor || gold}30`,
          }}>
            <p style={{
              color: '#444', fontSize: 34,
              fontWeight: 400, lineHeight: 1.7, margin: 0,
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}>{body}</p>
          </div>
        )}
      </div>
    )}

    {imageUrl && (
      <div style={{ marginTop: 20, borderRadius: 8, overflow: 'hidden', border: `1px solid ${primaryColor || gold}30`, maxHeight: 320 }}>
        <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )}

    <div style={{ position: 'absolute', bottom: 50, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
      <ProgressDots current={number || 0} total={totalSlides} activeColor={primaryColor || gold} inactiveColor="#D4D0C8" />
    </div>
    {logoUrl && <img src={logoUrl} alt="Logo" style={{ position: 'absolute', bottom: 50, right: 60, maxWidth: 180, maxHeight: 85, objectFit: 'contain', opacity: 0.7 }} />}
  </div>
);

export const ElegantSerifCTA: React.FC<SlideTemplateProps> = ({ title, body, primaryColor, logoUrl, totalSlides, profileHandle, ctaLabel }) => (
  <div style={{
    width: 1080, height: 1350, position: 'relative', overflow: 'hidden',
    background: '#FAF8F5',
    fontFamily: "Georgia, 'Times New Roman', serif",
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
    padding: '100px',
  }}>
    <div style={{ position: 'absolute', top: 30, left: 30, right: 30, bottom: 30, border: `2px solid ${primaryColor || gold}` }} />

    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
      <div style={{ width: 60, height: 1, background: primaryColor || gold }} />
      <span style={{ color: primaryColor || gold, fontSize: 20 }}>✦</span>
      <div style={{ width: 60, height: 1, background: primaryColor || gold }} />
    </div>

    <h2 style={{ color: '#1A1A1A', fontSize: 56, fontWeight: 700, textAlign: 'center', lineHeight: 1.15, margin: 0, marginBottom: 30 }}>
      {title}
    </h2>

    <div style={{ width: 100, height: 3, background: `linear-gradient(90deg, transparent, ${primaryColor || gold}, transparent)`, marginBottom: 30 }} />

    {body && <p style={{ color: '#666', fontSize: 28, textAlign: 'center', lineHeight: 1.6, margin: 0, marginBottom: 50, fontFamily: "system-ui, -apple-system, sans-serif" }}>{body.replace(/\\n/g, '\n')}</p>}

    <div style={{ border: `2px solid ${primaryColor || gold}`, borderRadius: 4, padding: '20px 56px' }}>
      <span style={{ color: primaryColor || gold, fontSize: 24, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', fontFamily: "system-ui, -apple-system, sans-serif" }}>{ctaLabel || 'SAIBA MAIS'}</span>
    </div>

    {profileHandle && <p style={{ color: '#999', fontSize: 20, marginTop: 36, fontFamily: "system-ui, -apple-system, sans-serif" }}>{profileHandle}</p>}

    <div style={{ position: 'absolute', bottom: 50, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
      <ProgressDots current={totalSlides - 1} total={totalSlides} activeColor={primaryColor || gold} inactiveColor="#D4D0C8" />
    </div>
    {logoUrl && <img src={logoUrl} alt="Logo" style={{ position: 'absolute', bottom: 50, right: 60, maxWidth: 180, maxHeight: 85, objectFit: 'contain', opacity: 0.7 }} />}
  </div>
);
