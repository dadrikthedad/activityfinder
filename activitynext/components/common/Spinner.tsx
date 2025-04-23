// Spinneren som brukes når en side laster og vi henter fra backend, feks bruker profilen på profilsiden og instillinger på profilesettings
export default function Spinner({ text = "Loading..." }: { text?: string }) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-green-600"></div>
        <p className="mt-4 text-gray-500">{text}</p>
      </div>
    );
  }
  