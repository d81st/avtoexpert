import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { reportService } from "../services/reportService";
import Loader from "../components/Loader";
import Button from "../components/Button";
import Alert from "../components/Alert";
import Card from "../components/Card";

interface AdminReport {
  id: string;
  reportNumber: string | null;
  reportDate: string | null;
  status: string;
  currentStep: number;
  grandTotal: number | null;
  licensePlate: string | null;
  ownerName: string | null;
  creatorId: string;
  updatedAt: string | null;
  creator?: { id: string; fullName: string };
}

interface Creator {
  id: string;
  full_name: string;
  role: string;
  created_at: string;
}

type Tab = "reports" | "creators" | "template";

function AdminPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  // Проверка роли
  const isAdmin = user?.role === "admin";
  const [activeTab, setActiveTab] = useState<Tab>("reports");

  // Reports state
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null>(null);

  // Creators state
  const [creators, setCreators] = useState<Creator[]>([]);

  // Template state
  const [templateInfo, setTemplateInfo] = useState<{
    exists: boolean;
    name: string;
    size: number;
    lastModified: string;
  } | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
      return;
    }
    fetchReports();
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && activeTab === "reports") {
      fetchReports();
    } else if (activeTab === "creators") {
      fetchCreators();
    } else if (activeTab === "template") {
      fetchTemplateInfo();
    }
  }, [activeTab, currentPage]);

  const fetchReports = async (search?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await reportService.getAllReports({
        page: currentPage,
        search: search || searchQuery || undefined,
        limit: 20,
      });
      setReports(response.data as unknown as AdminReport[]);
      setPagination(response.pagination);
    } catch (err) {
      setError((err as Error).message || "Ошибка загрузки");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCreators = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await reportService.getAllCreators();
      setCreators(data);
    } catch (err) {
      setError((err as Error).message || "Ошибка загрузки");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTemplateInfo = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await reportService.getTemplateInfo();
      setTemplateInfo(data);
    } catch (err) {
      setError((err as Error).message || "Ошибка загрузки");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchReports(searchQuery);
  };

  const handleViewReport = (reportId: string) => {
    navigate(`/report/${reportId}`);
  };

  const handleLogout = () => {
    useAuthStore.getState().logout();
    localStorage.removeItem("token");
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
        {/* Tabs */}
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

        {error && (
          <Alert type="error" message={error} onClose={() => setError(null)} />
        )}

        {/* === Вкладка: Все заключения === */}
        {activeTab === "reports" && (
          <>
            {/* Поиск */}
            <form
              onSubmit={handleSearch}
              className="mb-6 flex flex-col gap-2 sm:flex-row"
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по номеру, госномеру, владельцу..."
                className="form-control flex-1 px-4 py-3"
              />
              <Button type="submit" variant="secondary">
                Найти
              </Button>
              {searchQuery && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                    fetchReports();
                  }}
                >
                  Сбросить
                </Button>
              )}
            </form>

            {isLoading ? (
              <Loader message="Загрузка заключений..." />
            ) : reports.length === 0 ? (
              <Card className="text-center">
                <p className="text-gray-500">Заключения не найдены</p>
              </Card>
            ) : (
              <>
                <div className="data-table-wrap">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          №
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Дата
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Статус
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Прогресс
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Госномер
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Владелец
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Сумма
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Действия
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {reports.map((report) => (
                        <tr key={report.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium">
                            {report.reportNumber || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {report.reportDate
                              ? new Date(report.reportDate).toLocaleDateString(
                                  "ru-RU",
                                )
                              : "-"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
                                report.status === "completed"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {report.status === "completed" ? "✓" : "◯"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {report.currentStep}/5
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {report.licensePlate || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {report.ownerName || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {report.grandTotal
                              ? `${report.grandTotal.toLocaleString("ru-RU")} сум`
                              : "-"}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleViewReport(report.id)}
                              className="text-blue-600 hover:text-blue-900 text-sm"
                            >
                              Открыть
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Пагинация */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="mt-4 flex justify-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                    >
                      ←
                    </Button>
                    <span className="px-4 py-2 text-sm text-gray-600">
                      {currentPage} из {pagination.totalPages}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={currentPage >= pagination.totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      →
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* === Вкладка: Создатели === */}
        {activeTab === "creators" && (
          <>
            {isLoading ? (
              <Loader message="Загрузка создателей..." />
            ) : (
              <div className="data-table-wrap">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Имя
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Роль
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Дата регистрации
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {creators.map((creator) => (
                      <tr key={creator.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">
                          {creator.full_name}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              creator.role === "admin"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {creator.role === "admin" ? "Админ" : "Создатель"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(creator.created_at).toLocaleDateString(
                            "ru-RU",
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* === Вкладка: Шаблон DOCX === */}
        {activeTab === "template" && (
          <>
            {isLoading ? (
              <Loader message="Загрузка..." />
            ) : (
              <Card>
                <h3 className="text-lg font-semibold mb-4">
                  Шаблон заключения
                </h3>
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
                          Обновлён:{" "}
                          {new Date(templateInfo.lastModified).toLocaleString(
                            "ru-RU",
                          )}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-4">
                      Для обновления шаблона обратитесь к администратору
                      сервера. Загрузите новый файл expertise.docx в папку
                      templates на сервере.
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
        )}
      </main>
    </div>
  );
}

export default AdminPage;
