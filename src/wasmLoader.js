// This JS file is needed to avoid an issue with TypeScript and webpack's dynamic import method
// See: https://github.com/rustwasm/wasm-bindgen/issues/700
export function loadWasm() {
  return import("skyrim-cell-dump-wasm");
}