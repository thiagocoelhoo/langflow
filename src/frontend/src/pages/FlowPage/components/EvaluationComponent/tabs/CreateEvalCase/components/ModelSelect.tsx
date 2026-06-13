import { useMemo } from "react";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { ModelOption } from "@/components/core/parameterRenderComponent/components/modelInputComponent/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useGetEnabledModels } from "@/controllers/API/queries/models/use-get-enabled-models";
import { useGetModelProviders } from "@/controllers/API/queries/models/use-get-model-providers";

function useGroupedModels() {
  const { data: enabledModelsData } = useGetEnabledModels();

  const { data: providersData = [] } = useGetModelProviders({});

  const modelType = "llm";

  const groupedOptions = useMemo(() => {
    const grouped: Record<string, ModelOption[]> = {};

    if (enabledModelsData?.enabled_models && providersData) {
      for (const providerInfo of providersData) {
        const providerName = providerInfo.provider;
        const providerModels = enabledModelsData.enabled_models[providerName];
        if (!providerModels) continue;

        for (const model of providerInfo.models ?? []) {
          const modelName = model.model_name;
          if (providerModels[modelName] !== true) continue;

          const modelMetadataType = (
            model.metadata as Record<string, unknown> | undefined
          )?.model_type;
          if (
            typeof modelMetadataType === "string" &&
            modelMetadataType !== modelType
          ) {
            continue;
          }

          if (!grouped[providerName]) {
            grouped[providerName] = [];
          }
          grouped[providerName].push({
            name: modelName,
            icon: providerInfo.icon || "Bot",
            provider: providerName,
            metadata: (model.metadata ?? {}) as Record<string, unknown>,
          });
        }
      }
    }

    return grouped;
  }, [enabledModelsData, providersData, modelType]);

  return groupedOptions;
}

export function ModelSelect({ selectedModelName, setSelectedModelName }) {
  const groupedModels = useGroupedModels();

  return (
    <Select
      value={selectedModelName || undefined}
      onValueChange={(value) => {
        setSelectedModelName(value);
      }}
    >
      <SelectTrigger>{selectedModelName || "Select model"}</SelectTrigger>
      <SelectContent>
        {Object.values(groupedModels)
          .reduce((accumulator, item) => accumulator.concat(item), [])
          .map((item) => (
            <SelectItem key={item.name} value={item.name}>
              <div className="flex gap-2">
                <ForwardedIconComponent
                  name={item.icon}
                  className="h-4 w-4 text-muted-foreground group-hover:text-primary"
                />
                {item.name}
              </div>
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
