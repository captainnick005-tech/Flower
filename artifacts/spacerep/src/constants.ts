import React from "react";

export const DEFAULT_INTERVALS = [0, 1, 3, 7, 15, 30, 60, 90];
export const DEFAULT_LABELS    = ["Same Day", "+1 Day", "+3 Days", "+7 Days", "+15 Days", "+30 Days", "+60 Days", "+90 Days"];

export function intervalsToLabels(intervals: number[]): string[] {
  return intervals.map(i => i === 0 ? "Same Day" : `+${i} Day${i !== 1 ? "s" : ""}`);
}

export const C = {
  bg:       "#0b0d14",
  card:     "#13161f",
  surface:  "#1c1f2e",
  border:   "#252840",
  accent:   "#7c6fff",
  accentDim:"#3d3880",
  green:    "#34d399",
  greenDim: "#064e3b",
  yellow:   "#fbbf24",
  yellowDim:"#451a03",
  red:      "#f87171",
  redDim:   "#450a0a",
  blue:     "#60a5fa",
  blueDim:  "#1e3a5f",
  text:     "#e2e8f0",
  muted:    "#64748b",
  faint:    "#2a2d3a",
  orange:   "#fb923c",
  orangeDim:"#431407",
  purple:   "#c084fc",
  purpleDim:"#3b0764",
};

export function btnStyle(bg: string, filled?: boolean): React.CSSProperties {
  return {
    padding: "7px 14px", borderRadius: 8, border: `1px solid ${bg}`,
    background: filled ? bg : "transparent",
    color: filled ? "#fff" : C.text,
    cursor: "pointer", fontSize: 13, fontWeight: 600,
  };
}

export const inputStyle: React.CSSProperties = {
  padding: "7px 10px", background: C.surface,
  border: `1px solid ${C.border}`, borderRadius: 8,
  color: C.text, fontSize: 13, outline: "none",
};
