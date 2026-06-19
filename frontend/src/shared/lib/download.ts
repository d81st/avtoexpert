import { useAuthStore } from "@/store/useAuthStore";

export async function downloadBlob(
  downloadUrl: string,
  filename: string,
): Promise<void> {
  const token = useAuthStore.getState().token;

  const response = await fetch(downloadUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error("Не удалось скачать документ");
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = filename.endsWith(".docx") ? filename : `${filename}.docx`;

  document.body.appendChild(link);
  link.click();
  window.URL.revokeObjectURL(objectUrl);
  document.body.removeChild(link);
}
