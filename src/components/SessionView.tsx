'use client';

import { useState, useEffect } from 'react';
import { Session, Message, MessageAttachment, CodeChange, ErrorLog } from '@/types';
import {
  ArrowLeft,
  User,
  Bot,
  Copy,
  Check,
  RefreshCw,
  Paperclip,
  FileCode,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  FileText,
  Code2,
  Download,
  Clipboard,
  MessageSquare
} from 'lucide-react';

interface SessionViewProps {
  session: Session;
  onBack: () => void;
}

export default function SessionView({ session, onBack }: SessionViewProps) {
  const [messages, setMessages] = useState<Message[]>(session.messages || []);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [attachments, setAttachments] = useState<Record<string, MessageAttachment[]>>({});
  const [expandedAttachments, setExpandedAttachments] = useState<Set<string>>(new Set());
  const [codeChanges, setCodeChanges] = useState<CodeChange[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [activeTab, setActiveTab] = useState<'messages' | 'context' | 'code' | 'errors'>('context');

  useEffect(() => {
    loadData();
  }, [session.id]);

  const loadData = async () => {
    try {
      const [messagesRes, changesRes, errorsRes] = await Promise.all([
        fetch(`/api/messages?sessionId=${session.id}`),
        fetch(`/api/code-changes?sessionId=${session.id}`),
        fetch(`/api/error-logs?sessionId=${session.id}`)
      ]);

      const messagesData = await messagesRes.json();
      setMessages(Array.isArray(messagesData) ? messagesData : []);

      const changesData = await changesRes.json();
      setCodeChanges(Array.isArray(changesData) ? changesData : []);

      const errorsData = await errorsRes.json();
      setErrorLogs(Array.isArray(errorsData) ? errorsData : []);

      // 첨부 파일 로드
      for (const msg of messagesData) {
        await loadAttachments(msg.id);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const loadAttachments = async (messageId: string) => {
    try {
      const res = await fetch(`/api/attachments?messageId=${messageId}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setAttachments(prev => ({
          ...prev,
          [messageId]: data
        }));
      }
    } catch (error) {
      console.error('Failed to load attachments:', error);
    }
  };

  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSummarize = async () => {
    setIsSummarizing(true);
    try {
      const res = await fetch('/api/sessions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          generateSummary: true
        })
      });
      const data = await res.json();
      if (data.summary) {
        alert('요약이 생성되었습니다!');
      }
    } catch (error) {
      console.error('Failed to summarize:', error);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleExportContext = async () => {
    try {
      const res = await fetch(`/api/context?sessionId=${session.id}&format=llm`);
      const text = await res.text();

      // 클립보드에 복사
      await navigator.clipboard.writeText(text);
      alert('컨텍스트가 클립보드에 복사되었습니다!');
    } catch (error) {
      console.error('Failed to export context:', error);
    }
  };

  const toggleAttachment = (attachmentId: string) => {
    setExpandedAttachments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(attachmentId)) {
        newSet.delete(attachmentId);
      } else {
        newSet.add(attachmentId);
      }
      return newSet;
    });
  };

  // 파일별로 코드 변경 그룹화
  const groupedChanges = codeChanges.reduce((acc, change) => {
    if (!acc[change.filepath]) {
      acc[change.filepath] = [];
    }
    acc[change.filepath].push(change);
    return acc;
  }, {} as Record<string, CodeChange[]>);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 text-center">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {session.title}
          </h2>
          <p className="text-sm text-slate-500">
            {new Date(session.createdAt).toLocaleString()} · {messages.length}개 메시지
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportContext}
            className="flex items-center gap-2 px-3 py-2 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-800/30 text-green-700 dark:text-green-300 rounded-lg transition"
            title="LLM용 컨텍스트 복사"
          >
            <Clipboard className="w-4 h-4" />
            컨텍스트 복사
          </button>
          <button
            onClick={handleSummarize}
            disabled={isSummarizing}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSummarizing ? 'animate-spin' : ''}`} />
            요약 생성
          </button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex gap-2 px-4 pt-4 border-b border-slate-200 dark:border-slate-700">
        {[
          { id: 'context', label: '개발 컨텍스트', icon: FileText },
          { id: 'messages', label: '대화', icon: MessageSquare },
          { id: 'code', label: '코드 변경', icon: Code2 },
          { id: 'errors', label: '에러 이력', icon: AlertCircle }
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
            {tab.id === 'code' && codeChanges.length > 0 && (
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                {codeChanges.length}
              </span>
            )}
            {tab.id === 'errors' && errorLogs.length > 0 && (
              <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs rounded-full">
                {errorLogs.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 개발 컨텍스트 탭 */}
      {activeTab === 'context' && (
        <div className="flex-1 overflow-auto p-4 space-y-4 min-h-0">
          {/* 요약 */}
          {session.summary && (
            <div className="bg-primary-50 dark:bg-primary-900/30 rounded-lg p-4">
              <h3 className="font-medium text-primary-900 dark:text-primary-100 mb-2">
                세션 요약
              </h3>
              <p className="text-sm text-primary-700 dark:text-primary-300 whitespace-pre-wrap">
                {session.summary}
              </p>
            </div>
          )}

          {/* 수정된 파일 */}
          {Object.keys(groupedChanges).length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <FileCode className="w-5 h-5 text-blue-600" />
                수정된 파일 ({Object.keys(groupedChanges).length}개)
              </h3>
              <ul className="space-y-2">
                {Object.entries(groupedChanges).map(([filepath, changes]) => (
                  <li key={filepath} className="flex items-center gap-2 text-sm">
                    <span className={`w-2 h-2 rounded-full ${
                      changes.some(c => c.changeType === 'created') ? 'bg-green-500' :
                      changes.some(c => c.changeType === 'deleted') ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                    <span className="text-slate-700 dark:text-slate-300">{filepath}</span>
                    <span className="text-slate-400 text-xs">({changes.length}개 변경)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 해결된 에러 */}
          {errorLogs.filter(e => e.solution).length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                해결된 에러 ({errorLogs.filter(e => e.solution).length}개)
              </h3>
              <ul className="space-y-3">
                {errorLogs.filter(e => e.solution).map((error) => (
                  <li key={error.id} className="border-l-2 border-green-500 pl-3">
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                      {error.errorMessage}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      해결: {error.solution}
                    </p>
                    {error.relatedFile && (
                      <p className="text-xs text-slate-500 mt-1">
                        파일: {error.relatedFile}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 컨텍스트가 없는 경우 */}
          {Object.keys(groupedChanges).length === 0 && errorLogs.length === 0 && !session.summary && (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>아직 개발 컨텍스트가 없습니다.</p>
              <p className="text-sm mt-2">코드 변경사항이나 에러 해결 이력이 기록되면 여기에 표시됩니다.</p>
            </div>
          )}
        </div>
      )}

      {/* 대화 탭 */}
      {activeTab === 'messages' && (
        <div className="flex-1 overflow-auto space-y-4 p-4 min-h-0">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              아직 메시지가 없습니다.
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                {/* 아바타 */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'user'
                      ? 'bg-primary-100 text-primary-600'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>

                {/* 메시지 내용 */}
                <div
                  className={`flex-1 max-w-[80%] ${
                    message.role === 'user' ? 'text-right' : ''
                  }`}
                >
                  <div
                    className={`inline-block rounded-lg px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-primary-600 text-white'
                        : 'bg-white dark:bg-slate-800 shadow'
                    }`}
                  >
                    <div className="prose prose-sm max-w-none">
                      {message.content.split('\n').map((line, i) => (
                        <p key={i} className="mb-1 last:mb-0">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* 첨부 파일 표시 */}
                  {attachments[message.id] && attachments[message.id].length > 0 && (
                    <div className={`mt-2 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                      <div className="inline-block bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2 max-w-full">
                        <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                          <Paperclip className="w-3 h-3" />
                          <span>첨부 파일 {attachments[message.id].length}개</span>
                        </div>
                        {attachments[message.id].map((attachment) => (
                          <div key={attachment.id} className="mt-1">
                            <button
                              onClick={() => toggleAttachment(attachment.id)}
                              className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
                            >
                              <FileCode className="w-4 h-4" />
                              <span className="truncate max-w-[200px]">{attachment.filename}</span>
                              {expandedAttachments.has(attachment.id) ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                            {expandedAttachments.has(attachment.id) && (
                              <pre className="mt-2 p-2 bg-slate-900 text-slate-100 rounded text-xs overflow-auto max-h-60 max-w-md">
                                <code>{attachment.content}</code>
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 메타데이터 */}
                  <div className={`flex items-center gap-2 mt-1 text-xs text-slate-500 ${
                    message.role === 'user' ? 'justify-end' : ''
                  }`}>
                    <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                    <button
                      onClick={() => handleCopy(message.content, message.id)}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                    >
                      {copiedId === message.id ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 코드 변경 탭 */}
      {activeTab === 'code' && (
        <div className="flex-1 overflow-auto p-4 space-y-4 min-h-0">
          {codeChanges.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Code2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>기록된 코드 변경사항이 없습니다.</p>
            </div>
          ) : (
            Object.entries(groupedChanges).map(([filepath, changes]) => (
              <div key={filepath} className="bg-white dark:bg-slate-800 rounded-lg shadow">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-5 h-5 text-blue-600" />
                      <h3 className="font-medium text-slate-900 dark:text-white">{filepath}</h3>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded ${
                      changes.some(c => c.changeType === 'created') ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                      changes.some(c => c.changeType === 'deleted') ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                    }`}>
                      {changes[0].changeType === 'created' ? '생성' :
                       changes[0].changeType === 'deleted' ? '삭제' : '수정'}
                    </span>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  {changes.map((change) => (
                    <div key={change.id} className="border-l-2 border-blue-300 pl-3">
                      {change.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                          {change.description}
                        </p>
                      )}
                      {change.afterCode && (
                        <pre className="p-3 bg-slate-900 text-slate-100 rounded text-xs overflow-auto">
                          <code>{change.afterCode}</code>
                        </pre>
                      )}
                      <p className="text-xs text-slate-500 mt-2">
                        {new Date(change.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 에러 이력 탭 */}
      {activeTab === 'errors' && (
        <div className="flex-1 overflow-auto p-4 space-y-4 min-h-0">
          {errorLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>기록된 에러가 없습니다.</p>
            </div>
          ) : (
            errorLogs.map((error) => (
              <div
                key={error.id}
                className={`bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden ${
                  error.solution ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {error.solution ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs rounded font-mono">
                          {error.errorType}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(error.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-900 dark:text-white font-medium">
                        {error.errorMessage}
                      </p>
                      {error.relatedFile && (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <FileCode className="w-3 h-3" />
                          {error.relatedFile}
                          {error.relatedLine && `:${error.relatedLine}`}
                        </p>
                      )}
                      {error.stackTrace && (
                        <details className="mt-2">
                          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                            스택 트레이스 보기
                          </summary>
                          <pre className="mt-2 p-2 bg-slate-900 text-slate-100 rounded text-xs overflow-auto max-h-40">
                            <code>{error.stackTrace}</code>
                          </pre>
                        </details>
                      )}
                      {error.solution && (
                        <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">
                            해결 방법:
                          </p>
                          <p className="text-sm text-green-700 dark:text-green-300">
                            {error.solution}
                          </p>
                          {error.solvedAt && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                              해결일: {new Date(error.solvedAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
