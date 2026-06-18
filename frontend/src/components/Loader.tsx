interface LoaderProps {
  message?: string;
}

function Loader({ message = "Загрузка..." }: LoaderProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent p-4">
      <div className="surface-card rounded-3xl px-10 py-8 text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-b-blue-600"></div>
        <p className="text-sm font-medium text-slate-600">{message}</p>
      </div>
    </div>
  );
}

export default Loader;
