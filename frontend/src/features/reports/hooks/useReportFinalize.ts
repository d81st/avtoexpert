import { useState } from "react";
import { useFormStore } from "../model/useFormStore";
import { useReportStore } from "../model/useReportStore";
import { reportService } from "../api/reportApi";
import { documentService } from "../api/documentApi";

interface UseReportFinalizeParams {
  reportId?: string;
}

export interface UseReportFinalizeReturn {
  isGenerating: boolean;
  generateError: string | null;
  generateSuccess: boolean;
  setGenerateSuccess: (value: boolean) => void;
  handleFinalize: () => Promise<void>;
}

export function useReportFinalize({ reportId }: UseReportFinalizeParams): UseReportFinalizeReturn {
  const { step5 } = useFormStore();
  const { currentReport } = useReportStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState(false);

  const handleFinalize = async () => {
    if (!reportId || isGenerating) return;

    setIsGenerating(true);
    setGenerateError(null);
    setGenerateSuccess(false);

    try {
      if (step5) {
        await reportService.updateStep5(reportId, step5);
      }

      const result = await documentService.finalizeAndGenerate(reportId);
      const filename =
        result.filename ||
        `zaklyuchenie_${currentReport?.report_number || reportId}.docx`;
      await documentService.downloadDocument(result.download_url, filename);

      setGenerateSuccess(true);
    } catch (err) {
      setGenerateError(
        (err as Error).message || "Ошибка генерации документа",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    isGenerating,
    generateError,
    generateSuccess,
    setGenerateSuccess,
    handleFinalize,
  };
}
