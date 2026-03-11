import { useState } from "react";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import Viewer from "@samvera/clover-iiif/viewer";

export default function App() {
  const [manifestUrl, setManifestUrl] = useState<string | null>(null);

  const { app, error } = useApp({
    appInfo: { name: "NUL Digital Collections Work Viewer", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = (result: any) => {
        setManifestUrl(result.structuredContent.iiifManifestUrl);
      };
    }
  });

  useHostStyles(app, app?.getHostContext());

  if (error) return <div>Error: {error.message}</div>;

  if (!manifestUrl) return <div>Waiting for tool result...</div>;
  return (
    <>
      <Viewer iiifContent={manifestUrl} />
    </>
  );
}
