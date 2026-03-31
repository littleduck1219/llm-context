import { Message, Session, SessionSummary } from '../types';

// 세션 요약 생성 (LLM API 호출 없이 로컬에서 처리하는 기본 버전)
// 실제 사용시에는 OpenAI, Anthropic 등의 API를 연동 가능

export function generateBasicSummary(session: Session): SessionSummary {
  const messages = session.messages;

  // 키워드 추출
  const keywords = extractKeywords(messages);

  // 주요 결정사항 추출
  const decisions = extractDecisions(messages);

  // 다음 단계 추출
  const nextSteps = extractNextSteps(messages);

  // 요약 생성
  const summary = generateSummaryText(messages, keywords, decisions);

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    sessionId: session.id,
    createdAt: new Date(),
    summary,
    keyPoints: keywords.slice(0, 5),
    decisions,
    nextSteps
  };
}

function extractKeywords(messages: Message[]): string[] {
  const allText = messages.map(m => m.content).join(' ');

  // 코드 블록 제거
  const textWithoutCode = allText.replace(/```[\s\S]*?```/g, '');

  // 단어 빈도수 계산
  const words = textWithoutCode.toLowerCase()
    .replace(/[^\w\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);

  const frequency: Record<string, number> = {};
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });

  // 빈도순 정렬
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function extractDecisions(messages: Message[]): string[] {
  const decisions: string[] = [];
  const decisionPatterns = [
    /결정|선택|사용하기로|채택|적용|구현하기로/gi,
    /decided|chosen|will use|adopted|implemented/gi
  ];

  messages.forEach(msg => {
    if (msg.role === 'assistant') {
      decisionPatterns.forEach(pattern => {
        const matches = msg.content.match(pattern);
        if (matches) {
          // 결정이 포함된 문장 추출
          const sentences = msg.content.split(/[.!?]\s+/);
          sentences.forEach(sentence => {
            if (pattern.test(sentence) && sentence.length > 10) {
              decisions.push(sentence.trim());
            }
          });
        }
      });
    }
  });

  return [...new Set(decisions)].slice(0, 5);
}

function extractNextSteps(messages: Message[]): string[] {
  const steps: string[] = [];
  const patterns = [
    /다음으로|그 다음|이제|먼저|나중에|추가로|TODO|할 일|해야/gi,
    /next|then|after that|first|later|additionally|TODO|need to/gi
  ];

  const lastMessages = messages.slice(-5); // 마지막 5개 메시지만 확인

  lastMessages.forEach(msg => {
    patterns.forEach(pattern => {
      const matches = msg.content.match(pattern);
      if (matches) {
        const sentences = msg.content.split(/[.!?]\s+/);
        sentences.forEach(sentence => {
          if (pattern.test(sentence) && sentence.length > 10) {
            steps.push(sentence.trim());
          }
        });
      }
    });
  });

  return [...new Set(steps)].slice(0, 5);
}

function generateSummaryText(
  messages: Message[],
  keywords: string[],
  decisions: string[]
): string {
  const userMessages = messages.filter(m => m.role === 'user');
  const assistantMessages = messages.filter(m => m.role === 'assistant');

  let summary = `총 ${messages.length}개의 메시지가 교환되었습니다. `;
  summary += `사용자 질문 ${userMessages.length}개, 어시스턴트 응답 ${assistantMessages.length}개.\n\n`;

  if (keywords.length > 0) {
    summary += `주요 키워드: ${keywords.slice(0, 5).join(', ')}\n`;
  }

  // 첫 번째와 마지막 사용자 메시지 요약
  if (userMessages.length > 0) {
    const first = userMessages[0].content.slice(0, 100);
    const last = userMessages[userMessages.length - 1].content.slice(0, 100);

    summary += `\n시작 질문: "${first}${first.length >= 100 ? '...' : ''}"\n`;
    if (userMessages.length > 1) {
      summary += `마지막 질문: "${last}${last.length >= 100 ? '...' : ''}"\n`;
    }
  }

  if (decisions.length > 0) {
    summary += `\n주요 결정:\n${decisions.map(d => `- ${d}`).join('\n')}`;
  }

  return summary;
}

// 긴 히스토리를 컨텍스트 윈도우에 맞게 압축
export function compressHistory(
  messages: Message[],
  maxTokens: number = 50000
): { compressed: Message[]; summary: string } {
  // 간단한 토큰 추정 (평균 4글자 = 1토큰)
  const estimateTokens = (text: string) => Math.ceil(text.length / 4);

  let totalTokens = 0;
  const recentMessages: Message[] = [];
  const oldMessages: Message[] = [];

  // 뒤에서부터 최신 메시지 유지
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const tokens = estimateTokens(msg.content);

    if (totalTokens + tokens <= maxTokens) {
      recentMessages.unshift(msg);
      totalTokens += tokens;
    } else {
      oldMessages.unshift(msg);
    }
  }

  // 오래된 메시지를 자세히 포함
  let summary = '';
  if (oldMessages.length > 0) {
    summary = `\n[이전 대화 내용]\n\n`;

    // 전체 메시지를 포함 (압축 없이)
    oldMessages.forEach(msg => {
      summary += `**${msg.role === 'user' ? '사용자' : '어시스턴트'}:**\n`;
      summary += `${msg.content}\n\n`;
    });
  }

  return {
    compressed: recentMessages,
    summary
  };
}

// LLM API 연동을 위한 인터페이스
export interface SummarizerConfig {
  provider: 'openai' | 'anthropic' | 'local';
  apiKey?: string;
  model?: string;
}

export async function summarizeWithLLM(
  messages: Message[],
  config: SummarizerConfig
): Promise<string> {
  if (config.provider === 'local') {
    const basic = generateBasicSummary({ messages } as Session);
    return basic.summary;
  }

  // OpenAI API 호출 예시
  if (config.provider === 'openai' && config.apiKey) {
    const content = messages.map(m =>
      `${m.role.toUpperCase()}: ${m.content}`
    ).join('\n\n');

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: '다음 대화를 요약해주세요. 주요 결정사항, 사용된 기술, 다음 단계를 포함해주세요.'
            },
            { role: 'user', content }
          ],
          max_tokens: 500
        })
      });

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '요약 생성 실패';
    } catch (error) {
      console.error('LLM 요약 실패:', error);
      return generateBasicSummary({ messages } as Session).summary;
    }
  }

  return generateBasicSummary({ messages } as Session).summary;
}
