// Spinneren som brukes når en side laster og vi henter fra backend, feks bruker profilen på profilsiden og instillinger på profilesettings
// components/Spinner.tsx
export default function Spinner({
  size = 40,
  borderSize = 4,
  text,
}: {
  size?: number
  borderSize?: number
  text?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center">
      <div
        style={{
          width: size,
          height: size,
          borderTopWidth: borderSize,
        }}
        className="animate-spin rounded-full border-green-600"
      />
      {text && <p className="mt-2 text-gray-500">{text}</p>}
    </div>
  );
}
