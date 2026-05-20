import ForwardedIconComponent from "@/components/common/genericIconComponent";
import ModelInputComponent from "@/components/core/parameterRenderComponent/components/modelInputComponent";
import {
  ModelOption,
  SelectedModel,
} from "@/components/core/parameterRenderComponent/components/modelInputComponent/types";
import TableComponent from "@/components/core/parameterRenderComponent/components/tableComponent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateEvaluationCase } from "@/controllers/API/queries/evaluation-cases/use-create-evaluation-case";
import { useGetEvaluationCase } from "@/controllers/API/queries/evaluation-cases/use-get-evaluation-case";
import { useGetEvaluationCases } from "@/controllers/API/queries/evaluation-cases/use-get-evaluation-cases";
import { useGetEvaluationResults } from "@/controllers/API/queries/evaluation-cases/use-get-evaluation-results";
import { useGetFlowEvaluationCases } from "@/controllers/API/queries/evaluation-cases/use-get-flow-evaluation-cases";
import { useRunEvaluation } from "@/controllers/API/queries/evaluation-cases/use-run-evaluation";
import { useGetFlowEvalResults } from "@/controllers/API/queries/flows/use-get-flow-eval-results";
import { useGetEnabledModels } from "@/controllers/API/queries/models/use-get-enabled-models";
import { useGetModelProviders } from "@/controllers/API/queries/models/use-get-model-providers";
import { ColDef } from "ag-grid-community";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

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
            EvaluationsTable;
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

function EvaluationForm() {
  // TODO: acredito que user groupedmodels não é exatamente necessário
  // Verifique se useGroupedModels pode ser substituído por useGetEnabledModels
  const groupedModels = useGroupedModels();

  const { id: flow_id } = useParams();

  // Form field states
  const [name, setName] = useState<string>("");
  const [evaluationInput, setEvaluationInput] = useState<string>("");
  const [expectedOutput, setExpectedOutput] = useState<string>("");
  const [threshold, setThreshold] = useState<number>(0.5);
  const [selectedModelName, setSelectedModelName] = useState<string>("");
  const [prompt, setPrompt] = useState<string>("");

  const createEvaluationMutation = useCreateEvaluationCase({});
  const handleSubmit = (e) => {
    e.preventDefault();
    createEvaluationMutation.mutate({
      name: name,
      input: evaluationInput,
      flow_id: flow_id,
      expected_output: expectedOutput,
      prompt: prompt,
      model_name: selectedModelName,
    });
  };

  return (
    <form
      className="flex flex-col w-1/2 mx-auto gap-4 p-4"
      onSubmit={handleSubmit}
    >
      <h2 className="font-semibold">Evaluation cases</h2>
      <Input
        value={name}
        onChange={(e) => {
          setName(e.target.value);
        }}
        placeholder="Name"
      />
      <Input
        value={evaluationInput}
        onChange={(e) => {
          setEvaluationInput(e.target.value);
        }}
        placeholder="Input"
      />
      <Input
        value={expectedOutput}
        onChange={(e) => {
          setExpectedOutput(e.target.value);
        }}
        placeholder="Expected output"
      />
      <Textarea
        placeholder="Prompt"
        onChange={(e) => setPrompt(e.target.value)}
        value={prompt}
      />
      <Input
        value={threshold}
        onChange={(e) => {
          setThreshold(Number.parseFloat(e.target.value));
        }}
        type="number"
        step={0.05}
        min={0.0}
        max={1.0}
        placeholder="Threshold"
      />

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
      <Button className="px-4 py-2 hover:bg-green-500 w-fit" type="submit">
        Criar
      </Button>
    </form>
  );
}

function EvaluationResultsTable() {
  const { id: flowId } = useParams();
  const evaluationResults = useGetFlowEvalResults(flowId);
  /*
  {
      "actual_output": "{\n\t\"score\": 0.6,\n\t\"response\": \"The actual response is acceptable as it maintains a polite and welcoming tone, aligning with the intent of the expected output ('Hello, human'). However, it deviates from the specific persona or greeting style requested in the expected output.\"\n}",
      "score": 0.5,
      "eval_message": "content=[{'type': 'text', 'text': '{\\n\\t\"score\": 0.6,\\n\\t\"response\": \"The actual response is acceptable as it maintains a polite and welcoming tone, aligning with the intent of the expected output (\\'Hello, human\\'). However, it deviates from the specific persona or greeting style requested in the expected output.\"\\n}', 'extras': {'signature': 'EjQKMgEMOdbH83pPH64pD7isICrwFBNpOsdx3xEtkhGv09ebaRx8ExLPygFy8DGKWZnxaCQ3'}}] additional_kwargs={} response_metadata={'finish_reason': 'STOP', 'model_name': 'gemini-3.1-flash-lite', 'safety_ratings': [], 'model_provider': 'google_genai'} id='lc_run--019e2a77-e4c6-7f73-87a5-38143bb70dd1-0' tool_calls=[] invalid_tool_calls=[] usage_metadata={'input_tokens': 146, 'output_tokens': 63, 'total_tokens': 209, 'input_token_details': {'cache_read': 0}}",
      "success": true,
        "user_id": "a45ef866-a513-4642-b029-2b59aff3d06f",
        "evaluation_case_id": "61b7d778-0aed-45e4-99fa-222cf7c56bdd",
      "id": "5763238c-50ac-4bb8-8250-8f30ed2241d7"
  }
  */

  // Configuração das Colunas (Columns)
  const columns: ColDef[] = [
    {
      headerName: "ID",
      field: "id",
      width: 120,
      filter: true,
      sortable: true,
    },

    {
      headerName: "Score Geral",
      field: "score",
      width: 120,
      sortable: true,
    },
    {
      headerName: "Score Interno (Output)",
      field: "actual_output",
      width: 150,
      // Faz o parse do JSON interno para buscar o score lá de dentro
      valueGetter: (params) => {
        try {
          const parsed = JSON.parse(params.data.actual_output);
          return parsed.score;
        } catch (e) {
          return "N/A";
        }
      },
    },
    {
      headerName: "Response (Output)",
      field: "actual_output",
      minWidth: 250,
      wrapText: true,
      autoHeight: true,
    },
    {
      headerName: "Eval Message",
      field: "eval_message",
      minWidth: 300,
      wrapText: true,
      autoHeight: true,
    },
    {
      headerName: "Success",
      field: "success",
      width: 50,
      // Converte o booleano em um texto mais amigável visualmente
      cellRenderer: (params) =>
        params.value ? (
          <ForwardedIconComponent
            className="text-green-500 w-5 h-5"
            name="circle-check"
          />
        ) : (
          <ForwardedIconComponent
            className="text-red-500  w-5 h-5"
            name="circle-x"
          />
        ),
    },
  ];

  // Exemplo de como a lista de linhas (rows) deve ser injetada na tabela
  const rows = evaluationResults.data?.items || [];

  return (
    <TableComponent
      key="Evaluations"
      readOnlyEdit
      className="h-max-full h-full w-full"
      pagination={false}
      columnDefs={columns}
      rowData={rows}
      autoSizeStrategy={{ type: "fitGridWidth" }}
      headerHeight={40}
    />
  );
}

function EvaluationsTable() {
  const { id: flowId } = useParams();
  const evaluationCases = useGetFlowEvaluationCases(flowId);
  const runEvaluation = useRunEvaluation();

  const columns: ColDef[] = [
    {
      headerName: "ID",
      field: "id",
      flex: 1.0,
      minWidth: 240,
      filter: false,
      sortable: false,
      editable: false,
    },
    {
      headerName: "Description",
      field: "name",
      flex: 1.0,
      minWidth: 240,
      filter: false,
      sortable: false,
      editable: false,
    },
    {
      headerName: "Input",
      field: "input",
      flex: 1.0,
      minWidth: 240,
      filter: false,
      sortable: false,
      editable: false,
    },
    {
      headerName: "Expected output",
      field: "expected_output",
      flex: 1.0,
      minWidth: 240,
      filter: false,
      sortable: false,
      editable: false,
    },
    {
      headerName: "Run",
      filter: false,
      sortable: false,
      editable: false,
      cellRenderer: (item) => (
        <Button
          unstyled
          className="flex gap-2 border-0 border-green-500 text-green-500 px-2 py-1 font-semibold rounded hover:text-white hover:bg-green-700 hover:border-green-800 active:bg-red-500"
          onClick={() => {
            if (!runEvaluation.isPending) runEvaluation.mutate(item.data.id);
          }}
        >
          <ForwardedIconComponent
            name="play"
            className="w-4 h-4 group-hover:text-primary"
          />
          {runEvaluation.isPending ? "Loading..." : "Execute"}
        </Button>
      ),
    },
  ];
  // const rows = evaluationCases.data;
  const rows = evaluationCases.data?.evaluation_cases || [];
  console.log("Evals:", evaluationCases.data);

  return (
    <TableComponent
      key="Evaluations"
      readOnlyEdit
      className="h-max-full h-full w-full"
      pagination={false}
      columnDefs={columns}
      rowData={rows}
      autoSizeStrategy={{ type: "fitGridWidth" }}
      headerHeight={40}
    />
  );
}

export default function FlowEvaluations(props: FlowEvaluationsProps) {
  const tabs = ["evaluation_results", "evaluation_cases", "create_eval_case"];
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

      <div className="h-full flex flex-col ">
        {currentTab === "evaluation_results" && <EvaluationResultsTable />}
        {currentTab === "evaluation_cases" && <EvaluationsTable />}
        {currentTab === "create_eval_case" && <EvaluationForm />}
      </div>
    </div>
  );
}
