'use client';

import { useState, useEffect } from 'react';
import { Project } from '@/types';
import {
  FileCode,
  GitBranch,
  Plus,
  MessageSquare,
  ChevronRight,
  BookOpen,
  Lightbulb,
  RefreshCw,
  Cloud,
  CloudOff
} from 'lucide-react';

interface Session {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  summary?: string;
  tasks?: string[];
  codeChanges?: Array<{ file: string; change: string }>;
  errors?: Array<{ error: string; solution: string }>;
  decisions?: string[];
}

interface MemoryPanelProps {
  project: Project;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: (title: string) => void;
}

export default function MemoryPanel({
  project,
  onSelectSession,
  onCreateSession
}: MemoryPanelProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sessions' | 'context'>('sessions');
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, [project.id]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions?projectId=${encodeURIComponent(project.id)}`);
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch(`/api/sync?projectId=${encodeURIComponent(project.id)}`, { method: 'POST' });
      await loadSessions();
      setLastSync(new Date().toLocaleString());
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateSession = () => {
    if (newSessionTitle.trim()) {
      onCreateSession(newSessionTitle.trim());
      setNewSessionTitle('');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{project.name}</h2>
          <p className="text-sm text-slate-500">{project.path}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition disabled:opacity-50"
            title="Gist에서 동기화"
          >
            {syncing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Cloud className="w-4 h-4" />
            )}
            동기화
          </button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700">
        {[
          { id: 'sessions', label: '세션', icon: MessageSquare },
          { id: 'context', label: '컨텍스트', icon: BookOpen }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.id === 'sessions' && sessions.length > 0 && (
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-xs rounded-full">
                {sessions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 세션 탭 */}
      {activeTab === 'sessions' && (
        <div className="flex-1 overflow-auto space-y-4">
          {/* 새 세션 생성 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newSessionTitle}
              onChange={(e) => setNewSessionTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
              placeholder="세션 제목"
              className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={handleCreateSession}
              className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* 로딩 상태 */}
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
              <p className="text-slate-500">세션 로딩 중...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>아직 세션이 없습니다.</p>
              <p className="text-sm mt-2">Claude Code 세션이 자동으로 저장됩니다.</p>
              <p className="text-xs mt-4 text-slate-400">
                또는 위에서 수동으로 세션을 생성할 수 있습니다.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className="w-full p-4 bg-white dark:bg-slate-800 rounded-lg shadow hover:shadow-md transition text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="w-4 h-4 text-primary-600" />
                      <div>
                        <h3 className="font-medium text-slate-900 dark:text-white">
                          {session.title}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {new Date(session.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                  {session.tasks && session.tasks.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {session.tasks.slice(0, 3).map((task, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-xs rounded">
                          {task}
                        </span>
                      ))}
                      {session.tasks.length > 3 && (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-xs rounded">
                          +{session.tasks.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 컨텍스트 탭 */}
      {activeTab === 'context' && (
        <div className="flex-1 overflow-auto space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-5 h-5 text-primary-600" />
              <h3 className="font-semibold text-slate-900 dark:text-white">사용법</h3>
            </div>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <p className="font-medium text-slate-900 dark:text-white mb-1">CLI 사용</p>
                <code className="text-xs bg-slate-200 dark:bg-slate-600 px-2 py-1 rounded">
                  llm-context init "/path/to/project" "프로젝트명"
                </code>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <p className="font-medium text-slate-900 dark:text-white mb-1">자동 저장 (Claude Code Hooks)</p>
                <p className="text-xs">세션 시작/종료 시 자동으로 컨텍스트가 로드/저장됩니다.</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <p className="font-medium text-slate-900 dark:text-white mb-1">MCP 도구</p>
                <p className="text-xs">Claude Code 내에서 MCP 도구로 직접 컨텍스트를 관리할 수 있습니다.</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-2 mb-3">
              <Cloud className="w-5 h-5 text-primary-600" />
              <h3 className="font-semibold text-slate-900 dark:text-white">동기화 상태</h3>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              <p>마지막 동기화: {lastSync || project.lastSync || '없음'}</p>
              <p className="mt-1">Gist ID: {project.gistId || '없음'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
