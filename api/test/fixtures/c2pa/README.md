Throwaway ES256 signing material for the C2PA tests: a self-made root and an
end-entity certificate issued by it, with the end-entity's private key. Nothing
trusts this root, so manifests signed with it validate structurally and report
`signingCredential.untrusted`. Never use it outside the test suite.
