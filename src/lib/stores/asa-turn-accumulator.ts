interface StreamEvent {
  eventType: string;
  payload: Record<string, unknown>;
}

export class AsaTurnAccumulator {
  content = '';
  thinkingText: string | null = null;
  done = false;
  private separatorConsumed = false;

  appendToken(content: string): void {
    let display = content;
    if (!this.content && !this.separatorConsumed && /^\s*(?:===BODY===|===)\s*$/.test(display)) {
      this.separatorConsumed = true;
      display = '';
    } else if (this.separatorConsumed) {
      display = display.replace(/^\r?\n/, '');
      this.separatorConsumed = false;
    }
    this.content += display;
    this.thinkingText = null;
  }

  apply(event: StreamEvent): void {
    switch (event.eventType) {
      case 'thinking':
        this.thinkingText = String(event.payload.content ?? 'Thinking');
        break;
      case 'token':
        this.appendToken(String(event.payload.content ?? ''));
        break;
      case 'speech':
        this.thinkingText = null;
        break;
      case 'clarification': {
        const question = String(event.payload.question ?? event.payload.content ?? '');
        if (question) this.content = question;
        this.thinkingText = null;
        break;
      }
      case 'done': {
        const completed = String(event.payload.content ?? '');
        if (completed) this.content = normalizeAssistantContent(completed);
        this.thinkingText = null;
        this.done = true;
        break;
      }
    }
  }
}

export function normalizeAssistantContent(content: string): string {
  const separator = /(?:^|\r?\n)[\t ]*(?:===BODY===|===)[\t ]*(?:\r?\n|$)/;
  const match = separator.exec(content);
  return match ? content.slice(match.index + match[0].length).trimStart() : content;
}
