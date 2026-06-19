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

  return (
    <>
      {error && (
        <Alert
          type="error"
          message={error}
          onClose={() => void templateQuery.refetch()}
        />
      )}

      {templateQuery.isLoading ? (
        <Loader message="Р—Р°РіСЂСѓР·РєР°..." />
      ) : (
        <Card>
          <h3 className="text-lg font-semibold mb-4">РЁР°Р±Р»РѕРЅ Р·Р°РєР»СЋС‡РµРЅРёСЏ</h3>
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
                Р”Р»СЏ РѕР±РЅРѕРІР»РµРЅРёСЏ С€Р°Р±Р»РѕРЅР° РѕР±СЂР°С‚РёС‚РµСЃСЊ Рє Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂСѓ СЃРµСЂРІРµСЂР°.
                Р—Р°РіСЂСѓР·РёС‚Рµ РЅРѕРІС‹Р№ С„Р°Р№Р» expertise.docx РІ РїР°РїРєСѓ templates РЅР° СЃРµСЂРІРµСЂРµ.
              </p>
            </div>
          ) : (
            <Alert
              type="error"
              message="РЁР°Р±Р»РѕРЅ РЅРµ РЅР°Р№РґРµРЅ. РћР±СЂР°С‚РёС‚РµСЃСЊ Рє Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂСѓ."
            />
          )}
        </Card>
      )}
    </>
  );
}
