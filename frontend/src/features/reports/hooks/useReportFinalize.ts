import { useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { documentService } from '../api/documentApi';
import { reportService } from '../api/reportApi';
import { reportQueryKeys } from '../model/reportQueries';
import { useFormStore } from '../model/useFormStore';
import { useReportStore } from '../model/useReportStore';

const SUCCESS_COOLDOWN_MS = 5_000;
const DEFAULT_RATE_LIMIT_COOLDOWN_S = 60;

export type CooldownReason = null | 'in-flight' | 'success' | 'rate-limit';

interface RateLimit429Body {
  error?: string;
  retry_after_seconds?: number;
}

interface UseReportFinalizeParams {
  reportId?: string;
}

export interface UseReportFinalizeReturn {
  isGenerating: boolean;
  generateError: string | null;
  generateSuccess: boolean;
  cooldownReason: CooldownReason;
  cooldownSecondsLeft: number;
  handleFinalize: () => Promise<void>;
}

function pickRetryAfterSeconds(header: unknown, body: unknown): number {
  const headerNum = Number(header);
  if (Number.isFinite(headerNum) && headerNum > 0) {
    return headerNum;
  }

  const bodyNum = Number(body);
  if (Number.isFinite(bodyNum) && bodyNum > 0) {
    return bodyNum;
  }

  return DEFAULT_RATE_LIMIT_COOLDOWN_S;
}

export function useReportFinalize({ reportId }: UseReportFinalizeParams): UseReportFinalizeReturn {
  const { step5 } = useFormStore();
  const { currentReport } = useReportStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Guards against React StrictMode double-mount and rapid double-clicks:
  // the ref flips synchronously, so a second invocation of `handleFinalize`
  // within the same tick will short-circuit before a duplicate request is fired.
  const inFlightRef = useRef(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownReason, setCooldownReason] = useState<CooldownReason>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  // Tick clock once per second while a cooldown is active, so consumers can
  // render an accurate countdown without polling Date.now() themselves.
  // The interval callback is also responsible for clearing cooldown state
  // once it expires — doing this inside the timer (an event-handler-like
  // context) avoids the cascading renders that synchronous setState in an
  // effect body would cause.
  useEffect(() => {
    if (cooldownUntil === null) {
      return;
    }

    const intervalId = setInterval(() => {
      const current = Date.now();
      if (current >= cooldownUntil) {
        setCooldownUntil(null);
        setCooldownReason(null);
      }
      setNow(current);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [cooldownUntil]);

  const cooldownSecondsLeft =
    cooldownUntil !== null ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000)) : 0;

  // Clean up the pending redirect timer if the component unmounts before
  // the success cooldown elapses.
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, []);

  const handleFinalize = async (): Promise<void> => {
    if (!reportId) return;
    if (inFlightRef.current) return;
    if (cooldownUntil !== null) return;

    inFlightRef.current = true;
    setIsGenerating(true);
    setCooldownReason('in-flight');
    setGenerateError(null);
    setGenerateSuccess(false);

    try {
      if (step5) {
        await reportService.updateStep5(reportId, step5);
      }

      const result = await documentService.finalizeAndGenerate(reportId);
      const filename =
        result.filename || `zaklyuchenie_${currentReport?.report_number || reportId}.docx`;
      await documentService.downloadDocument(result.download_url, filename);

      setGenerateSuccess(true);
      void queryClient.invalidateQueries({
        queryKey: reportQueryKeys.lists(),
      });

      setCooldownReason('success');
      setCooldownUntil(Date.now() + SUCCESS_COOLDOWN_MS);

      if (redirectTimerRef.current !== null) {
        clearTimeout(redirectTimerRef.current);
      }
      redirectTimerRef.current = setTimeout(() => {
        redirectTimerRef.current = null;
        navigate('/', { state: { justGenerated: true } });
      }, SUCCESS_COOLDOWN_MS);
    } catch (err) {
      const axiosErr = err as AxiosError<RateLimit429Body>;
      if (axiosErr?.response?.status === 429) {
        const seconds = pickRetryAfterSeconds(
          axiosErr.response.headers?.['retry-after'],
          axiosErr.response.data?.retry_after_seconds,
        );
        setCooldownReason('rate-limit');
        setCooldownUntil(Date.now() + seconds * 1000);
        setGenerateError(`Слишком частые запросы. Попробуйте через ${seconds} с`);
      } else {
        setGenerateError((err as Error).message || 'Ошибка генерации документа');
      }
    } finally {
      inFlightRef.current = false;
      setIsGenerating(false);
    }
  };

  return {
    isGenerating,
    generateError,
    generateSuccess,
    cooldownReason,
    cooldownSecondsLeft,
    handleFinalize,
  };
}
