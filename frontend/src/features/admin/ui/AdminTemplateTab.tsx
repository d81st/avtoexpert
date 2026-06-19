import { useAdminTemplateQuery } from "../model/adminQueries";
import Loader from "@/shared/ui/Loader";
import Alert from "@/shared/ui/Alert";
import Card from "@/shared/ui/Card";
import { formatDate } from "@/shared/lib/formatters";

export default function AdminTemplateTab() {
  const templateQuery = useAdminTemplateQuery();
  const templateInfo = templateQuery.data;
  const error =
    templateQuery.error instanceof Error ? templateQuery.error.message : null;

  if (templateQuery.isLoading) {
    return <Loader message="Загрузка..." />;
  }

  if (error) {
    return (
      <Alert
        type="error"
        message={error}
        onClose={() => void templateQuery.refetch()}
      />
    );
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-4">Шаблон заключения</h3>
      {templateInfo?.exists ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">DOCX</span>
            <div>
              <p className="font-medium">{templateInfo.name}</p>
              <p className="text-sm text-gray-500">
                Size: {(templateInfo.size / 1024).toFixed(1)} KB
              </p>
              <p className="text-sm text-gray-500">
                Updated: {formatDate(templateInfo.lastModified)}
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
  );
}
