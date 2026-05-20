/**
 * Challenges Section Component
 * Captures pain points, goals, and constraints
 */

import { useState } from 'react';
import { Plus, X, Target, Flag, AlertTriangle } from 'lucide-react';

interface ChallengesSectionProps {
  challenges: {
    painPoints: string[];
    goals: string[];
    constraints: string[];
  };
  onUpdate: (challenges: { painPoints: string[]; goals: string[]; constraints: string[] }) => void;
}

export function ChallengesSection({ challenges, onUpdate }: ChallengesSectionProps) {
  // Safety check: provide default empty arrays if undefined
  const safeChallenges = challenges || { painPoints: [], goals: [], constraints: [] };

  const [newPainPoint, setNewPainPoint] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [newConstraint, setNewConstraint] = useState('');

  const addPainPoint = () => {
    if (!newPainPoint.trim()) return;
    onUpdate({ ...safeChallenges, painPoints: [...safeChallenges.painPoints, newPainPoint.trim()] });
    setNewPainPoint('');
  };

  const removePainPoint = (index: number) => {
    onUpdate({ ...challenges, painPoints: safeChallenges.painPoints.filter((_, i) => i !== index) });
  };

  const addGoal = () => {
    if (!newGoal.trim()) return;
    onUpdate({ ...challenges, goals: [...safeChallenges.goals, newGoal.trim()] });
    setNewGoal('');
  };

  const removeGoal = (index: number) => {
    onUpdate({ ...challenges, goals: safeChallenges.goals.filter((_, i) => i !== index) });
  };

  const addConstraint = () => {
    if (!newConstraint.trim()) return;
    onUpdate({ ...challenges, constraints: [...safeChallenges.constraints, newConstraint.trim()] });
    setNewConstraint('');
  };

  const removeConstraint = (index: number) => {
    onUpdate({ ...challenges, constraints: safeChallenges.constraints.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      {/* Pain Points */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <label className="text-sm font-medium text-gray-700">Pain Points</label>
        </div>
        <div className="space-y-2 mb-2">
          {safeChallenges.painPoints.map((point, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-red-50 rounded-lg group">
              <span className="flex-1 text-sm text-red-800">{point}</span>
              <button
                onClick={() => removePainPoint(index)}
                className="p-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newPainPoint}
            onChange={(e) => setNewPainPoint(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPainPoint()}
            placeholder="Add a pain point..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
          <button
            onClick={addPainPoint}
            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Goals */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Flag className="w-4 h-4 text-green-500" />
          <label className="text-sm font-medium text-gray-700">Goals</label>
        </div>
        <div className="space-y-2 mb-2">
          {safeChallenges.goals.map((goal, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-green-50 rounded-lg group">
              <span className="flex-1 text-sm text-green-800">{goal}</span>
              <button
                onClick={() => removeGoal(index)}
                className="p-1 text-green-400 hover:text-green-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addGoal()}
            placeholder="Add a goal..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <button
            onClick={addGoal}
            className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Constraints */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-amber-500" />
          <label className="text-sm font-medium text-gray-700">Constraints</label>
        </div>
        <div className="space-y-2 mb-2">
          {safeChallenges.constraints.map((constraint, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg group">
              <span className="flex-1 text-sm text-amber-800">{constraint}</span>
              <button
                onClick={() => removeConstraint(index)}
                className="p-1 text-amber-400 hover:text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newConstraint}
            onChange={(e) => setNewConstraint(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addConstraint()}
            placeholder="Add a constraint..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
          <button
            onClick={addConstraint}
            className="p-2 bg-amber-100 text-amber-600 rounded-lg hover:bg-amber-200"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
