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
import { useMemo } from "react";

function useGroupedModels() {
  const { data: enabledModelsData, isLoading: isLoadingEnabledModels } =
    useGetEnabledModels();

  const {
    data: providersData = [],
    isLoading: isLoadingProviders,
    isFetching: isFetchingProviders,
  } = useGetModelProviders({});

  const modelType = "llm";

  // Groups models by their provider name for sectioned display in dropdown.
  // Filters out models from disabled providers AND disabled models, then
  // augments with any enabled models from `providersData` that weren't in the
  // component's saved `options` (e.g. after importing a flow whose exporter
  // only had a subset of the current user's enabled providers).
  const groupedOptions = useMemo(() => {
    const grouped: Record<string, ModelOption[]> = {};

    // Augment with models the user has enabled that were not in the saved
    // `options` (the saved list reflects only what the exporter had available).
    // This ensures importing a flow shows the importing user's full enabled
    // list rather than the intersection of the two sets.
    //
    // Cross-type guard: `providersData` from ``GET /api/v1/models`` is NOT
    // filtered by ``model_type`` (the hook doesn't pass one), and the merged
    // ``enabled_models`` map treats llm + embeddings as a single flat
    // provider→name→bool record.  Without this check, text-embedding models
    // leak into the language-model dropdown (and vice versa) whenever their
    // provider has both kinds enabled.  Filter by each model's own
    // ``model_type`` metadata so the component only shows its own type.
    if (enabledModelsData?.enabled_models && providersData) {
      for (const providerInfo of providersData) {
        const providerName = providerInfo.provider;
        const providerModels = enabledModelsData.enabled_models[providerName];
        if (!providerModels) continue;

        for (const model of providerInfo.models ?? []) {
          const modelName = model.model_name;
          if (providerModels[modelName] !== true) continue;

          // Only include models whose declared type matches this component.
          // Older metadata without ``model_type`` is allowed through so we
          // don't regress providers that haven't adopted the tag yet.
          const modelMetadataType = (
            model.metadata as Record<string, unknown> | undefined
          )?.model_type;
          if (
            typeof modelMetadataType === "string" &&
            modelMetadataType !== modelType
          ) {
            continue;
          }

          const key = `${providerName}::${modelName}`;

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
  // TODO: acredito que user groupedmodels não é exatamente necessário
  // Verifique se useGroupedModels pode ser substituído por useGetEnabledModels
  const groupedModels = useGroupedModels();

  return (
    <Select
      onValueChange={(value) => {
        setSelectedModelName(value);
      }}
    >
      <SelectTrigger>{selectedModelName || "Select model"}</SelectTrigger>
      <SelectContent>
        {Object.values(groupedModels)
          .reduce((accumulator, item) => accumulator.concat(item), [])
          .map((item) => (
            <SelectItem value={item.name}>
              <div className="flex gap-2">
                <ForwardedIconComponent
                  name={item.icon}
                  className="w-4 h-4 text-muted-foreground group-hover:text-primary"
                />
                {item.name}
              </div>
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
