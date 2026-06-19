import { useAdmin } from "../hooks/useAdmin";
import AdminReportsTab from "./AdminReportsTab";
import AdminCreatorsTab from "./AdminCreatorsTab";
import AdminTemplateTab from "./AdminTemplateTab";
import Loader from "@/shared/ui/Loader";
import Button from "@/shared/ui/Button";
import AppLayout from "@/shared/ui/AppLayout";

function AdminPage() {
  const {
    isAdmin,
    activeTab,
    setActiveTab,
    handleGoToDashboard,
  } = useAdmin();

  if (!isAdmin) {
    return <Loader message="Проверка прав доступа..." />;
  }

  return (
    <AppLayout
      title="AvtoExpert Pro — Админ"
      subtitle="Панель управления"
      headerActions={
        <Button onClick={handleGoToDashboard} variant="secondary" size="sm">
          ← К заключениям
        </Button>
      }
    >
        <div className="surface-card mb-6 flex rounded-2xl p-2">
          <button
            onClick={() => setActiveTab("reports")}
            className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
              activeTab === "reports"
                ? "bg-blue-50 text-blue-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Все заключения
          </button>
          <button
            onClick={() => setActiveTab("creators")}
            className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
              activeTab === "creators"
                ? "bg-blue-50 text-blue-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Создатели
          </button>
          <button
            onClick={() => setActiveTab("template")}
            className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
              activeTab === "template"
                ? "bg-blue-50 text-blue-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Шаблон DOCX
          </button>
        </div>

        {activeTab === "reports" && <AdminReportsTab />}
        {activeTab === "creators" && <AdminCreatorsTab />}
        {activeTab === "template" && <AdminTemplateTab />}
    </AppLayout>
  );
}

export default AdminPage;
