
import { useEffect, useRef, useState } from 'react';
import { Bot, Send, Sparkles, User, LoaderCircle } from 'lucide-react';
import { sendAIMessage } from '../services/api.js';
import './AIAssistantPage.css';

const suggestedQuestions = [
  'Show me my sales report',
  'How much profit did my business make?',
  'Show me my expenses',
  'How is my inventory?',
  'Give me an overall business overview',
];

export default function AIAssistantPage({ token }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        "Hello! I'm EthioBiz AI Assistant. I can help you understand your business sales, expenses, profit, and inventory.\n\nWhat would you like to know?",
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSend(question = input) {
    const message = question.trim();

    if (!message || loading) return;

    setInput('');
    setError('');

    setMessages((previous) => [
      ...previous,
      { role: 'user', content: message },
    ]);

    setLoading(true);

    try {
      const result = await sendAIMessage(token, message);

      setMessages((previous) => [
        ...previous,
        {
          role: 'assistant',
          content: result.answer || 'I could not generate an answer.',
          intent: result.intent,
          data: result.data,
        },
      ]);
    } catch (err) {
      setError(err.message || 'Unable to connect to EthioBiz AI.');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <section className="ai-page">
      <div className="ai-heading">
        <div className="ai-heading-icon">
          <Sparkles size={23} />
        </div>

        <div>
          <p className="ai-eyebrow">YOUR BUSINESS ASSISTANT</p>
          <h1>EthioBiz AI Assistant</h1>
          <p>Understand your business using your recorded data.</p>
        </div>
      </div>

      <div className="ai-chat-container">
        <div className="ai-chat-header">
          <div className="ai-avatar">
            <Bot size={21} />
          </div>

          <div>
            <h3>EthioBiz AI</h3>
            <span>Business insights assistant</span>
          </div>

          <span className="ai-status">
            <span className="ai-status-dot" />
            Ready
          </span>
        </div>

        <div className="ai-messages">
          {messages.map((message, index) => (
            <div
              className={`ai-message-row ${message.role}`}
              key={`${index}-${message.role}`}
            >
              <div className="ai-message-avatar">
                {message.role === 'assistant' ? (
                  <Bot size={18} />
                ) : (
                  <User size={18} />
                )}
              </div>

              <div className="ai-message-bubble">
                <div className="ai-message-content">
                  {message.content}
                </div>

                {message.intent && (
                  <span className="ai-intent-label">
                    Report: {message.intent.replaceAll('_', ' ')}
                  </span>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="ai-message-row assistant">
              <div className="ai-message-avatar">
                <Bot size={18} />
              </div>

              <div className="ai-message-bubble ai-thinking">
                <LoaderCircle size={17} className="ai-spinner" />
                Analyzing your business data...
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {messages.length === 1 && (
          <div className="ai-suggestions">
            <p>Try asking:</p>

            <div className="ai-suggestion-list">
              {suggestedQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => handleSend(question)}
                  disabled={loading}
                >
                  <Sparkles size={14} />
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="ai-error" role="alert">
            {error}
          </div>
        )}

        <form
          className="ai-input-area"
          onSubmit={(event) => {
            event.preventDefault();
            handleSend();
          }}
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your business..."
            rows={1}
            maxLength={2000}
            disabled={loading}
          />

          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send message"
          >
            {loading ? (
              <LoaderCircle size={19} className="ai-spinner" />
            ) : (
              <Send size={19} />
            )}
          </button>
        </form>

        <p className="ai-disclaimer">
          EthioBiz AI provides insights based on your recorded business data.
        </p>
      </div>
    </section>
  );
}
