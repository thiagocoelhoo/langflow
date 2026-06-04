import ForwardedIconComponent from "@/components/common/genericIconComponent";
import TableComponent from "@/components/core/parameterRenderComponent/components/tableComponent";
import { useGetFlowEvalResults } from "@/controllers/API/queries/flows/use-get-flow-eval-results";
import { ColDef } from "ag-grid-community";
import { useParams } from "react-router-dom";

export default function EvalRunsTable() {
  const { id: flowId } = useParams();
  const evaluationResults = useGetFlowEvalResults(flowId);

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
      headerName: "Actual Output",
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
    // {
    //   headerName: "Response (Output)",
    //   field: "actual_output",
    //   minWidth: 250,
    //   wrapText: true,
    //   autoHeight: true,
    // },
    {
      headerName: "Eval Case",
      field: "eval_case",
      minWidth: 300,
      wrapText: true,
      autoHeight: true,
      valueGetter: (params) => {
        return params.data.eval_case.name;
      },
    },

    {
      headerName: "Metric",
      field: "eval_metric",
      minWidth: 300,
      wrapText: true,
      autoHeight: true,
      valueGetter: (params) => {
        return params.data.eval_metric.name;
      },
    },
    {
      headerName: "Algorithm",
      field: "eval_metric",
      minWidth: 300,
      wrapText: true,
      autoHeight: true,
      valueGetter: (params) => {
        return params.data.eval_metric.algorithm;
      },
    },
    {
      headerName: "Eval Message",
      field: "message",
      minWidth: 300,
      wrapText: true,
      autoHeight: true,
    },
    {
      headerName: "Date",
      field: "created_at",
      wrapText: false,
    },
    {
      headerName: "Score",
      field: "score",
      width: 120,
      sortable: true,
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
