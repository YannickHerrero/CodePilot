export const colors = {
  // Backgrounds
  background: "#F5F5F0",       // Warm off-white (Claude bg)
  surface: "#FFFFFF",           // White cards
  surfaceElevated: "#EEEAE4",  // Warm pressed/hover state

  // Borders
  border: "#E0DDD6",           // Warm light gray border

  // Text
  textPrimary: "#1a1a18",      // Near-black warm (Claude text)
  textSecondary: "#6B6B60",    // Warm medium gray
  textMuted: "#9C9C90",        // Warm light gray

  // Accent — Claude's rust-orange
  accent: "#C15F3C",           // Primary CTA / brand color
  accentHover: "#ae5630",      // Pressed/hover state

  // Status
  success: "#3D8C5C",          // Warm green
  warning: "#C08B2C",          // Warm amber
  error: "#C4453A",            // Warm red

  // Chat
  userBubble: "#C15F3C",       // User message bg (= accent)
  userBubbleText: "#FFFFFF",

  // Code blocks (Claude dark-mode brown for contrast)
  codeBackground: "#2b2a27",
  codeText: "#E8E5E0",
} as const;
