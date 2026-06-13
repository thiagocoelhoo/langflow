import {
  MetricMetadata,
  MetricMetadataFieldConfig,
  MetricMetadataValue,
} from "../types";

export const METRIC_ALGORITHM_LABELS: Record<string, string> = {
  AGENT_AS_A_JUDGE: "Agent as a Judge",
  TOOL_EVALUATION: "Tool Evaluation",
  RAG_EVALUATION: "RAG Evaluation",
};

export const METRIC_METADATA_REGISTRY: Record<
  string,
  MetricMetadataFieldConfig[]
> = {
  TOOL_EVALUATION: [
    {
      name: "tool",
      label: "Tool",
      type: "select",
      optionsSource: "flowTools",
      description:
        "Choose the workflow tool this metric should evaluate for this case.",
      placeholder: "Select a tool from this flow",
    },
  ],
};

function getPrimitiveValue(value: unknown): MetricMetadataValue {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return undefined;
}

export function getMetricAlgorithmLabel(algorithm: string): string {
  return METRIC_ALGORITHM_LABELS[algorithm] ?? algorithm.replaceAll("_", " ");
}

export function getMetricMetadataFields(
  algorithm?: string,
): MetricMetadataFieldConfig[] {
  if (!algorithm) {
    return [];
  }

  return METRIC_METADATA_REGISTRY[algorithm] ?? [];
}

export function sanitizeMetricMetadata(
  metadata: MetricMetadata,
  algorithm?: string,
): MetricMetadata {
  const allowedFields = getMetricMetadataFields(algorithm);
  const allowedFieldNames = new Set(allowedFields.map((field) => field.name));

  return Object.entries(metadata).reduce<MetricMetadata>(
    (acc, [key, value]) => {
      if (!allowedFieldNames.has(key)) {
        return acc;
      }

      const primitiveValue = getPrimitiveValue(value);

      if (typeof primitiveValue === "string") {
        const trimmedValue = primitiveValue.trim();
        if (trimmedValue.length > 0) {
          acc[key] = trimmedValue;
        }
        return acc;
      }

      if (typeof primitiveValue === "number") {
        if (Number.isFinite(primitiveValue)) {
          acc[key] = primitiveValue;
        }
        return acc;
      }

      if (primitiveValue === true) {
        acc[key] = primitiveValue;
      }

      return acc;
    },
    {},
  );
}

export function hasConfiguredMetadata(
  metadata: MetricMetadata,
  algorithm?: string,
): boolean {
  return Object.keys(sanitizeMetricMetadata(metadata, algorithm)).length > 0;
}

export function summarizeMetricMetadata(
  metadata: MetricMetadata,
  algorithm?: string,
): string[] {
  const sanitizedMetadata = sanitizeMetricMetadata(metadata, algorithm);
  const fieldLabelMap = new Map(
    getMetricMetadataFields(algorithm).map((field) => [
      field.name,
      field.label,
    ]),
  );

  return Object.entries(sanitizedMetadata)
    .slice(0, 3)
    .map(([key, value]) => {
      const label =
        fieldLabelMap.get(key) ??
        key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");

      return `${label}: ${String(value)}`;
    });
}
