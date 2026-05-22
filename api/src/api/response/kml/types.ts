export interface ControlPoint {
  pixel: [number, number]; // [x, y] in image space
  geo: [number, number]; // [longitude, latitude]
}

export interface ParsedAnnotation {
  controlPoints: ControlPoint[];
  imageWidth: number;
  imageHeight: number;
}

export interface CollectionData {
  api_model: "Collection";
  id: string;
  title: string;
}

export interface WorkData {
  api_model: "Work";
  id: string;
  title: string;
  file_sets?: FileSetData[];
}

export interface FileSetData {
  api_model: "FileSet";
  id: string;
  label: string;
  annotations?: {
    type: string;
    content?: string;
  }[];
  representative_image_url: string;
  width: number;
  height: number;
  work_title: string;
}

export type SingleItem = WorkData | FileSetData | CollectionData;
export type MultipleItems = WorkData[] | FileSetData[] | CollectionData[];

export type DataContainer = {
  data: SingleItem | MultipleItems;
};
