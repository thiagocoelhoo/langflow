import ModelInputComponent from "@/components/core/parameterRenderComponent/components/modelInputComponent";
import TableComponent from "@/components/core/parameterRenderComponent/components/tableComponent";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useGetEvaluationCase } from "@/controllers/API/queries/eval-cases/use-get-evaluation-case";
import { useState } from "react";
import CreateEvalCaseForm from "./tabs/CreateEvalCase";
import CreateEvalMetricForm from "./tabs/CreateEvalMetric";
import EvalCasesTable from "./tabs/EvalCases";
import EvalRunsTable from "./tabs/EvalRuns";

type FlowEvaluationsProps = {
  flowId?: string | null;
};

function TabButton({ tab, currentTab, setCurrentTab }) {
  return (
    <Button
      key={tab}
      unstyled
      id={`${tab}-btn`}
      className={`px-4 pb-2 pt-3 ${
        currentTab === tab
          ? "bg-white/10 border-foreground text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-white/5 "
      } text-nowrap text-mmd`}
      onClick={() => setCurrentTab(tab)}
    >
      {tab}
    </Button>
  );
}

export default function FlowEvaluations(props: FlowEvaluationsProps) {
  const tabs = [
    "evaluation_results",
    "evaluation_cases",
    "create_eval_case",
    "create_eval_metric",
  ];
  const [currentTab, setCurrentTab] = useState(tabs[0]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden h-screen">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold">Flow Evaluations</h2>
      </div>

      <div className="border-b px-4 pt-3">
        {tabs.map((tab) => (
          <TabButton
            tab={tab}
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
          />
        ))}
      </div>

      <div className="h-full flex flex-col overflow-auto pb-20">
        {currentTab === "evaluation_results" && <EvalRunsTable />}
        {currentTab === "evaluation_cases" && <EvalCasesTable />}
        {currentTab === "create_eval_case" && <CreateEvalCaseForm />}
        {currentTab === "create_eval_metric" && <CreateEvalMetricForm />}
      </div>
    </div>
  );
}
