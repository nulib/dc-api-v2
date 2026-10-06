import { c2paCredentials } from "../environment.ts";

type SigningLibrary = typeof import("@nulib/c2pa-signing");

export class C2paUnavailableError extends Error {}

let signingLibrary: Promise<SigningLibrary | null> | undefined;

// Signing is provided by @nulib/c2pa-signing, which drives
// @contentauth/c2pa-node (a native addon). Both are optional dependencies,
// loaded on first use, so an environment without them can still serve every
// other request.
function loadSigningLibrary(): Promise<SigningLibrary | null> {
  signingLibrary ??= import("@nulib/c2pa-signing")
    .then(async (library) => {
      await library.loadC2paNode();
      return library;
    })
    .catch((err: Error) => {
      console.warn(
        `C2PA signing dependencies are not available. (${err.message})`,
      );
      return null;
    });
  return signingLibrary;
}

/** Whether signing credentials are configured for this environment. */
export function signingConfigured(): boolean {
  return c2paCredentials() !== null;
}

/**
 * Signs a C2PA manifest for `asset` and returns it as a detached manifest
 * store, leaving the asset untouched. `definition` is a c2pa-rs manifest
 * definition.
 *
 * Throws C2paUnavailableError if signing isn't possible in this environment;
 * any other error is a failure of a signing attempt, including an unreachable
 * time-stamp authority.
 */
export async function signManifest(
  definition: Record<string, unknown>,
  asset: { buffer: Buffer; mimeType: string },
): Promise<Buffer> {
  const credentials = c2paCredentials();
  if (!credentials) {
    throw new C2paUnavailableError("No signing credentials are configured");
  }

  const library = await loadSigningLibrary();
  if (!library) {
    throw new C2paUnavailableError("Signing dependencies are not available");
  }

  const c2pa = await library.loadC2paNode();
  const builder = await c2pa.Builder.withJsonAsync(
    definition as Parameters<typeof c2pa.Builder.withJsonAsync>[0],
  );
  builder.setNoEmbed(true);
  return await builder.signAsync(
    library.createSigner(c2pa, credentials),
    asset,
    { buffer: null },
  );
}
