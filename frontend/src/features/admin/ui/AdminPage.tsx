import { Loader2 } from 'lucide-react';
import AppLayout from '@/app/routing/AppLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdmin } from '../hooks/useAdmin';
import type { AdminTab } from '../types';
import AdminCreatorsTab from './AdminCreatorsTab';
import AdminReportsTab from './AdminReportsTab';
import AdminTemplateTab from './AdminTemplateTab';

function AdminPage() {
  const { isAdmin, setActiveTab, handleGoToDashboard } = useAdmin();

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="mt-4 text-gray-600">Проверка прав доступа...</p>
      </div>
    );
  }

  return (
    <AppLayout
      title="AvtoExpert Pro — Админ"
      subtitle="Панель управления"
      headerActions={
        <Button onClick={handleGoToDashboard} variant="outline" size="sm">
          ← К заключениям
        </Button>
      }
    >
      <Tabs defaultValue="reports" onValueChange={(value) => setActiveTab(value as AdminTab)}>
        <TabsList>
          <TabsTrigger value="reports">Все заключения</TabsTrigger>
          <TabsTrigger value="creators">Создатели</TabsTrigger>
          <TabsTrigger value="template">Шаблон DOCX</TabsTrigger>
        </TabsList>
        <TabsContent value="reports">
          <AdminReportsTab />
        </TabsContent>
        <TabsContent value="creators">
          <AdminCreatorsTab />
        </TabsContent>
        <TabsContent value="template">
          <AdminTemplateTab />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

export default AdminPage;
