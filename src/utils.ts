export type ViewportName = 'mobile' | 'tablet' | 'desktop' | 'wide';

export interface ViewportSize {
  width: number;
  height: number;
}

export const VIEWPORTS: Record<ViewportName, ViewportSize> = {
  mobile:  { width: 375,  height: 812 },
  tablet:  { width: 768,  height: 1024 },
  desktop: { width: 1280, height: 800 },
  wide:    { width: 1920, height: 1080 },
};

export function resolveViewport(name?: string): ViewportSize {
  if (name && name in VIEWPORTS) {
    return VIEWPORTS[name as ViewportName];
  }
  return VIEWPORTS.desktop;
}

// Shared CSS property list for DOM inspection and snapshot capture
export const STYLE_PROPERTIES = [
  'display', 'position', 'flexDirection', 'justifyContent', 'alignItems',
  'gridTemplateColumns', 'gridTemplateRows',
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'border', 'borderRadius',
  'backgroundColor', 'color', 'opacity',
  'fontSize', 'fontWeight', 'lineHeight', 'textAlign',
  'overflow', 'overflowX', 'overflowY',
  'zIndex', 'visibility',
  'gap', 'rowGap', 'columnGap',
  'boxShadow', 'transform',
  'top', 'left', 'right', 'bottom',
];

export function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

// Common return type for all MCP tool handlers
export interface ToolContent {
  type: string;
  data?: string;
  mimeType?: string;
  text?: string;
}

export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
}
