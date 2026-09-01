import { C } from "../theme";

export const Phone: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      width: 640,
      height: 1120,
      borderRadius: 56,
      background: C.panel,
      border: `2px solid ${C.line}`,
      boxShadow: "0 60px 120px rgba(0,0,0,0.55)",
      overflow: "hidden",
      position: "relative",
      ...style,
    }}
  >
    <div
      style={{
        height: 78,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 28px",
        borderBottom: `1px solid ${C.line}`,
        background: C.bg2,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: C.orange,
        }}
      />
      <span style={{ color: C.text, fontSize: 26, fontWeight: 700, letterSpacing: 1 }}>
        AMZ
      </span>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{ width: 26, height: 4, borderRadius: 2, background: C.muted }}
          />
        ))}
      </div>
    </div>
    {children}
  </div>
);
