'use client';

import { useState } from 'react';
import { Project, Session } from '@/types';
import {
  FolderOpen,
  Plus,
  Settings,
  Database,
  ChevronDown,
  ChevronRight,
  Cloud,
  MessageSquare,
  Loader2
} from 'lucide-react';

interface SidebarProps {
  projects: Project[];
  selectedProject: Project | null;
  selectedSession?: Session | null;
  onSelectProject: (project: Project) => void;
  onCreateProject: (name: string, path: string, description?: string) => void;
  onCreateSession: (title: string) => void;
  onSelectSession?: (sessionId: string) => void;
}

export default function Sidebar({
  projects,
  selectedProject,
  selectedSession,
  onSelectProject,
  onCreateProject,
  onCreateSession,
  onSelectSession
}: SidebarProps) {
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectPath, setNewProjectPath] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [projectSessions, setProjectSessions] = useState<Record<string, Session[]>>({});
  const [loadingSessions, setLoadingSessions] = useState<Set<string>>(new Set());

  // 프로젝트 확장 시 세션 로드
  const loadSessions = async (projectId: string) => {
    if (projectSessions[projectId]) return; // 이미 로드됨

    setLoadingSessions(prev => new Set(prev).add(projectId));
    try {
      const res = await fetch(`/api/sessions?projectId=${encodeURIComponent(projectId)}`);
      const sessions = await res.json();
      setProjectSessions(prev => ({ ...prev, [projectId]: sessions }));
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoadingSessions(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });
    }
  };

  const handleCreateProject = () => {
    if (newProjectName && newProjectPath) {
      onCreateProject(newProjectName, newProjectPath);
      setNewProjectName('');
      setNewProjectPath('');
      setShowNewProject(false);
    }
  };

  const toggleProject = async (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
      // 세션 로드
      await loadSessions(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  return (
    <aside className="w-72 bg-slate-900 text-white flex flex-col">
      {/* 로고 */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Database className="w-8 h-8 text-primary-400" />
          <div>
            <h1 className="font-bold text-lg">Context Manager</h1>
            <p className="text-xs text-slate-400">Gist 기반 컨텍스트 관리</p>
          </div>
        </div>
      </div>

      {/* 프로젝트 목록 */}
      <div className="flex-1 overflow-auto">
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase">
              프로젝트 ({projects.length})
            </span>
            <button
              onClick={() => setShowNewProject(!showNewProject)}
              className="p-1 hover:bg-slate-700 rounded"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* 새 프로젝트 폼 */}
          {showNewProject && (
            <div className="bg-slate-800 rounded-lg p-3 mb-3">
              <input
                type="text"
                placeholder="프로젝트 이름"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="w-full bg-slate-700 rounded px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <input
                type="text"
                placeholder="프로젝트 경로"
                value={newProjectPath}
                onChange={(e) => setNewProjectPath(e.target.value)}
                className="w-full bg-slate-700 rounded px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <button
                onClick={handleCreateProject}
                className="w-full bg-primary-600 hover:bg-primary-700 rounded py-2 text-sm font-medium"
              >
                생성
              </button>
            </div>
          )}

          {/* 프로젝트 리스트 */}
          <div className="space-y-1">
            {projects.length === 0 ? (
              <div className="text-center py-4 text-slate-500 text-sm">
                <Cloud className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>아직 프로젝트가 없습니다</p>
                <p className="text-xs mt-1">CLI로 초기화하세요:</p>
                <code className="text-xs bg-slate-800 px-2 py-1 rounded mt-2 block">
                  llm-context init "." "프로젝트명"
                </code>
              </div>
            ) : (
              projects.map((project) => (
                <div key={project.id}>
                  <button
                    onClick={() => {
                      toggleProject(project.id);
                      onSelectProject(project);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left ${
                      selectedProject?.id === project.id
                        ? 'bg-primary-600 text-white'
                        : 'hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    {expandedProjects.has(project.id) ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <FolderOpen className="w-4 h-4" />
                    <span className="truncate flex-1">{project.name}</span>
                    {project.gistId && (
                      <span className="w-2 h-2 bg-green-500 rounded-full" title="Gist 동기화 됨" />
                    )}
                  </button>

                  {/* 세션 목록 (확장시) */}
                  {expandedProjects.has(project.id) && (
                    <div className="ml-6 mt-1 space-y-1">
                      {/* 로딩 중 */}
                      {loadingSessions.has(project.id) && (
                        <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          세션 로드 중...
                        </div>
                      )}

                      {/* 세션 목록 */}
                      {!loadingSessions.has(project.id) && projectSessions[project.id]?.length > 0 && (
                        projectSessions[project.id].map((session) => (
                          <button
                            key={session.id}
                            onClick={() => onSelectSession?.(session.id)}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm group ${
                              selectedSession?.id === session.id
                                ? 'bg-primary-600 text-white font-semibold'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span className="truncate flex-1 text-left">{session.title}</span>
                            <span className={`text-xs ${
                              selectedSession?.id === session.id
                                ? 'text-primary-200'
                                : 'text-slate-600 group-hover:text-slate-400'
                            }`}>
                              {new Date(session.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                            </span>
                          </button>
                        ))
                      )}

                      {/* 세션 없음 */}
                      {!loadingSessions.has(project.id) && projectSessions[project.id]?.length === 0 && (
                        <div className="px-3 py-1.5 text-xs text-slate-600">
                          세션 없음
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 하단 설정 */}
      <div className="p-3 border-t border-slate-700">
        <div className="text-xs text-slate-500 mb-2">
          Gist 기반 컨텍스트 관리
        </div>
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white">
          <Settings className="w-4 h-4" />
          <span className="text-sm">설정</span>
        </button>
      </div>
    </aside>
  );
}
