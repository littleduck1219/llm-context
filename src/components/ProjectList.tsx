'use client';

import { useState } from 'react';
import { Project } from '@/types';
import { FolderOpen, Plus, Calendar, MessageSquare } from 'lucide-react';

interface ProjectListProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  onCreateProject: (name: string, path: string, description?: string) => void;
}

export default function ProjectList({
  projects,
  onSelectProject,
  onCreateProject
}: ProjectListProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    if (name && path) {
      onCreateProject(name, path, description);
      setName('');
      setPath('');
      setDescription('');
      setShowForm(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          프로젝트
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          새 프로젝트
        </button>
      </div>

      {/* 새 프로젝트 폼 */}
      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-medium mb-4">새 프로젝트 생성</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                프로젝트 이름
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-slate-700"
                placeholder="예: My Awesome Project"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                프로젝트 경로
              </label>
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-slate-700"
                placeholder="예: /home/user/projects/my-project"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                설명 (선택)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-slate-700"
                rows={3}
                placeholder="프로젝트에 대한 간단한 설명"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
              >
                생성
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 rounded-lg"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 프로젝트 카드 목록 */}
      {projects.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">아직 프로젝트가 없습니다.</p>
          <p className="text-slate-400 text-sm mt-1">새 프로젝트를 생성해보세요!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => onSelectProject(project)}
              className="bg-white dark:bg-slate-800 rounded-lg shadow hover:shadow-md transition p-6 text-left"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
                  <FolderOpen className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                    {project.name}
                  </h3>
                  <p className="text-sm text-slate-500 truncate">{project.path}</p>
                  {project.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(project.updatedAt).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-1">
                  <MessageSquare className="w-4 h-4" />
                  {project.sessions?.length || 0} 세션
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
