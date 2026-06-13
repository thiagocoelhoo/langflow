import { ColDef } from "ag-grid-community";
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Gauge,
  Layers3,
  Menu,
  Sparkles,
  TrendingUp,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import TableComponent from "@/components/core/parameterRenderComponent/components/tableComponent";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs-button";
import type {
  EvaluationBatchSummaryType,
  EvaluationBatchType,
  EvaluationRunType,
} from "@/types/evaluations";
import { cn } from "@/utils/utils";

type EvalResultsDashboardProps = {
  batches: EvaluationBatchSummaryType[];
  selectedBatch: EvaluationBatchType | null;
  selectedBatchId: string | null;
  onSelectBatch: (batchId: string) => void;
  isLoading?: boolean;
  isBatchLoading?: boolean;
};

type BatchCaseSummary = {
  id: string;
  label: string;
  averageScore: number;
  totalRuns: number;
  failedRuns: number;
  successfulRuns: number;
  metrics: string[];
  latestMessage: string | null;
};

type MetricTrendPoint = {
  batchId: string;
  batchLabel: string;
  batchDate: string;
  averageScore: number;
  successRate: number;
  totalRuns: number;
  failedRuns: number;
  isSelected: boolean;
};

type MetricTrendSeries = {
  metricId: string;
  metricName: string;
  algorithm: string;
  points: MetricTrendPoint[];
};

const PASSING_SCORE_THRESHOLD = 0.7;

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatScore(value: number): string {
  return value.toFixed(2);
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "No date";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "No date";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsedDate);
}

function getBatchSuccessRate(batch: EvaluationBatchSummaryType): number {
  return batch.total_runs > 0 ? batch.successful_runs / batch.total_runs : 0;
}

function getBatchStatusVariant(status: string) {
  if (status === "completed") {
    return "successStatic" as const;
  }

  if (status === "completed_with_errors" || status === "failed") {
    return "errorStatic" as const;
  }

  return "secondaryStatic" as const;
}

function getTriggerModeLabel(triggerMode: string): string {
  switch (triggerMode) {
    case "single_case":
      return "Single case";
    case "selected_cases":
      return "Selected cases";
    case "all_cases":
      return "Full suite";
    case "legacy":
      return "Legacy";
    default:
      return triggerMode.replaceAll("_", " ");
  }
}

function getBatchLabel(batch: EvaluationBatchSummaryType): string {
  return `${getTriggerModeLabel(batch.trigger_mode)}`;
}

function buildCaseSummaries(
  batch: EvaluationBatchType | null,
): BatchCaseSummary[] {
  if (!batch) {
    return [];
  }

  const groupedCases = new Map<string, BatchCaseSummary>();

  batch.runs.forEach((run) => {
    const caseId = run.eval_case?.id ?? run.eval_case_id ?? run.id;
    const existing = groupedCases.get(caseId) ?? {
      id: caseId,
      label: run.eval_case?.name ?? "Unnamed case",
      averageScore: 0,
      totalRuns: 0,
      failedRuns: 0,
      successfulRuns: 0,
      metrics: [],
      latestMessage: null,
    };

    existing.totalRuns += 1;
    existing.averageScore += run.score;
    if (run.err_message?.trim()) {
      existing.failedRuns += 1;
    } else {
      existing.successfulRuns += 1;
    }

    if (
      run.eval_metric?.name &&
      !existing.metrics.includes(run.eval_metric.name)
    ) {
      existing.metrics.push(run.eval_metric.name);
    }

    if (!existing.latestMessage) {
      existing.latestMessage = run.err_message ?? run.message ?? null;
    }

    groupedCases.set(caseId, existing);
  });

  return Array.from(groupedCases.values())
    .map((item) => ({
      ...item,
      averageScore: item.totalRuns > 0 ? item.averageScore / item.totalRuns : 0,
    }))
    .sort((left, right) => {
      if (left.averageScore !== right.averageScore) {
        return left.averageScore - right.averageScore;
      }
      return right.failedRuns - left.failedRuns;
    });
}

function buildMetricTrendSeries(
  batches: EvaluationBatchSummaryType[],
  selectedBatchId: string | null,
): MetricTrendSeries[] {
  const groupedSeries = new Map<string, MetricTrendSeries>();
  const orderedBatches = [...batches].slice().sort((left, right) => {
    const leftTime = new Date(
      left.started_at ?? left.created_at ?? 0,
    ).getTime();
    const rightTime = new Date(
      right.started_at ?? right.created_at ?? 0,
    ).getTime();
    return leftTime - rightTime;
  });

  orderedBatches.forEach((batch, batchIndex) => {
    batch.metric_summaries.forEach((metricSummary) => {
      const currentSeries = groupedSeries.get(metricSummary.metric_id) ?? {
        metricId: metricSummary.metric_id,
        metricName: metricSummary.metric_name,
        algorithm: metricSummary.algorithm,
        points: [],
      };

      currentSeries.points.push({
        batchId: batch.id,
        batchLabel: getBatchLabel(batch),
        batchDate: formatDate(batch.started_at ?? batch.created_at),
        averageScore: metricSummary.average_score,
        successRate: metricSummary.success_rate,
        totalRuns: metricSummary.total_runs,
        failedRuns: metricSummary.failed_runs,
        isSelected: batch.id === selectedBatchId,
      });

      groupedSeries.set(metricSummary.metric_id, currentSeries);
    });
  });

  return Array.from(groupedSeries.values()).sort((left, right) =>
    left.metricName.localeCompare(right.metricName),
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof Activity;
}) {
  return (
    <Card className="border-border/70 bg-background/40 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardDescription>{title}</CardDescription>
          <CardTitle className="mt-2 text-3xl font-semibold">{value}</CardTitle>
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/60 p-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function BatchHistoryPanel({
  batches,
  selectedBatchId,
  onSelectBatch,
  isOpen,
  setIsOpen,
}: {
  batches: EvaluationBatchSummaryType[];
  selectedBatchId: string | null;
  onSelectBatch: (batchId: string) => void;
  isOpen: boolean;
  setIsOpen: (boolean) => void;
}) {
  return (
    <>
      <button
        className={cn(
          "border border-border/70 w-fit p-1.5 rounded-lg transition-all duration-300",
          isOpen ? "hidden" : "",
        )}
        onClick={() => setIsOpen(true)}
      >
        <Menu />
      </button>
      <Card
        className={cn(
          "flex border-border/70 bg-background transition-all duration-300",
          "inset-y-0 left-0 z-50 w-96 p-0 shadow-xl md:shadow-none",
          "md:top-4 md:h-[calc(100vh-2rem)]",
          isOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0 md:w-0 md:p-0 md:overflow-hidden md:border-none",
        )}
      >
        <CardHeader className="p-1.5 flex flex-row gap-2 items-center border-b border-border justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers3 className="h-4 w-4" />
              Execution history
            </CardTitle>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-md p-1 hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>
        <CardContent className="flex flex-col space-y-2 p-1.5 overflow-y-auto grow">
          {batches.map((batch, index) => {
            const isSelected = batch.id === selectedBatchId;
            const successRate = getBatchSuccessRate(batch);
            return (
              <button
                key={batch.id}
                type="button"
                onClick={() => onSelectBatch(batch.id)}
                className={cn(
                  "flex w-full flex-col gap-3 rounded-xl border p-4 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border/60 bg-background/50 hover:bg-muted/40",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {getBatchLabel(batch)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(batch.started_at ?? batch.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-col items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      score {formatScore(batch.average_score)}
                    </span>
                    <Badge
                      size="tag"
                      variant={getBatchStatusVariant(batch.status)}
                      className="uppercase"
                    >
                      {batch.status.replaceAll("_", " ")}
                    </Badge>
                  </div>
                </div>
                {/*
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>
                    {batch.requested_case_count} case
                    {batch.requested_case_count === 1 ? "" : "s"}
                  </span>
                  <span>•</span>
                  <span>
                    {batch.total_runs} run{batch.total_runs === 1 ? "" : "s"}
                  </span>
                  <span>•</span>
                  <span>{formatPercent(successRate)} success</span>
                </div>*/}

                {/*<span className="text-muted-foreground">
                    {batch.metric_summaries.length} metric
                    {batch.metric_summaries.length === 1 ? "" : "s"}
                  </span>*/}
              </button>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}

function MetricScatterPlot({
  points,
  onSelectBatch,
}: {
  points: MetricTrendPoint[];
  onSelectBatch: (batchId: string) => void;
}) {
  const width = 320;
  const height = 140;
  const padding = 18;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full">
      {[0, 0.5, 1].map((tick) => {
        const y = padding + (1 - tick) * chartHeight;
        return (
          <g key={tick}>
            <line
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              className="stroke-border/60"
              strokeWidth="1"
            />
            <text x={6} y={y + 4} className="fill-muted-foreground text-[10px]">
              {tick.toFixed(1)}
            </text>
          </g>
        );
      })}

      {points.map((point, index) => {
        const x =
          points.length === 1
            ? padding + chartWidth / 2
            : padding + (index / (points.length - 1)) * chartWidth;
        const y = padding + (1 - point.averageScore) * chartHeight;
        const radius = point.isSelected ? 6 : 4;
        const colorClass =
          point.failedRuns > 0 ? "fill-error-foreground" : "fill-primary";

        return (
          <g key={`${point.batchId}-${point.batchDate}`}>
            <circle
              cx={x}
              cy={y}
              r={radius}
              className={cn(
                "cursor-pointer stroke-background transition-transform hover:scale-110",
                colorClass,
                point.isSelected && "stroke-2",
              )}
              onClick={() => onSelectBatch(point.batchId)}
            >
              <title>
                {`${point.batchLabel} • ${point.batchDate}\nScore: ${formatScore(point.averageScore)}\nSuccess: ${formatPercent(point.successRate)}\nRuns: ${point.totalRuns}`}
              </title>
            </circle>
          </g>
        );
      })}
    </svg>
  );
}

function MetricTrendCard({
  series,
  onSelectBatch,
}: {
  series: MetricTrendSeries;
  onSelectBatch: (batchId: string) => void;
}) {
  const selectedPoint =
    series.points.find((point) => point.isSelected) ??
    series.points[series.points.length - 1];
  const selectedIndex = series.points.findIndex((point) => point.isSelected);
  const previousPoint =
    selectedIndex > 0 ? series.points[selectedIndex - 1] : undefined;
  const delta =
    previousPoint !== undefined
      ? selectedPoint.averageScore - previousPoint.averageScore
      : null;

  return (
    <Card className="border-border/70 bg-background/40 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{series.metricName}</CardTitle>
            <CardDescription>
              {series.algorithm.replaceAll("_", " ")}
            </CardDescription>
          </div>
          <Badge size="tag" variant="secondaryStatic">
            {selectedPoint ? formatScore(selectedPoint.averageScore) : "-"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <MetricScatterPlot
          points={series.points}
          onSelectBatch={onSelectBatch}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {selectedPoint ? formatPercent(selectedPoint.successRate) : "0%"}{" "}
            success
          </span>
          <span>
            {selectedPoint
              ? `${selectedPoint.totalRuns} run${selectedPoint.totalRuns === 1 ? "" : "s"}`
              : "0 runs"}
          </span>
          <span
            className={cn(
              delta !== null && delta >= 0
                ? "text-accent-emerald-foreground"
                : "text-error-foreground",
            )}
          >
            {delta === null
              ? "No previous batch"
              : `Δ ${delta >= 0 ? "+" : ""}${formatScore(delta)}`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function CaseOverviewCard({ caseSummary }: { caseSummary: BatchCaseSummary }) {
  const successRate =
    caseSummary.totalRuns > 0
      ? caseSummary.successfulRuns / caseSummary.totalRuns
      : 0;

  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-background/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            {caseSummary.label}
          </p>
          <p className="text-xs text-muted-foreground">
            {caseSummary.metrics.join(", ") || "No metrics registered"}
          </p>
        </div>
        <Badge
          size="tag"
          variant={caseSummary.failedRuns > 0 ? "errorStatic" : "successStatic"}
        >
          {formatScore(caseSummary.averageScore)}
        </Badge>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatPercent(successRate)} success</span>
        <span>
          {caseSummary.totalRuns} run{caseSummary.totalRuns === 1 ? "" : "s"}
        </span>
      </div>
      {caseSummary.latestMessage && (
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {caseSummary.latestMessage}
        </p>
      )}
    </div>
  );
}

function EvalRunsTable({ rows }) {
  const columns: ColDef[] = useMemo(
    () => [
      {
        headerName: "ID",
        field: "id",
        minWidth: 220,
        filter: true,
        sortable: true,
      },
      {
        headerName: "Eval Case",
        field: "eval_case",
        minWidth: 240,
        wrapText: true,
        autoHeight: true,
        valueGetter: (params) => params.data.eval_case?.name ?? "-",
      },
      {
        headerName: "Metric",
        field: "eval_metric",
        minWidth: 220,
        wrapText: true,
        autoHeight: true,
        valueGetter: (params) => params.data.eval_metric?.name ?? "-",
      },
      {
        headerName: "Algorithm",
        field: "eval_metric",
        minWidth: 220,
        wrapText: true,
        autoHeight: true,
        valueGetter: (params) => params.data.eval_metric?.algorithm ?? "-",
      },
      {
        headerName: "Message",
        minWidth: 320,
        wrapText: true,
        autoHeight: true,
        valueGetter: (params) =>
          params.data.err_message ?? params.data.message ?? "-",
      },
      {
        headerName: "Date",
        field: "created_at",
        minWidth: 200,
        sortable: true,
        valueGetter: (params) => formatCreatedAt(params.data.created_at),
      },
      {
        headerName: "Score",
        field: "score",
        width: 120,
        sortable: true,
        valueFormatter: (params) =>
          typeof params.value === "number" ? params.value.toFixed(2) : "-",
      },
      {
        headerName: "Success",
        field: "err_message",
        width: 100,
        sortable: true,
        valueGetter: (params) => !params.data.err_message?.trim(),
        cellRenderer: (params) =>
          params.value ? (
            <ForwardedIconComponent
              className="h-5 w-5 text-green-500"
              name="circle-check"
            />
          ) : (
            <ForwardedIconComponent
              className="h-5 w-5 text-red-500"
              name="circle-x"
            />
          ),
      },
    ],
    [],
  );

  const formatCreatedAt = (value?: string | null): string => {
    if (!value) {
      return "-";
    }

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
      return "-";
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(parsedDate);
  };

  return (
    <Card className="flex min-h-0 flex-1 flex-col border-border/70 bg-background/40 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-base">Raw runs in selected batch</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        <TableComponent
          key="EvaluationRuns"
          readOnlyEdit
          className="h-full w-full"
          pagination={false}
          columnDefs={columns}
          rowData={rows}
          autoSizeStrategy={{ type: "fitGridWidth" }}
          headerHeight={40}
        />
      </CardContent>
    </Card>
  );
}

function EvalRunsDashboard({ batches, selectedBatch, onSelectBatch }) {
  const successRate = selectedBatch ? getBatchSuccessRate(selectedBatch) : 0;
  const metricTrendSeries = buildMetricTrendSeries(batches, selectedBatch.id);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/*<SummaryCard
          title="Recorded batches"
          value={String(batches.length)}
          description="Historical executions available for comparison and trend analysis."
          icon={Layers3}
        />*/}
        <SummaryCard
          title="Selected batch score"
          value={selectedBatch ? formatScore(selectedBatch.average_score) : "-"}
          description="Average score across all metric runs in the active batch."
          icon={Gauge}
        />
        <SummaryCard
          title="Success rate"
          value={selectedBatch ? formatPercent(successRate) : "-"}
          description={
            selectedBatch
              ? `${selectedBatch.successful_runs} successful run${selectedBatch.successful_runs === 1 ? "" : "s"} and ${selectedBatch.failed_runs} failed.`
              : "Select a batch to inspect its health."
          }
          icon={CheckCircle2}
        />
        <SummaryCard
          title="Metrics tracked"
          value={String(selectedBatch?.metric_summaries.length ?? 0)}
          description="Metrics available in the selected batch for trend analysis over time."
          icon={Sparkles}
        />
      </div>
      <Card className="border-border/70 bg-background/40 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">
            Metric evolution over time
          </CardTitle>
          <CardDescription>
            Scatter plots compare metric scores across recorded batches. Click a
            point to switch the active batch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {metricTrendSeries.map((series) => (
              <MetricTrendCard
                key={series.metricId}
                series={series}
                onSelectBatch={onSelectBatch}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function EvalResultsTab({
  batches,
  selectedBatch,
  selectedBatchId,
  onSelectBatch,
  isLoading = false,
  isBatchLoading = false,
}: EvalResultsDashboardProps) {
  if (isLoading && batches.length === 0) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card
            key={`eval-dashboard-loading-${index}`}
            className="h-32 animate-pulse border-border/60 bg-muted/60"
          />
        ))}
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <Card className="border-dashed border-border/70 bg-background/40">
        <CardHeader>
          <CardTitle>No evaluation batches yet</CardTitle>
          <CardDescription>
            Execute one or more eval cases to create the first recorded batch
            for this flow.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const [isOpen, setIsOpen] = useState(true);

  const caseSummaries = buildCaseSummaries(selectedBatch).slice(0, 6);

  const viewModes = [
    {
      name: "table",
      title: "Table view",
      icon: "Table",
    },
    {
      name: "dashboard",
      title: "Dashboard",
      icon: "ChartLine",
    },
  ];
  const [selectedViewMode, setSelectedViewMode] = useState("table");

  return (
    <div className="flex flex-row gap-2 items-start">
      <BatchHistoryPanel
        batches={batches}
        selectedBatchId={selectedBatchId}
        onSelectBatch={onSelectBatch}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
      />

      <div className="flex flex-col gap-4 p-4 w-full h-full">
        {/* Header */}
        <div className="flex flex-row justify-between items-center">
          <h2>{selectedBatch && getBatchLabel(selectedBatch)} </h2>
          <div>
            <span className="text-[13px] font-medium text-muted-foreground">
              View mode
            </span>
            <Tabs value={selectedViewMode} onValueChange={setSelectedViewMode}>
              <TabsList>
                {viewModes.map((tab, index) => (
                  <TabsTrigger
                    className="flex select-none items-center gap-2"
                    key={index}
                    value={tab.name}
                  >
                    <ForwardedIconComponent
                      name={tab.icon}
                      aria-hidden="true"
                      className="h-4 w-4"
                    />
                    {tab.title}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/*Content*/}
        {selectedViewMode === "dashboard" && (
          <EvalRunsDashboard
            batches={batches}
            selectedBatch={selectedBatch}
            onSelectBatch={onSelectBatch}
          />
        )}

        {selectedViewMode === "table" && (
          <EvalRunsTable rows={selectedBatch?.runs || []} />
        )}
      </div>
    </div>
  );
}
