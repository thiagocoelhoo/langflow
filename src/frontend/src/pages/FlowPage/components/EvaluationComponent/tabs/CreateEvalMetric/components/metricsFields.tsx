import { Textarea } from "@/components/ui/textarea";

interface MetricFieldsData {
  prompt?: string;
  tools?: string;
}

interface MetricFields {
  data: MetricFieldsData;
  setData: (data: MetricFieldsData) => void;
}

export function AgentJudgeMetricFields({ data, setData }: MetricFields) {
  return (
    <>
      <label>Judge prompt</label>
      <Textarea
        rows={5}
        value={data.prompt ?? ""}
        onChange={(e) => setData({ ...data, prompt: e.target.value })}
        placeholder="Descreva como o agente deve julgar a resposta real com base na resposta exeperada."
      />
      <label>Tools</label>
      <Textarea
        rows={5}
        value={data.tools ?? ""}
        onChange={(e) => setData({ ...data, tools: e.target.value })}
        placeholder={
          'Descreva como o agente deve julgar o uso das ferramentas com base em "expected" tools'
        }
      />
    </>
  );
}

export function ToolsMetricFields({ data, setData }: MetricFields) {
  void data;
  void setData;
  return null;
}

export function NodeEvalFields({ data, setData }: MetricFields) {
  void data;
  void setData;
  return null;
}
