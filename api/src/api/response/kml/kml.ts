import { Matrix2D, Point2D } from "kld-affine";
import { Matrix, solve } from "ml-matrix";
import type { ControlPoint, ParsedAnnotation, FileSetData } from "./types";

function solveAffineMatrix(points: ControlPoint[]): Matrix2D {
  // Build the 3×3 pixel matrix A and 3×2 geo matrix B
  const A = new Matrix(points.map(({ pixel: [x, y] }) => [x, y, 1]));
  const B = new Matrix(points.map(({ geo: [lon, lat] }) => [lon, lat]));

  // Solve A × T = B for T (3×2): each column is [lonB,lonC,lonA] and [latB,latC,latA]
  const T = solve(A, B);

  // Matrix2D(a,b,c,d,e,f): a=lonB, b=latB, c=lonC, d=latC, e=lonA, f=latA
  return new Matrix2D(
    T.get(0, 0),
    T.get(0, 1), // lonB, latB
    T.get(1, 0),
    T.get(1, 1), // lonC, latC
    T.get(2, 0),
    T.get(2, 1), // lonA, latA
  );
}

function project(matrix: Matrix2D, x: number, y: number): [number, number] {
  const pt = new Point2D(x, y).transform(matrix);
  return [pt.x, pt.y];
}

function parseGeoreferenceAnnotation(fs: FileSetData): ParsedAnnotation | null {
  const georefAnnotation = fs.annotations?.find(
    (a) => a.type === "georeference",
  );
  if (!georefAnnotation) return null;

  const content = JSON.parse(georefAnnotation.content as string);
  const imageWidth: number = content.target.source.width;
  const imageHeight: number = content.target.source.height;

  const controlPoints: ControlPoint[] = content.body.features.map(
    (f: Record<string, unknown>) => {
      const props = f.properties as Record<string, unknown>;
      const geom = f.geometry as Record<string, unknown>;
      return {
        pixel: props.resourceCoords as [number, number],
        geo: geom.coordinates as [number, number],
      };
    },
  );

  return { controlPoints, imageWidth, imageHeight };
}

export function fileSetToGroundOverlay(fs: FileSetData): string {
  const parsed: ParsedAnnotation | null = parseGeoreferenceAnnotation(fs);
  if (!parsed) return "";

  const { controlPoints, imageWidth, imageHeight } = parsed;
  const matrix = solveAffineMatrix(controlPoints);
  const [blLon, blLat] = project(matrix, 0, imageHeight);
  const [brLon, brLat] = project(matrix, imageWidth, imageHeight);
  const [trLon, trLat] = project(matrix, imageWidth, 0);
  const [tlLon, tlLat] = project(matrix, 0, 0);

  const imageUrl = `${fs.representative_image_url}/full/max/0/default.jpg`;

  return `    <GroundOverlay>
      <name>${escapeXml(fs.label)}</name>
      <Icon><href>${escapeXml(imageUrl)}</href></Icon>
      <gx:LatLonQuad>
        <coordinates>
          ${blLon},${blLat},0 ${brLon},${brLat},0 ${trLon},${trLat},0 ${tlLon},${tlLat},0
        </coordinates>
      </gx:LatLonQuad>
    </GroundOverlay>`;
}

export function fileSetsToKml(
  fileSets: FileSetData[],
  title: string = "KML Export",
): string {
  const overlays = fileSets.map(fileSetToGroundOverlay).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"
     xmlns:gx="http://www.google.com/kml/ext/2.2">
  <Document>
    <name>${escapeXml(title)}</name>
    ${overlays}
  </Document>
</kml>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
