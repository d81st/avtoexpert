import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import type { AdminTab } from "@/types/admin";
import AdminReportsTab from "@/components/admin/AdminReportsTab";
import AdminCreatorsTab from "@/components/admin/AdminCreatorsTab";
import AdminTemplateTab from "@/components/admin/AdminTemplateTab";
import Loader from "@/components/Loader";
import Button from "@/components/Button";

function AdminPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const isAdmin = user?.role === "admin";
  const [activeTab, setActiveTab] = useState<AdminTab>("reports");

  const handleLogout = () => {
    useAuthStore.getState().logout();
    navigate("/login");
  };

  if (!isAdmin) {
    return <Loader message="Проверка прав доступа..." />;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="brand-title text-2xl font-bold text-slate-900">
              AvtoExpert Pro — Админ
            </h1>
            <p className="page-subtitle mt-1 text-sm">Панель управления</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-700 font-medium">{user?.full_name}</span>
            <Button onClick={() => navigate("/")} variant="secondary" size="sm">
              ← К заключениям
            </Button>
            <Button onClick={handleLogout} variant="danger" size="sm">
              Выйти
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
      </main>
    </div>
  );
}

export default AdminPage;
