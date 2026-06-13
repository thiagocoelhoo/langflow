import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EvaluationCaseType } from "@/types/evaluations";
import CreateEvalCaseForm from "../../CreateEvalCase";

type EvalCaseModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowId?: string;
  evaluationCase?: EvaluationCaseType | null;
};

export default function EvalCaseModal({
  open,
  onOpenChange,
  flowId,
  evaluationCase = null,
}: EvalCaseModalProps) {
  const isEditing = Boolean(evaluationCase);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden">
        <DialogHeader className="pr-8">
          <DialogTitle>
            {isEditing ? "Edit eval case" : "Create eval case"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the case definition, expected output, tools, model, and metric metadata."
              : "Create a new eval case for this flow and configure the metrics that should run with it."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          <CreateEvalCaseForm
            flowId={flowId}
            initialCase={evaluationCase}
            onSuccess={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
