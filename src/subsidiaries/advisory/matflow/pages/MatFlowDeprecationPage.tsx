/**
 * MatFlow Deprecation Notice
 * Informs users that MatFlow has been integrated into Infrastructure Delivery
 */

import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Package, CheckCircle } from 'lucide-react';

export function MatFlowDeprecationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    // Auto-redirect after 10 seconds
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Redirect to Delivery, preserving any project ID if present
          const projectIdMatch = location.pathname.match(/\/projects\/([^/]+)/);
          if (projectIdMatch) {
            navigate(`/advisory/delivery/projects/${projectIdMatch[1]}`);
          } else {
            navigate('/advisory/delivery');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate, location.pathname]);

  const handleRedirectNow = () => {
    const projectIdMatch = location.pathname.match(/\/projects\/([^/]+)/);
    if (projectIdMatch) {
      navigate(`/advisory/delivery/projects/${projectIdMatch[1]}`);
    } else {
      navigate('/advisory/delivery');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 md:p-12">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
            <Package className="w-10 h-10 text-blue-600" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-4">
          MatFlow Has Moved!
        </h1>

        {/* Message */}
        <p className="text-lg text-gray-700 text-center mb-8">
          MatFlow has been fully integrated into <strong>Infrastructure Delivery</strong>. All your projects, BOQs, materials, and formulas are now available in one unified platform.
        </p>

        {/* Features List */}
        <div className="bg-blue-50 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">What's New:</h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700">
                <strong>Unified Projects:</strong> All MatFlow projects now in the core advisory_projects collection
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700">
                <strong>Enhanced BOQ Workflow:</strong> Sophisticated 4-level hierarchy parsing integrated as Control BOQ generation
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700">
                <strong>Shared Resources:</strong> Material Library and Formula Database accessible across all projects
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700">
                <strong>Complete Integration:</strong> Procurement, EFRIS tax compliance, and variance analysis all available
              </span>
            </li>
          </ul>
        </div>

        {/* Redirect Info */}
        <div className="text-center mb-6">
          <p className="text-gray-600 mb-2">
            You will be automatically redirected in <strong className="text-blue-600 text-xl">{countdown}</strong> seconds
          </p>
          <button
            onClick={handleRedirectNow}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Go to Infrastructure Delivery Now
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Help Text */}
        <div className="border-t pt-6 mt-6">
          <p className="text-sm text-gray-500 text-center">
            Need help? Visit the{' '}
            <a href="/advisory/delivery" className="text-blue-600 hover:underline">
              Infrastructure Delivery module
            </a>{' '}
            to access all your projects and data.
          </p>
        </div>
      </div>
    </div>
  );
}

export default MatFlowDeprecationPage;
