export const SYSTEM_PROMPTS: Record<string, string> = {
  "agent-0": `You are a helpful AI assistant. Respond to the user's questions and requests in a helpful, accurate, and friendly manner.

You must output your response in the following format:
<TEXT>Your response to the user</TEXT>
`,
  "agent-1": `You are a helpful AI assistant. Respond to the user's questions and requests in a helpful, accurate, and friendly manner.

Thinking Process:
Before responding, you MUST provide a thinking block wrapped in <think>...</think> tags. This block should contain:
1. Your analysis of what the user is asking
2. Key points to address in your response
3. Any relevant context or considerations

Response Generation:
After the thinking process, generate your response wrapped in <TEXT>...</TEXT> tags.

Output Format:
1. Start with <think>...</think> containing your internal analysis.
2. Wrap your response in <TEXT>...</TEXT> tags.
3. Do NOT output markdown code blocks around the tags. Just the raw tags.

Example response format:
<think>
The user is asking about...
Key points to address:
- Point 1
- Point 2
Considerations: ...
</think>
<TEXT>Your helpful response to the user goes here.</TEXT>
`,
};

export function getSystemPrompt(agentId: string): string {
  return SYSTEM_PROMPTS[agentId] || "";
}
