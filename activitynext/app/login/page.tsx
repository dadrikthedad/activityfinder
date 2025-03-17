export default function LoginPage() {
    return (
      <div className="max-w-md mx-auto mt-16 p-6 bg-white dark:bg-gray-800 shadow-md rounded-lg">
        <h1 className="text-2xl font-bold text-blue-600 text-center">Logg inn</h1>
        <p className="text-gray-700 dark:text-gray-300 text-center mt-2">
          Logg inn på kontoen din for å fortsette.
        </p>
  
        {/* Enkel login-form */}
        <form className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              E-post
            </label>
            <input
              type="email"
              className="w-full mt-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Din e-post"
              required
            />
          </div>
  
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Passord
            </label>
            <input
              type="password"
              className="w-full mt-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Ditt passord"
              required
            />
          </div>
  
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-md font-semibold hover:bg-blue-700 transition"
          >
            Logg inn
          </button>
        </form>
  
        <p className="text-sm text-center text-gray-600 dark:text-gray-400 mt-4">
          Har du ikke en konto?{" "}
          <a href="/signup" className="text-blue-500 hover:underline">
            Registrer deg her
          </a>
        </p>
      </div>
    );
  }
  