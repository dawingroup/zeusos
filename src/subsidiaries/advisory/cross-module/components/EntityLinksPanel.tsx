import React, { useState } from 'react';
import {
  Link2,
  Plus,
  X,
  Search,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Building2,
  TrendingUp,
  Briefcase,
  Package
} from 'lucide-react';
import { EntityLinkCard } from './EntityLinkCard';
import { useEntityLinks, useLinkSuggestions } from '../hooks/useEntityLinks';
import {
  EntityReference,
  EntityLink,
  ModuleType,
  LinkStrength,
  CreateLinkInput
} from '../types/cross-module';

interface EntityLinksPanelProps {
  entity: EntityReference;
  userId: string;
  onEntityClick?: (entity: EntityReference) => void;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

const MODULE_ICONS: Record<ModuleType, React.ReactNode> = {
  infrastructure: <Building2 className="w-4 h-4" />,
  investment: <TrendingUp className="w-4 h-4" />,
  advisory: <Briefcase className="w-4 h-4" />,
  matflow: <Package className="w-4 h-4" />
};

const LINK_TYPES = [
  { value: 'belongs_to', label: 'Belongs to' },
  { value: 'funded_by', label: 'Funded by' },
  { value: 'funds', label: 'Funds' },
  { value: 'related_to', label: 'Related to' },
  { value: 'includes', label: 'Includes' },
  { value: 'part_of', label: 'Part of' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'delivered_to', label: 'Delivered to' }
];

export const EntityLinksPanel: React.FC<EntityLinksPanelProps> = ({
  entity,
  userId,
  onEntityClick,
  collapsible = false,
  defaultExpanded = true
}) => {
  const { links, loading, createEntityLink, removeLink } = useEntityLinks(
    entity.id,
    entity.type
  );
  const { suggestions } = useLinkSuggestions(entity);

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showAddLink, setShowAddLink] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [newLink, setNewLink] = useState<Partial<CreateLinkInput>>({
    linkType: 'related_to',
    strength: 'medium',
    bidirectional: true
  });
  const [searchQuery, setSearchQuery] = useState('');

  const handleCreateLink = async () => {
    if (!newLink.targetEntity) return;

    await createEntityLink(
      {
        sourceEntity: entity,
        targetEntity: newLink.targetEntity,
        linkType: newLink.linkType || 'related_to',
        strength: newLink.strength as LinkStrength,
        bidirectional: newLink.bidirectional
      },
      userId
    );

    setShowAddLink(false);
    setNewLink({ linkType: 'related_to', strength: 'medium', bidirectional: true });
  };

  const handleAcceptSuggestion = async (suggestion: typeof suggestions[0]) => {
    await createEntityLink(
      {
        sourceEntity: entity,
        targetEntity: suggestion.targetEntity,
        linkType: suggestion.suggestedLinkType,
        strength: 'medium',
        bidirectional: true
      },
      userId
    );
  };

  const handleLinkClick = (link: EntityLink) => {
    onEntityClick?.(link.targetEntity);
  };

  const groupedLinks = links.reduce((acc, link) => {
    const module = link.targetEntity.module;
    if (!acc[module]) acc[module] = [];
    acc[module].push(link);
    return acc;
  }, {} as Record<ModuleType, EntityLink[]>);

  const content = (
    <>
      {/* Action Buttons */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setShowAddLink(!showAddLink)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Link
        </button>
        {suggestions.length > 0 && (
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg text-sm font-medium hover:bg-yellow-100 transition-colors"
          >
            <Lightbulb className="w-4 h-4" />
            {suggestions.length} Suggestions
          </button>
        )}
      </div>

      {/* Add Link Form */}
      {showAddLink && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">Create New Link</h4>
            <button
              onClick={() => setShowAddLink(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search Target Entity
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search for entity to link..."
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link Type
                </label>
                <select
                  value={newLink.linkType}
                  onChange={e => setNewLink({ ...newLink, linkType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {LINK_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Strength
                </label>
                <select
                  value={newLink.strength}
                  onChange={e => setNewLink({ ...newLink, strength: e.target.value as LinkStrength })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="strong">Strong</option>
                  <option value="medium">Medium</option>
                  <option value="weak">Weak</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newLink.bidirectional}
                onChange={e => setNewLink({ ...newLink, bidirectional: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">Bidirectional link</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddLink(false)}
                className="px-3 py-1.5 text-gray-600 hover:text-gray-800 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateLink}
                disabled={!newLink.targetEntity}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <h4 className="font-medium text-yellow-800 mb-3 flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            Suggested Links
          </h4>
          <div className="space-y-2">
            {suggestions.map((suggestion, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-white rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    {MODULE_ICONS[suggestion.targetEntity.module]}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {suggestion.targetEntity.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {suggestion.reason}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {Math.round(suggestion.confidence * 100)}% match
                  </span>
                  <button
                    onClick={() => handleAcceptSuggestion(suggestion)}
                    className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded text-sm hover:bg-yellow-200"
                  >
                    Accept
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Links */}
      {loading ? (
        <div className="py-8 text-center">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
        </div>
      ) : links.length > 0 ? (
        <div className="space-y-4">
          {(Object.entries(groupedLinks) as [ModuleType, EntityLink[]][]).map(
            ([module, moduleLinks]) => (
              <div key={module}>
                <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2 capitalize">
                  {MODULE_ICONS[module]}
                  {module} ({moduleLinks.length})
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {moduleLinks.map(link => (
                    <EntityLinkCard
                      key={link.id}
                      link={link}
                      onRemove={removeLink}
                      onClick={handleLinkClick}
                    />
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      ) : (
        <div className="py-8 text-center">
          <Link2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No links yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Create links to connect this entity with others
          </p>
        </div>
      )}
    </>
  );

  if (collapsible) {
    return (
      <div className="bg-white rounded-xl border">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-gray-500" />
            <span className="font-medium text-gray-900">Entity Links</span>
            {links.length > 0 && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                {links.length}
              </span>
            )}
          </div>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
        {expanded && <div className="px-4 pb-4">{content}</div>}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center gap-2 mb-4">
        <Link2 className="w-5 h-5 text-gray-500" />
        <h3 className="font-medium text-gray-900">Entity Links</h3>
        {links.length > 0 && (
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
            {links.length}
          </span>
        )}
      </div>
      {content}
    </div>
  );
};

export default EntityLinksPanel;
