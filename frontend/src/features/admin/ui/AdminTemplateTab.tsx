import { useEffect, useState } from "react";
import { adminService } from "@/features/admin/api/adminApi";
import Loader from "@/shared/ui/Loader";
import Alert from "@/shared/ui/Alert";
import Card from "@/shared/ui/Card";
import { formatDate } from "@/shared/lib/formatters";

export default function AdminTemplateTab() {
  const [templateInfo, setTemplateInfo] = useState<{
    exists: boolean;
    name: string;
    size: number;
    lastModified: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplateInfo = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminService.getTemplateInfo();
      setTemplateInfo(data);
    } catch (err) {
      setError((err as Error).message || "Ошибка загрузки");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplateInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {isLoading ? (
        <Loader message="Загрузка..." />
      ) : (
        <Card>
          <h3 className="text-lg font-semibold mb-4">Шаблон заключения</h3>
          {templateInfo?.exists ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">📄</span>
                <div>
                  <p className="font-medium">{templateInfo.name}</p>
                  <p className="text-sm text-gray-500">
                    Размер: {(templateInfo.size / 1024).toFixed(1)} KB
                  </p>
                  <p className="text-sm text-gray-500">
                    Обновлён: {formatDate(templateInfo.lastModified)}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-4">
                Для обновления шаблона обратитесь к администратору сервера.
                Загрузите новый файл expertise.docx в папку templates на сервере.
              </p>
            </div>
          ) : (
            <Alert
              type="error"
              message="Шаблон не найден. Обратитесь к администратору."
            />
          )}
        </Card>
      )}
    </>
  );
}
