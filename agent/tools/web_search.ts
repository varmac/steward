// eve's web search is provider-managed: the model provider (Exa through AI
// Gateway) runs the search, so the definition has no `execute` or `approval` to
// wrap. This is the one tool that does NOT pass through gate()/withReceipt().
// It is a read, so skipping approval is fine, but search results are untrusted
// and nothing here can taint the session or write a receipt. The only place
// eve exposes its results to our code is an `action.result` hook.
export { default } from "eve/tools/web_search";
