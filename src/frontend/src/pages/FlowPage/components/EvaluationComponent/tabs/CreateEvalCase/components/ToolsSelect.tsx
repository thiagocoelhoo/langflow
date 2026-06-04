import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { ModelOption } from "@/components/core/parameterRenderComponent/components/modelInputComponent/types";
import { Checkbox } from "@/components/ui/checkbox";
import { useGetFlowTools } from "@/controllers/API/queries/flows/use-get-flow-tools";
import { useGetEnabledModels } from "@/controllers/API/queries/models/use-get-enabled-models";
import { useGetModelProviders } from "@/controllers/API/queries/models/use-get-model-providers";
import { useMemo } from "react";

interface ToolsSelectProps {
  flowId: string;
}

export function ToolsSelect({ flowId }: ToolsSelectProps) {
  const tools = useGetFlowTools(flowId);

  return (
    <div className="flex flex-col gap-2 border border-border rounded-lg p-4 pl-6 bg-stone-500/5">
      {tools.data?.items.map((item) => (
        <label className="flex gap-2 items-center cursor-pointer">
          <Checkbox />
          <ForwardedIconComponent name={item.icon_name} className="w-6 h-6" />
          <span>{item.id}</span>
        </label>
      ))}
    </div>
  );
}
