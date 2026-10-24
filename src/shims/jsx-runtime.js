// JSX automatic-runtime shim implemented over the host React's createElement.
const sdk = window.__HERMES_PLUGIN_SDK__;
const React = (sdk && sdk.React) || window.React;
if (!React) {
  throw new Error("Hermes plugin SDK / React not available on window");
}

export const Fragment = React.Fragment;

function jsx(type, props, key) {
  if (key === undefined) return React.createElement(type, props);
  return React.createElement(type, { ...props, key });
}

export { jsx, jsx as jsxs, jsx as jsxDEV };
