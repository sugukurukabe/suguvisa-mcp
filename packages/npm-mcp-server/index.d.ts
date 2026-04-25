export interface SuguVisaMcpServerInfo {
  name: string;
  packageName: string;
  description: string;
  company: string;
  mcpEndpoint: string;
  metadataUrl: string;
  openaiManifestUrl: string;
  smitheryUrl: string;
  documentationUrl: string;
  supportEmail: string;
  toolCount: number;
  promptsCount: number;
  transport: string;
  authentication: string[];
  publicPackagePolicy: {
    purpose: string;
    serverImplementationIncluded: boolean;
    visaRulesIncluded: boolean;
    goldenRecordsIncluded: boolean;
    templatesIncluded: boolean;
    credentialsIncluded: boolean;
  };
}

export const suguVisaMcpServer: Readonly<SuguVisaMcpServerInfo>;
export function getSuguVisaMcpServerInfo(): Readonly<SuguVisaMcpServerInfo>;
export function getSuguVisaMcpEndpoint(): string;
