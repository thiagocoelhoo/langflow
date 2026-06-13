import { useEffect, useState } from "react";

export interface MetricParams {
  prompt?: string;
  tools?: string;
}

export interface EvalMetricFormValues {
  name: string;
  algorithm?: string;
  params: MetricParams;
}

const EMPTY_VALUES: EvalMetricFormValues = {
  name: "",
  algorithm: undefined,
  params: {},
};

export function useEvalMetricFormState(
  initialValues?: Partial<EvalMetricFormValues>,
) {
  const [name, setName] = useState<string>(
    initialValues?.name ?? EMPTY_VALUES.name,
  );
  const [algorithm, setAlgorithm] = useState<string | undefined>(
    initialValues?.algorithm ?? EMPTY_VALUES.algorithm,
  );
  const [params, setParams] = useState<MetricParams>(
    initialValues?.params ?? EMPTY_VALUES.params,
  );

  useEffect(() => {
    setName(initialValues?.name ?? EMPTY_VALUES.name);
    setAlgorithm(initialValues?.algorithm ?? EMPTY_VALUES.algorithm);
    setParams(initialValues?.params ?? EMPTY_VALUES.params);
  }, [initialValues?.name, initialValues?.algorithm, initialValues?.params]);

  function reset(nextValues?: Partial<EvalMetricFormValues>) {
    setName(nextValues?.name ?? EMPTY_VALUES.name);
    setAlgorithm(nextValues?.algorithm ?? EMPTY_VALUES.algorithm);
    setParams(nextValues?.params ?? EMPTY_VALUES.params);
  }

  return {
    name,
    setName,
    algorithm,
    setAlgorithm,
    params,
    setParams,
    reset,
  };
}
