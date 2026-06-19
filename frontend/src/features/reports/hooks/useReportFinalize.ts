import { useCallback, useState } from "react";
import { useFormStore } from "@/features/reports/model/useFormStore";
import { useReportStore } from "@/features/reports/model/useReportStore";
import { reportService } from "@/features/reports/api/reportApi";
import { documentService } from "@/features/reports/api/documentApi";

interface UseReportFinalizeParams {
  reportId?: string;
}

export function useReportFinalize({ reportId }: UseReportFinalizeParams) {
  const { step5 } = useFormStore();
  const { currentReport } = useReportStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState(false);

  const handleFinalize = useCallback(async () => {
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
  }, [reportId, step5, isGenerating, currentReport?.report_number]);

  return {
    isGenerating,
    generateError,
    generateSuccess,
    setGenerateSuccess,
    handleFinalize,
  };
}
