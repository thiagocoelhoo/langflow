import { useState } from "react";
import { Button } from "@/components/ui/button";
import EvalMetricsTab from "./tabs/CreateEvalMetric";
import EvalCasesTable from "./tabs/EvalCases";
import EvalRunsTable from "./tabs/EvalRuns";

type FlowEvaluationsProps = {
  flowId?: string | null;
};

type EvaluationTab = {
  key: "evaluation_cases" | "evaluation_results" | "create_eval_metric";
  label: string;
};

function TabButton({
  tab,
  currentTab,
  setCurrentTab,
}: {
  tab: EvaluationTab;
  currentTab: EvaluationTab["key"];
  setCurrentTab: (tab: EvaluationTab["key"]) => void;
}) {
  return (
    <Button
      key={tab.key}
      unstyled
      id={`${tab.key}-btn`}
      className={`px-4 pb-2 pt-3 ${
        currentTab === tab.key
          ? "bg-white/10 border-foreground text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-white/5 "
      } text-nowrap text-mmd`}
      onClick={() => setCurrentTab(tab.key)}
    >
      {tab.label}
    </Button>
  );
}

export default function FlowEvaluations({
  flowId: _flowId,
}: FlowEvaluationsProps) {
  const tabs: EvaluationTab[] = [
    { key: "evaluation_cases", label: "Evaluation Cases" },
    { key: "evaluation_results", label: "Evaluation Results" },
    { key: "create_eval_metric", label: "Evaluation Metrics" },
  ];
  const [currentTab, setCurrentTab] =
    useState<EvaluationTab["key"]>("evaluation_cases");

  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold">Flow Evaluations</h2>
      </div>

      <div className="border-b px-4 pt-3">
        {tabs.map((tab) => (
          <TabButton
            key={tab.key}
            tab={tab}
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
          />
        ))}
      </div>

      <div className="flex h-full flex-col overflow-auto pb-20">
        {currentTab === "evaluation_cases" && <EvalCasesTable />}
        {currentTab === "evaluation_results" && <EvalRunsTable />}
        {currentTab === "create_eval_metric" && <EvalMetricsTab />}
      </div>
    </div>
  );
}
