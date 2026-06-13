import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { Checkbox } from "@/components/ui/checkbox";
import { useGetFlowTools } from "@/controllers/API/queries/flows/use-get-flow-tools";

interface ToolsSelectProps {
  flowId: string;
  selectedToolIds: string[];
  setSelectedToolIds: (toolIds: string[]) => void;
}

export function ToolsSelect({
  flowId,
  selectedToolIds,
  setSelectedToolIds,
}: ToolsSelectProps) {
  const tools = useGetFlowTools(flowId);

  function handleToolToggle(toolId: string, checked: boolean) {
    if (checked) {
      setSelectedToolIds([...selectedToolIds, toolId]);
      return;
    }

    setSelectedToolIds(selectedToolIds.filter((item) => item !== toolId));
  }

  if (tools.isPending) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-stone-500/5 px-4 py-6 text-sm text-muted-foreground">
        Loading tools...
      </div>
    );
  }

  if (!tools.data?.items.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-stone-500/5 px-4 py-6 text-sm text-muted-foreground">
        No tools were found in this flow.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-stone-500/5 p-4 pl-6">
      {tools.data.items.map((item) => (
        <label
          key={item.id}
          className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1 hover:bg-muted/40"
        >
          <Checkbox
            checked={selectedToolIds.includes(item.id)}
            onCheckedChange={(checked) => {
              handleToolToggle(item.id, checked === true);
            }}
          />
          {item.icon_name && (
            <ForwardedIconComponent name={item.icon_name} className="h-6 w-6" />
          )}
          <div className="flex flex-col">
            <span>{item.display_name || item.id}</span>
            {item.display_name && (
              <span className="text-sm text-muted-foreground">{item.id}</span>
            )}
          </div>
        </label>
      ))}
    </div>
  );
}
