declare module "iiif-builder" {
  export class AnnotationPageInstanceBuilder {
    addLabel(label: string | string[], language?: string): void;
    createAnnotation(annotation: unknown): void;
  }

  export class CanvasInstanceBuilder {
    duration: number;
    height: number;
    width: number;
    addLabel(label: string | string[], language?: string): void;
    addThumbnail(resource: unknown): void;
    createAnnotation(id: string, annotation: unknown): void;
    createAnnotationPage(
      id: string,
      callback: (page: AnnotationPageInstanceBuilder) => void,
      isAnnotationsProperty?: boolean,
    ): void;
  }

  export class ManifestInstanceBuilder {
    createCanvas(
      id: string,
      callback: (canvas: CanvasInstanceBuilder) => void,
    ): void;
    addLabel(label: string | string[], language?: string): void;
    addSummary(summary: string | string[], language?: string): void;
    addMetadata(label: unknown, value: unknown): void;
    setRequiredStatement(statement: unknown): void;
    setRendering(rendering: unknown[]): void;
    setRights(text: string): void;
    addThumbnail(resource: unknown): void;
    addSeeAlso(resource: unknown): void;
    setHomepage(homepage: unknown): void;
    setPartOf(partOf: unknown[]): void;
    addBehavior(behavior: string): void;
  }

  export class IIIFBuilder {
    createManifest(
      id: string,
      callback: (manifest: ManifestInstanceBuilder) => void,
    ): { id: string };
    toPresentation3(entity: { id: string; type: string }): unknown;
  }
}
