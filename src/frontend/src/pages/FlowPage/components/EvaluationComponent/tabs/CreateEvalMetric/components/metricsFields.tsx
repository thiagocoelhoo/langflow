import { Textarea } from "@/components/ui/textarea";

interface MetricFields {
  data: Object;
  setData: (Object) => void;
}

export function AgentJudgeMetricFields({ data, setData }: MetricFields) {
  return (
    <>
      <label>Judge prompt</label>
      <Textarea
        rows={5}
        value={data.prompt}
        onChange={(e) => setData({ ...data, prompt: e.target.value })}
        onClick={() => console.log("click")}
        placeholder="Descreva como o agente deve julgar a resposta real com base na resposta exeperada."
      />
      <label>Tools</label>
      <Textarea
        rows={5}
        placeholder={
          'Descreva como o agente deve julgar o uso das ferramentas com base em "expected" tools'
        }
      />
    </>
  );
}

export function ToolsMetricFields({ data, setData }: MetricFields) {
  // the tool metric doenst have any field
}

export function NodeEvalFields({ data, setData }: MetricFields) {
  // the tool doest have any field
}
