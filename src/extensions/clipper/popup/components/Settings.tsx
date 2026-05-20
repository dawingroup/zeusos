import { ArrowLeft } from 'lucide-react';

interface SettingsProps {
  onBack: () => void;
}

export default function Settings({ onBack }: SettingsProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-sm font-semibold text-gray-900">Settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Image Detection */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
            Image Detection
          </h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Auto-detect images</span>
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
            </label>
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Minimum image size
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="100">100px</option>
                <option value="200" selected>200px</option>
                <option value="300">300px</option>
              </select>
            </div>
          </div>
        </section>

        {/* AI Analysis */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
            AI Analysis
          </h3>
          <label className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Auto-analyze clips</span>
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
          </label>
        </section>

        {/* Sync */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
            Sync
          </h3>
          <label className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Sync on WiFi only</span>
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
          </label>
        </section>

        {/* About */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
            About
          </h3>
          <p className="text-sm text-gray-600">
            Dawin Design Clipper v1.0.0
          </p>
          <p className="text-xs text-gray-400 mt-1">
            © 2024 Dawin Group
          </p>
        </section>
      </div>
    </div>
  );
}
