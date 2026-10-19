import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, Tag, Layers } from 'lucide-react';
import { SubjectNode } from '../../lib/types';
import { formatNumber } from '../../lib/utils';

interface SubjectHierarchyProps {
  root: SubjectNode | null | undefined;
}

interface TreeNodeProps {
  node: SubjectNode;
  level: number;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, level }) => {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="select-none text-xs">
      <div
        onClick={() => hasChildren && setIsOpen(!isOpen)}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        className={`py-1.5 pr-3 rounded flex items-center justify-between group transition-colors ${
          hasChildren ? 'cursor-pointer hover:bg-slate-800/60' : 'hover:bg-slate-800/30'
        }`}
      >
        <div className="flex items-center gap-2">
          {hasChildren ? (
            isOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )
          ) : (
            <span className="w-3.5 h-3.5" />
          )}

          {hasChildren ? (
            <Folder className="w-3.5 h-3.5 text-teal-400" />
          ) : (
            <Tag className="w-3.5 h-3.5 text-indigo-400" />
          )}

          <span className={`font-mono ${hasChildren ? 'font-semibold text-slate-200' : 'text-slate-300'}`}>
            {node.name}
          </span>

          {node.fullPath && (
            <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
              ({node.fullPath})
            </span>
          )}
        </div>

        {node.messageCount > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-teal-500/10 text-teal-300 border border-teal-500/20">
            {formatNumber(node.messageCount)} msgs
          </span>
        )}
      </div>

      {hasChildren && isOpen && (
        <div className="border-l border-slate-800/80 ml-4">
          {node.children.map((child, idx) => (
            <TreeNode key={`${child.fullPath}-${idx}`} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const SubjectHierarchy: React.FC<SubjectHierarchyProps> = ({ root }) => {
  if (!root || !root.children || root.children.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 border border-slate-800/80 rounded-xl bg-slate-900/30">
        <Layers className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-xs">No active subject hierarchy data recorded for this stream.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-teal-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Subject Hierarchy Tree
          </h4>
        </div>
        <span className="text-[11px] text-slate-400">Click folders to expand / collapse</span>
      </div>

      <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
        {root.children.map((child, idx) => (
          <TreeNode key={`${child.fullPath}-${idx}`} node={child} level={0} />
        ))}
      </div>
    </div>
  );
};
