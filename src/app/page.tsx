'use client';

import { useState, useEffect } from 'react';
import { Project, Session } from '@/types';
import Sidebar from '@/components/Sidebar';
import SessionView from '@/components/SessionView';
import MemoryPanel from '@/components/MemoryPanel';

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [view, setView] = useState<'projects' | 'session' | 'memory'>('projects');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      // Gist 기반 프로젝트 데이터 변환
      const formattedProjects = (Array.isArray(data) ? data : []).map((p: any) => ({
        id: p.id || p.path,
        name: p.name,
        path: p.path,
        gistId: p.gistId,
        lastSync: p.lastSync,
        memory: {
          techStack: [],
          conventions: [],
          architectureNotes: [],
          decisions: [],
          patterns: [],
          pendingTasks: []
        },
        settings: {
          autoSummarize: true,
          summaryThreshold: 50,
          keepFullHistory: true,
          contextWindowTokens: 128000
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        sessions: []
      }));
      setProjects(formattedProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (name: string, path: string, description?: string) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, path, description })
      });
      const project = await res.json();

      const newProject: Project = {
        id: project.id || path,
        name: project.name || name,
        path: project.path || path,
        gistId: project.gistId,
        lastSync: project.lastSync,
        memory: {
          techStack: [],
          conventions: [],
          architectureNotes: [],
          decisions: [],
          patterns: [],
          pendingTasks: []
        },
        settings: {
          autoSummarize: true,
          summaryThreshold: 50,
          keepFullHistory: true,
          contextWindowTokens: 128000
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        sessions: []
      };

      setProjects([...projects, newProject]);
      setSelectedProject(newProject);
      setView('memory');
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleSelectProject = async (project: Project) => {
    setSelectedProject(project);
    setSelectedSession(null);
    setView('memory');
  };

  const handleSelectSession = async (sessionId: string) => {
    if (!selectedProject) return;

    try {
      const res = await fetch(`/api/sessions?id=${sessionId}&projectId=${encodeURIComponent(selectedProject.id)}`);
      const session = await res.json();

      setSelectedSession({
        id: session.id,
        projectId: selectedProject.id,
        title: session.title,
        messages: session.messages || [],
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
        summary: session.summary,
        tags: session.tags || [],
        metadata: session.metadata,
        // CLI에서 저장한 데이터 포함
        tasks: session.tasks || [],
        codeChanges: session.codeChanges || [],
        errors: session.errors || [],
        decisions: session.decisions || []
      });
      setView('session');
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  const handleCreateSession = async (title: string) => {
    if (!selectedProject) return;

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProject.id, title })
      });
      const session = await res.json();

      setSelectedSession({
        id: session.id,
        projectId: selectedProject.id,
        title: session.title,
        messages: [],
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
        tags: []
      });
      setView('session');
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-slate-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* 사이드바 */}
      <Sidebar
        projects={projects}
        selectedProject={selectedProject}
        onSelectProject={handleSelectProject}
        onCreateProject={handleCreateProject}
        onCreateSession={handleCreateSession}
      />

      {/* 메인 컨텐츠 */}
      <main className="flex-1 flex flex-col">
        {/* 헤더 */}
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {selectedProject ? selectedProject.name : 'LLM Context Manager'}
            </h1>
            <div className="text-sm text-slate-500">
              {selectedProject?.gistId ? (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Gist 동기화 됨
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-slate-400 rounded-full"></span>
                  로컬만
                </span>
              )}
            </div>
          </div>
        </header>

        {/* 컨텐츠 영역 */}
        {view === 'session' && selectedSession ? (
          <SessionView
            session={selectedSession}
            onBack={() => setView('memory')}
          />
        ) : (
          <div className="flex-1 overflow-auto p-6">
            {view === 'projects' && (
              <div className="text-center py-12">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                  프로젝트를 선택하세요
                </h2>
                <p className="text-slate-500">
                  왼쪽 사이드바에서 프로젝트를 선택하거나 새로 생성하세요.
                </p>
              </div>
            )}

            {view === 'memory' && selectedProject && (
              <MemoryPanel
                project={selectedProject}
                onSelectSession={handleSelectSession}
                onCreateSession={handleCreateSession}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
