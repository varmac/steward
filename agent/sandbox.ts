import { defaultBackend, defineSandbox, type SandboxNetworkPolicy } from "eve/sandbox";

/**
 * Steward's "computer": where bash, read_file and write_file run. Code in here
 * is untrusted (the model writes it, often from third-party data), so egress is
 * denied by default. eve's own default is allow-all.
 *
 * The firewall speaks domain names only: an allow-list, or "*" for everything.
 * "Any https URL the owner mentions" cannot be written as an allow-list, so
 * downloads are done outside the sandbox (agent/lib/sandbox-download.ts) and
 * the sandbox may reach nothing but the package registries pip and npm need.
 */
const REGISTRIES_ONLY: SandboxNetworkPolicy = {
  allow: ["pypi.org", "files.pythonhosted.org", "registry.npmjs.org"],
};

export default defineSandbox({
  // The policy sits on the backend factory and not in `onSession`, because eve
  // does not rerun `onSession` when it replaces a lost sandbox.
  backend: defaultBackend({
    // Deployed: Vercel Sandbox (Firecracker microVM, domain firewall).
    vercel: { networkPolicy: REGISTRIES_ONLY },
    // Local on Apple Silicon: a microsandbox VM with the same kind of firewall.
    microsandbox: { networkPolicy: REGISTRIES_ONLY },
    // Local when a Docker daemon is running: Docker knows only all or nothing,
    // so it gets nothing. pip and npm installs fail there; stop Docker to fall
    // through to microsandbox when a task needs them.
    docker: { networkPolicy: "deny-all" },
    // Last resort is just-bash: simulated shell, no real binaries, no network
    // isolation to configure.
  }),
});
