// Re-exports the host's React instance (provided via the plugin SDK or window.React)
// so the plugin never bundles or instantiates its own React.
const sdk = window.__HERMES_PLUGIN_SDK__;
const React = (sdk && sdk.React) || window.React;
if (!React) {
  throw new Error("Hermes plugin SDK / React not available on window");
}

export default React;
export const useState = React.useState;
export const useEffect = React.useEffect;
export const useRef = React.useRef;
export const useCallback = React.useCallback;
export const useMemo = React.useMemo;
export const useContext = React.useContext;
export const createContext = React.createContext;
export const forwardRef = React.forwardRef;
export const useImperativeHandle = React.useImperativeHandle;
export const Fragment = React.Fragment;
export const createElement = React.createElement;
export const memo = React.memo;
