// components/notifications/GroupEventTooltip.tsx
interface GroupEventTooltipProps {
  eventSummaries: string[];
  groupName: string;
  eventCount: number;
  isVisible: boolean;
}

export default function GroupEventTooltip({
  eventSummaries,
  groupName,
  isVisible,
}: GroupEventTooltipProps) {
  if (!isVisible) return null;

  const handleTooltipClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Stopp event fra å nå notifikasjonen
    // Gjør ingenting - bare stopp klikket
  };

   return (
    <div className="absolute z-50 bg-[#2e2e2e] dark:bg-gray-[#2e2e2e] border border-[#1C6B1C] dark:border-[#1C6B1C] rounded-lg shadow-lg p-3 min-w-[250px] max-w-[400px]"
          onClick={handleTooltipClick}
    >
      <h4 className="font-semibold text-sm mb-2 text-gray-800 dark:text-gray-200">
        Recent Activities in {groupName}
      </h4>
      
      {eventSummaries.length === 0 ? (
        <p className="text-xs text-gray-500">No recent activities</p>
      ) : (
        <>
          <ul className="space-y-2 max-h-[200px] overflow-y-auto">
            {eventSummaries.map((summary, index) => (
              <li key={index} className="flex items-start space-x-2 py-1">
                <div className="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-1.5"></div>
                <p className="text-xs text-gray-800 dark:text-gray-200 leading-relaxed">
                  {summary}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}