/**
 * Pipeline Filters - Filter panel for kanban/list views
 */

import { X } from 'lucide-react';

interface PipelineFiltersProps {
  onFilterChange: (filters: Record<string, string>) => void;
  onClose: () => void;
}

export function PipelineFilters({ onFilterChange, onClose }: PipelineFiltersProps) {
  return (
    <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-sm">Filters</h4>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex flex-wrap gap-4">
        {/* Sector Filter */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Sector</label>
          <select 
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
            onChange={(e) => onFilterChange({ sector: e.target.value })}
          >
            <option value="">All Sectors</option>
            <option value="healthcare">Healthcare</option>
            <option value="energy">Energy</option>
            <option value="transport">Transport</option>
            <option value="water">Water</option>
            <option value="digital">Digital</option>
          </select>
        </div>
        
        {/* Country Filter */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Country</label>
          <select 
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
            onChange={(e) => onFilterChange({ country: e.target.value })}
          >
            <option value="">All Countries</option>
            <option value="UG">Uganda</option>
            <option value="KE">Kenya</option>
            <option value="TZ">Tanzania</option>
            <option value="RW">Rwanda</option>
            <option value="ET">Ethiopia</option>
          </select>
        </div>
        
        {/* Priority Filter */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Priority</label>
          <select 
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
            onChange={(e) => onFilterChange({ priority: e.target.value })}
          >
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        
        {/* Deal Size Filter */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Deal Size</label>
          <select 
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
            onChange={(e) => onFilterChange({ dealSize: e.target.value })}
          >
            <option value="">Any Size</option>
            <option value="0-5">$0 - $5M</option>
            <option value="5-10">$5M - $10M</option>
            <option value="10-25">$10M - $25M</option>
            <option value="25+">$25M+</option>
          </select>
        </div>
        
        {/* Team Member Filter */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Team Member</label>
          <select 
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
            onChange={(e) => onFilterChange({ teamMember: e.target.value })}
          >
            <option value="">All Team</option>
            <option value="me">My Deals</option>
          </select>
        </div>
        
        {/* Clear Filters */}
        <div className="flex items-end">
          <button
            onClick={() => onFilterChange({})}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
}

export default PipelineFilters;
