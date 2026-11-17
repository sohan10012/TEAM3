import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bug } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { Button, Dialog, Field, Input, Select, Textarea } from "@/components/ui";
import { api } from "@/services/api";

interface CreateDefectFromResultModalProps {
  resultId: number | null;
  onClose: () => void;
}

export function CreateDefectFromResultModal({
  resultId,
  onClose,
}: CreateDefectFromResultModalProps) {
  const qc = useQueryClient();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState("high");
  const [priority, setPriority] = useState("p1");
  const [description, setDescription] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [actualResult, setActualResult] = useState("");
  const [reproSteps, setReproSteps] = useState("");

  const q = useQuery({
    queryKey: ["execution-result", resultId],
    queryFn: () => api.get<any>(`/execution-results/${resultId}`),
    enabled: Boolean(resultId),
  });

  useEffect(() => {
    if (q.data) {
      const tc = q.data.test_case;
      const ex = q.data.execution_key || `#${q.data.execution_id}`;
      const tcLabel = tc?.key || `RES-${resultId}`;
      setTitle(`Failure in ${tcLabel}: ${q.data.message?.slice(0, 70) || "Assertion failure"}`);
      setDescription(`Observed execution discrepancy during test run ${ex}.\n\nObserved Failure Message:\n${q.data.message || "N/A"}`);
      setExpectedResult(tc?.expected_result || "Operation succeeds matching specification.");
      setActualResult(q.data.message || "Failure reported in runner execution.");
      setReproSteps(`1. Execute test case ${tc?.key || ""} under runner ${q.data.runner || "simulation"}.\n2. Observe discrepancy assertion.`);
    }
  }, [q.data, resultId]);

  const createDefectMutation = useMutation({
    mutationFn: () =>
      api.post(`/execution-results/${resultId}/defects`, {
        action: "create",
        title,
        severity,
        priority,
        description,
        expected_result: expectedResult,
        actual_result: actualResult,
        reproduction_steps: reproSteps,
      }),
    onSuccess: (data: any) => {
      toast.ok(`Defect ${data.key} filed successfully from execution result!`);
      qc.invalidateQueries({ queryKey: ["execution-result", resultId] });
      qc.invalidateQueries({ queryKey: ["defects"] });
      onClose();
    },
    onError: toast.error,
  });

  if (!resultId) return null;

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="File Defect from Execution Failure"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            disabled={!title.trim()}
            loading={createDefectMutation.isPending}
            onClick={() => createDefectMutation.mutate()}
          >
            <Bug className="h-4 w-4 mr-1.5" />
            File Defect
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5 text-xs">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-slate-700 space-y-0.5">
          <span className="text-[10px] text-slate-500 font-semibold uppercase">Linked Context</span>
          <p className="font-mono text-[11px] font-bold text-slate-900">
            {q.data?.test_case?.key || `Test #${q.data?.test_case_id}`} — Run {q.data?.execution_key || `#${q.data?.execution_id}`}
          </p>
        </div>

        <Field label="Defect Title" htmlFor="defect-title">
          <Input
            id="defect-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Concise defect summary"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Severity" htmlFor="defect-severity">
            <Select id="defect-severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </Field>

          <Field label="Priority" htmlFor="defect-priority">
            <Select id="defect-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="p0">P0 (Immediate)</option>
              <option value="p1">P1 (High)</option>
              <option value="p2">P2 (Medium)</option>
              <option value="p3">P3 (Low)</option>
            </Select>
          </Field>
        </div>

        <Field label="Expected Result" htmlFor="defect-expected">
          <Textarea
            id="defect-expected"
            rows={2}
            value={expectedResult}
            onChange={(e) => setExpectedResult(e.target.value)}
          />
        </Field>

        <Field label="Actual Result / Observed Failure" htmlFor="defect-actual">
          <Textarea
            id="defect-actual"
            rows={2}
            value={actualResult}
            onChange={(e) => setActualResult(e.target.value)}
          />
        </Field>

        <Field label="Reproduction Steps" htmlFor="defect-repro">
          <Textarea
            id="defect-repro"
            rows={3}
            value={reproSteps}
            onChange={(e) => setReproSteps(e.target.value)}
          />
        </Field>
      </div>
    </Dialog>
  );
}
