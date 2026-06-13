import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useGetFlowTools } from "@/controllers/API/queries/flows/use-get-flow-tools";
import { MetricMetadata } from "../types";
import { getMetricMetadataFields } from "./metricMetadataRegistry";

interface MetricMetadataFormProps {
  algorithm?: string;
  flowId: string;
  value: MetricMetadata;
  onChange: (nextValue: MetricMetadata) => void;
}

export function MetricMetadataForm({
  algorithm,
  flowId,
  value,
  onChange,
}: MetricMetadataFormProps) {
  const fields = getMetricMetadataFields(algorithm);
  const flowToolsQuery = useGetFlowTools(flowId);
  const flowTools = flowToolsQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => {
        const currentValue = value[field.name];

        if (field.type === "checkbox") {
          return (
            <label
              key={field.name}
              className="flex items-start gap-3 rounded-lg border border-border bg-background p-3"
            >
              <Checkbox
                checked={currentValue === true}
                onCheckedChange={(checked) => {
                  onChange({
                    ...value,
                    [field.name]: checked === true,
                  });
                }}
                className="mt-0.5"
              />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">{field.label}</span>
                {field.description && (
                  <span className="text-sm text-muted-foreground">
                    {field.description}
                  </span>
                )}
              </div>
            </label>
          );
        }

        if (field.type === "select" && field.optionsSource === "flowTools") {
          const selectedToolId =
            typeof currentValue === "string" ? currentValue : "";
          const hasCurrentToolInOptions = flowTools.some(
            (tool) => tool.id === selectedToolId,
          );
          const toolOptions =
            selectedToolId.length > 0 && !hasCurrentToolInOptions
              ? [
                  {
                    id: selectedToolId,
                    display_name: selectedToolId,
                    icon_name: null,
                  },
                  ...flowTools,
                ]
              : flowTools;

          return (
            <div key={field.name} className="flex flex-col gap-2">
              <label className="text-sm font-medium">{field.label}</label>
              {field.description && (
                <p className="text-sm text-muted-foreground">
                  {field.description}
                </p>
              )}
              <Select
                value={selectedToolId}
                onValueChange={(nextValue) => {
                  onChange({
                    ...value,
                    [field.name]: nextValue,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      flowToolsQuery.isPending
                        ? "Loading tools..."
                        : (field.placeholder ?? "Select an option")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {toolOptions.map((tool) => (
                    <SelectItem key={tool.id} value={tool.id}>
                      {tool.display_name || tool.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!flowToolsQuery.isPending && toolOptions.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No tools were found in this flow.
                </p>
              )}
            </div>
          );
        }

        return (
          <div key={field.name} className="flex flex-col gap-2">
            <label className="text-sm font-medium">{field.label}</label>
            {field.description && (
              <p className="text-sm text-muted-foreground">
                {field.description}
              </p>
            )}
            {field.type === "textarea" ? (
              <Textarea
                rows={5}
                value={typeof currentValue === "string" ? currentValue : ""}
                onChange={(event) => {
                  onChange({
                    ...value,
                    [field.name]: event.target.value,
                  });
                }}
                placeholder={field.placeholder}
              />
            ) : (
              <Input
                type={field.type === "number" ? "number" : "text"}
                min={field.min}
                step={field.step}
                value={
                  typeof currentValue === "string" ||
                  typeof currentValue === "number"
                    ? String(currentValue)
                    : ""
                }
                onChange={(event) => {
                  const nextRawValue = event.target.value;

                  onChange({
                    ...value,
                    [field.name]:
                      field.type === "number"
                        ? nextRawValue === ""
                          ? undefined
                          : Number(nextRawValue)
                        : nextRawValue,
                  });
                }}
                placeholder={field.placeholder}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default MetricMetadataForm;
