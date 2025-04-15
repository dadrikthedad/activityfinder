// Modal som popper ved vellykket signup
export default function SuccessModal({ onClose }: { onClose: () => void }) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl text-center shadow-lg">
          <h2 className="text-2xl font-bold mb-4 text-green-600">Success!</h2>
          <p className="text-gray-800 dark:text-gray-200 mb-4">
            You have signed up successfully! Redirecting you to login...
          </p>
          <button
            onClick={onClose}
            className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    );
  }
  