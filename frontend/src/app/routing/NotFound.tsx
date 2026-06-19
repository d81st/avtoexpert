import { useNavigate } from 'react-router-dom';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';

function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md text-center">
        <div className="text-6xl mb-4">404</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Страница не найдена</h1>
        <p className="text-gray-600 mb-6">Проверьте адрес или вернитесь к списку заключений.</p>
        <Button variant="primary" onClick={() => navigate('/')} fullWidth>
          На главную
        </Button>
      </Card>
    </div>
  );
}

export default NotFound;
