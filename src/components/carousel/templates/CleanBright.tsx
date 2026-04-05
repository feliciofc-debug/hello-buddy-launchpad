import React from 'react';
import type { SlideTemplateProps } from './types';
import { ProgressDots, LogoBadge } from './shared';

export const CleanBrightCover: React.FC<SlideTemplateProps> = ({ title, body, primaryColor, logoUrl, totalSlides }) => (
  <div style={{
    width: 1080, height: 1350, position: 'relative', overflow: 'hidden',
    background: '#FFFFFF',
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
    padding: '80px',
  }}>
    {/* Top color bar */}
    <div style={{ position: 'absolute', top: 0, left: 60, right: 60, height: 6, borderRadius: 3, background: primaryColor }} />

    {/* Subtle background shape */}
    <div style={{ position: 'absolute', bottom: -200, right: -200, width: 500, height: 500, borderRadius: '50%', background: `${primaryColor}06` }} />
    <div style={{ position: 'absolute', top: -100, left: -100, width: 300, height: 300, borderRadius: '50%', background: `${primaryColor}04` }} />

    <LogoBadge logoUrl={logoUrl} />

    {/* Badge */}
    <div style={{
      background: `${primaryColor}10`, borderRadius: 12, padding: '10px 28px', marginBottom: 40,
    }}>
      <span style={{ color: primaryColor, fontSize: 16, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' }}>GUIA COMPLETO</span>
    </div>

    {/* Title */}
    <h1 style={{
      color: '#0F172A', fontSize: 62, fontWeight: 900, textAlign: 'center',
      lineHeight: 1.1, margin: 0, marginBottom: 30,
    }}>
      {title}
    </h1>

    {body && (
      <p style={{ color: '#64748B', fontSize: 26, textAlign: 'center', lineHeight: 1.5, margin: 0, maxWidth: 800 }}>
        {body}
      </p>
    )}

    <div style={{ position: 'absolute', bottom: 60, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <span style={{ color: '#94A3B8', fontSize: 15, letterSpacing: 2 }}>DESLIZE →</span>
      <ProgressDots current={0} total={totalSlides} activeColor={primaryColor} inactiveColor="#E2E8F0" />
    </div>
  </div>
);

export const CleanBrightContent: React.FC<SlideTemplateProps> = ({ title, body, number, primaryColor, logoUrl, totalSlides, imageUrl }) => (
  <div style={{
    width: 1080, height: 1350, position: 'relative', overflow: 'hidden',
    background: '#FFFFFF',
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    display: 'flex', flexDirection: 'column', padding: '80px',
  }}>
    {/* Top accent */}
    <div style={{ position: 'absolute', top: 0, left: 60, right: 60, height: 5, borderRadius: 3, background: primaryColor }} />

    {/* Number badge */}
    <div style={{
      width: 80, height: 80, borderRadius: 20, background: primaryColor,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginBottom: 36, boxShadow: `0 6px 20px ${primaryColor}30`,
    }}>
      <span style={{ color: '#FFF', fontSize: 40, fontWeight: 900 }}>{number || 1}</span>
    </div>

    {/* Title */}
    <h2 style={{
      color: '#0F172A', fontSize: 54, fontWeight: 800, lineHeight: 1.15,
      margin: 0, marginBottom: 28,
    }}>
      {title}
    </h2>

    {/* Divider */}
    <div style={{ width: 70, height: 4, borderRadius: 2, background: primaryColor, marginBottom: 28 }} />

    {/* Body */}
    {body && (
      <div style={{
        background: '#F8FAFC', borderRadius: 24, padding: '36px 40px',
        border: '1px solid #F1F5F9', flex: 1,
        boxShadow: '0 2px 16px rgba(0,0,0,0.03)',
      }}>
        {body.split('\n').filter(Boolean).map((line, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: primaryColor, marginTop: 9, flexShrink: 0 }} />
            <p style={{ color: '#334155', fontSize: 26, lineHeight: 1.5, margin: 0 }}>{line}</p>
          </div>
        ))}
      </div>
    )}

    {imageUrl && (
      <div style={{ marginTop: 24, borderRadius: 20, overflow: 'hidden', border: '1px solid #F1F5F9', maxHeight: 320 }}>
        <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )}

    <div style={{ position: 'absolute', bottom: 50, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
      <ProgressDots current={number || 0} total={totalSlides} activeColor={primaryColor} inactiveColor="#E2E8F0" />
    </div>
    <LogoBadge logoUrl={logoUrl} />
  </div>
);

export const CleanBrightCTA: React.FC<SlideTemplateProps> = ({ title, body, primaryColor, logoUrl, totalSlides, profileHandle, ctaLabel }) => (
  <div style={{
    width: 1080, height: 1350, position: 'relative', overflow: 'hidden',
    background: '#FFFFFF',
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
    padding: '80px',
  }}>
    <div style={{ position: 'absolute', top: 0, left: 60, right: 60, height: 5, borderRadius: 3, background: primaryColor }} />
    <div style={{ position: 'absolute', bottom: -200, left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, borderRadius: '50%', background: `${primaryColor}06` }} />

    <h2 style={{ color: '#0F172A', fontSize: 58, fontWeight: 900, textAlign: 'center', lineHeight: 1.1, margin: 0, marginBottom: 30 }}>
      {title}
    </h2>

    {body && <p style={{ color: '#64748B', fontSize: 24, textAlign: 'center', lineHeight: 1.6, margin: 0, marginBottom: 50, maxWidth: 800 }}>{body.replace(/\\n/g, '\n')}</p>}

    <div style={{ background: primaryColor, borderRadius: 60, padding: '22px 60px', boxShadow: `0 8px 30px ${primaryColor}40` }}>
      <span style={{ color: '#FFF', fontSize: 26, fontWeight: 700 }}>{ctaLabel || 'COMECE AGORA'}</span>
    </div>

    {profileHandle && <p style={{ color: '#94A3B8', fontSize: 22, marginTop: 36 }}>{profileHandle}</p>}

    <div style={{ position: 'absolute', bottom: 50, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
      <ProgressDots current={totalSlides - 1} total={totalSlides} activeColor={primaryColor} inactiveColor="#E2E8F0" />
    </div>
    <LogoBadge logoUrl={logoUrl} />
  </div>
);
