import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectItem,
} from "@/components/ui/select";
import { useGetEvalMetrics } from "@/controllers/API/queries/eval-metrics/use-get-eval-metrics";
import { useState } from "react";

export function MetricSelect({ selectedMetrics, setSelectedMetrics }) {
  const metrics = useGetEvalMetrics();
  const metricsMap = metrics.data?.items.reduce((acc, metric) => {
    return {
      ...acc,
      [metric.id]: metric,
    };
  }, {});
  const [selectedMetric, setSelectedMetric] = useState<string>();

  function addMetric() {
    if (selectedMetric) {
      setSelectedMetrics([...selectedMetrics, selectedMetric]);
    }
  }

  return (
    <>
      <div className="flex gap-2 items-center">
        <Select
          onValueChange={(value) => {
            setSelectedMetric(value);
          }}
        >
          <SelectTrigger className="grow">
            {selectedMetric
              ? metricsMap[selectedMetric].name
              : "Select a metric"}
          </SelectTrigger>
          <SelectContent>
            {!metrics.isPending &&
              metrics.data.items.map((metric) => (
                <SelectItem key={metric.id} value={metric.id}>
                  {metric.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button className="h-full py-1" type="button" onClick={addMetric}>
          Add
        </Button>
      </div>
      {selectedMetrics.map((metric) => (
        <div className="flex justify-between items-center">
          <span>
            {metric} - {metricsMap[metric].name}
          </span>
          <Button className="py-1.5 h-fit">Remove</Button>
        </div>
      ))}
    </>
  );
}
