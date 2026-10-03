import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getRuntimeConfig } from "@/config/runtime-config";

const FUNCTIONS_URL = `${getRuntimeConfig().supabaseUrl}/functions/v1`;

const AuthCallbackMetaAdsPage = () => {
  const location = useLocation();

  useEffect(() => {
    window.location.href =
      `${FUNCTIONS_URL}/meta-ads-oauth-callback${location.search}`;
  }, [location]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Conectando o Meta Ads...
        </h1>
        <p className="text-gray-700 dark:text-gray-300">
          Processando autenticação...
        </p>
      </div>
    </div>
  );
};

export default AuthCallbackMetaAdsPage;
