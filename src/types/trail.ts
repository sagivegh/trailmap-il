export type LocationStatus = 'verified' | 'probable' | 'missing';
export type LocationType = 'start' | 'destination' | 'poi' | 'approximate' | 'missing';

export interface TrailSection {
  title: string;
  content: string;
}

export interface TrailImage {
  url: string;
  caption?: string;
  alt?: string;
}

export interface Trail {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  description: string;
  region?: string;
  categories: string[];
  
  // Parsed structured values
  distanceKm?: number;
  durationMinutes?: number;
  distanceStr?: string;
  durationStr?: string;
  
  difficulty?: string; // קלה, בינונית, קשה, etc.
  walkingType?: string; // מעגלי, הלוך-חזור, חד-כיווני, etc.
  crowdLevel?: string;
  
  startPoint?: string;
  endPoint?: string;
  gpsName?: string;
  
  // Coordinates & Audit Taxonomy
  latitude?: number;
  longitude?: number;
  coordinatesMissing: boolean;
  locationStatus: LocationStatus;
  locationType: LocationType;
  locationSource?: string;
  locationConfidence: number; // 0.0 to 1.0
  locationReason?: string; // Clear explanation of why/how coordinate was assigned
  
  // Optional geometry track (GPX / GeoJSON LineString for future extension)
  geometry?: any;
  
  // Navigation
  googleMapsUrl?: string;
  wazeUrl?: string;
  
  // Feature highlights
  water?: string;
  hasWater?: boolean | null;
  seasonalWater?: boolean | null;
  waterSeasonNote?: string;
  swimmingAllowed?: boolean | null;
  shade?: string;
  hasShade?: boolean | null;
  parking?: string;
  trailMap?: string;
  accessibility?: string;
  openingHours?: string;
  price?: string;
  fourByFourRequired?: boolean | null;
  highVehicleRequired?: boolean | null;
  
  // Content Transformation & Original TrailMap Information Architecture
  sourceFacts?: SourceFacts;
  trailSummary?: string; // Original, concise summary generated strictly from extracted facts
  practicalInfo?: TrailPracticalInfo;
  navigationInfo?: TrailNavigationInfo;
  contentSections?: TrailContentSection[];
  provenance?: ContentProvenance;

  // Directions & Detailed Walkthrough
  directionsByCar?: string;
  directionsByFoot?: string;
  directionsBy4x4?: string;
  directionsByHighVehicle?: string;
  additionalInformation?: string;
  
  // Sections & Raw content
  sections: TrailSection[];
  images: TrailImage[];
  sourceFile: string;
  
  // UI computed (not in stored json)
  distanceFromUserKm?: number;
}

export interface SourceFacts {
  sourceFile: string;
  extractedAt: string;
  title: string;
  region?: string;
  distanceKm?: number;
  durationMinutes?: number;
  difficulty?: string;
  walkingType?: string;
  startPoint?: string;
  endPoint?: string;
  parking?: string;
  water?: string;
  hasWater: boolean | null;
  seasonalWater?: boolean | null;
  waterSeasonNote?: string;
  swimmingAllowed: boolean | null;
  shade?: string;
  hasShade: boolean | null;
  price?: string;
  openingHours?: string;
  crowdLevel?: string;
  trailMap?: string;
  accessibility?: string;
  gpsName?: string;
  requiredEquipment?: string;
  landmarks: string[];
  mainRoads: string[];
  publicTransit?: string;
  fourByFourRequired: boolean | null;
  highVehicleRequired: boolean | null;
  vehicleRequirements?: string;
}

export interface TrailPracticalInfo {
  distance?: string;
  duration?: string;
  difficulty?: string;
  walkingType?: string;
  startPoint?: string;
  endPoint?: string;
  parking?: string;
  water?: string;
  hasWater?: boolean | null;
  seasonalWater?: boolean | null;
  waterSeasonNote?: string;
  swimmingAllowed?: boolean | null;
  shade?: string;
  entryFee?: string;
  openingHours?: string;
  trailMap?: string;
  accessibility?: string;
  requiredEquipment?: string;
}

export interface TrailNavigationInfo {
  gpsName?: string;
  wazeUrl?: string;
  googleMapsUrl?: string;
  parkingLocation?: string;
  roadAccess?: string;
  publicTransit?: string;
  vehicleRequirements?: string;
}

export interface TrailContentSection {
  id: string;
  title: string;
  content: string;
  items?: string[];
}

export interface ContentProvenance {
  sourceFile: string;
  extractedAt: string;
  factualFieldsExtracted: string[];
}

export interface GeocodingTodoItem {
  id: string;
  title: string;
  gpsName?: string;
  startPoint?: string;
  endPoint?: string;
  sourceFile: string;
  region?: string;
}

export interface CoordinateAuditRecord {
  id: string;
  title: string;
  latitude?: number;
  longitude?: number;
  locationStatus: LocationStatus;
  locationType: LocationType;
  locationSource?: string;
  locationConfidence: number;
  locationReason?: string;
  gpsName?: string;
  startPoint?: string;
  endPoint?: string;
  sourceFile: string;
}

export interface GeocodingReviewItem {
  id: string;
  title: string;
  originalGpsText?: string;
  query: string;
  candidateLatitude?: number;
  candidateLongitude?: number;
  candidateDisplayName?: string;
  candidateType?: string;
  confidence: number;
  reason: string;
  sourceFile: string;
}

export interface CoordinateCoverageReport {
  generatedAt: string;
  totalTrails: number;
  verified: number;
  probable: number;
  missing: number;
  coveragePercentage: number;
  previouslyMapped: number;
  newlyGeocoded: number;
  requiresReview: number;
  totalMapped: number;
}

export interface ValidationReport {
  generatedAt: string;
  totalTrails: number;
  withTitle: number;
  withDescription: number;
  withCoordinates: number;
  verifiedCoordinates: number;
  probableCoordinates: number;
  missingCoordinates: number;
  coordinatesMissing: number;
  withGoogleMapsUrl: number;
  withWazeUrl: number;
  withImages: number;
  withDistance: number;
  withDuration: number;
  withDifficulty: number;
  withRegion: number;
  withStartPoint: number;
  withEndPoint: number;
  withGpsName: number;
  withWater: number;
  withShade: number;
  withCarDirections: number;
  withWalkDirections: number;
  duplicateIds: string[];
  missingTitleFiles: string[];
  failedParsingFiles: string[];
  irregularFields: Array<{
    id: string;
    field: string;
    value: string;
    reason: string;
  }>;
  categoriesFound: Array<{ name: string; count: number }>;
  regionsFound: Array<{ name: string; count: number }>;
}

export interface TrailFilters {
  searchQuery: string;
  selectedRegion: string;
  selectedCategories: string[];
  selectedDifficulty: string;
  maxDistanceKm?: number;
  maxDurationMinutes?: number;
  waterOnly: boolean;
  shadeOnly: boolean;
  withCoordinatesOnly: boolean;
  locationStatusFilter?: 'all' | 'verified' | 'probable' | 'missing';
  sortBy: 'nearMe' | 'distance' | 'duration' | 'name' | 'water' | 'hasCoords';
  maxDistanceRadiusKm?: number; // 5, 10, 25, 50, 100
}
