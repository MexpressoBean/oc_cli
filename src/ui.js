const DEFAULT_ACCENT = "#ff6b6b";

function isHexColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };
}

function colorizeHex(text, hex) {
  if (!shouldUseColor()) return text;
  const { r, g, b } = hexToRgb(hex);
  return `\u001b[38;2;${r};${g};${b}m${text}\u001b[39m`;
}

function ansi(codeOpen, codeClose, text) {
  if (!shouldUseColor()) return text;
  return `\u001b[${codeOpen}m${text}\u001b[${codeClose}m`;
}

function shouldUseColor() {
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.FORCE_COLOR !== undefined && process.env.FORCE_COLOR !== "0") {
    return true;
  }
  return Boolean(process.stdout && process.stdout.isTTY);
}

function createUi(accentColor = DEFAULT_ACCENT) {
  const accent = isHexColor(accentColor) ? accentColor : DEFAULT_ACCENT;

  return {
    divider: () => colorizeHex("-------------------------------------------", accent),
    heading: (text) => colorizeHex(text, accent),
    accent: (text) => colorizeHex(text, accent),
    success: (text) => ansi(32, 39, text),
    warn: (text) => ansi(33, 39, text),
    error: (text) => ansi(31, 39, text),
    info: (text) => ansi(36, 39, text),
    muted: (text) => ansi(2, 22, text)
  };
}

module.exports = {
  DEFAULT_ACCENT,
  isHexColor,
  createUi
};
