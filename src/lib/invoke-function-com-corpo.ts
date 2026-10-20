import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  formatInvokeErrorToast,
  type InvokeBlockingField,
} from "../../supabase/functions/_shared/function-invoke-error-format.ts";

export type { InvokeBlockingField };
export { blockingFieldLabels, formatInvokeErrorToast } from "../../supabase/functions/_shared/function-invoke-error-format.ts";

export type InvokeFunctionBody = {
  success?: boolean;
  error?: string;
  blocking?: InvokeBlockingField[];
  [key: string]: unknown;
};

export type InvokeFunctionResult<T extends InvokeFunctionBody = InvokeFunctionBody> = {
  data: T | null;
  transportError: Error | null;
  success: boolean;
  error?: string;
  blocking?: InvokeBlockingField[];
};

async function readFunctionsHttpBody(error: FunctionsHttpError): Promise<InvokeFunctionBody | null> {
  try {
    return (await error.context.json()) as InvokeFunctionBody;
  } catch {
    return null;
  }
}

/** Lê corpo JSON em 4xx/5xx das Edge Functions (data vem null no invoke padrão). */
export async function invokeFunctionComCorpo<T extends InvokeFunctionBody = InvokeFunctionBody>(
  functionName: string,
  options?: { body?: Record<string, unknown> },
): Promise<InvokeFunctionResult<T>> {
  const { data, error } = await supabase.functions.invoke(functionName, options);
  if (!error) {
    const body = (data ?? null) as T | null;
    const success = body?.success !== false;
    return {
      data: body,
      transportError: null,
      success,
      error: success ? undefined : String(body?.error ?? "Operação rejeitada."),
      blocking: Array.isArray(body?.blocking) ? body!.blocking : undefined,
    };
  }
  if (error instanceof FunctionsHttpError) {
    const body = await readFunctionsHttpBody(error);
    if (body) {
      return {
        data: body as T,
        transportError: error,
        success: false,
        error: String(body.error ?? error.message),
        blocking: Array.isArray(body.blocking) ? body.blocking : undefined,
      };
    }
  }
  return {
    data: (data ?? null) as T | null,
    transportError: error,
    success: false,
    error: error.message,
  };
}
