interface FieldLabelProps {
  ru: string;
  uz: string;
  required?: boolean;
  htmlFor?: string;
}

function FieldLabel({ ru, uz, required, htmlFor }: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-2">
      {ru} / {uz}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

export default FieldLabel;
