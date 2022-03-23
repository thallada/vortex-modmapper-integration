export function loadWasm(closure) {
  import("skyrim-cell-dump-wasm").then(closure);
}