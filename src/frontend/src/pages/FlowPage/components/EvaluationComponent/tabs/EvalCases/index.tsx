import ForwardedIconComponent from "@/components/common/genericIconComponent";
import TableComponent from "@/components/core/parameterRenderComponent/components/tableComponent";
import { Button } from "@/components/ui/button";
import { useGetFlowEvaluationCases } from "@/controllers/API/queries/eval-cases/use-get-flow-evaluation-cases";
import { useRunEvaluation } from "@/controllers/API/queries/eval-cases/use-run-evaluation";
import { ColDef } from "ag-grid-community";
import { useParams } from "react-router-dom";

export default function EvalCasesTable() {
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
      // field: "input",
      flex: 1.0,
      minWidth: 240,
      filter: false,
      sortable: false,
      editable: false,
      cellRenderer: (item) => JSON.stringify(item.data.input),
    },
    {
      headerName: "Expected output",
      field: "expected_output",
      flex: 1.0,
      minWidth: 240,
      filter: false,
      sortable: false,
      editable: false,
      cellRenderer: (item) => {
        const messages = item.data.expected_output?.messages;

        if (messages instanceof Array) {
          return JSON.stringify(messages);
        }
      },
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
  const rows = evaluationCases.data?.eval_cases || [];
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
