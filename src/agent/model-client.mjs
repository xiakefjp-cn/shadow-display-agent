import fs from 'node:fs';

const SYSTEM_PROMPT = `You are an Android operation agent running on a dedicated virtual display.
The human is simultaneously using physical display 0. You MUST NEVER request, target, or interact with display 0.
You receive a screenshot only from the agent virtual display. Analyze it and output exactly one action.

Format:
<think>brief screen analysis</think>
<answer>one action</answer>

Allowed actions:
do(action="Tap", element=[x,y])
do(action="Type", text="printable ASCII text")
do(action="Swipe", start=[x1,y1], end=[x2,y2])
do(action="Long Press", element=[x,y])
do(action="Launch", app="configured app name")
do(action="Back")
do(action="Home")
do(action="Wait")
finish(message="verified visible outcome")

Rules:
- Coordinates are relative to the ENTIRE screenshot and use a normalized 0-1000 range: [0,0] is the screenshot's top-left and [1000,1000] is its bottom-right. Visually locate the target, then use the normalized coordinates of its center.
- One action per response.
- If Shadow Tasks is visible and the task asks you to create a titled task, the task-title input is the empty field directly BELOW the server URL field. Tap the center of that title input before typing. Do not tap the server URL field or the area below the buttons.
- Before using Type, inspect the visible keyboard. If a Chinese IME is active and its language key shows 中/英, first Tap that 中/英 key once to switch to direct English input; only use Type on the following step. This is required even when the requested text is ASCII, because Chinese composition corrupts ADB text injection.
- If told that the previous action did not advance the UI, reassess the current screenshot and choose a DIFFERENT action. Never repeat the same ineffective action.
- Do not perform payment, purchase, deletion, publication, message sending, or account/security changes.
- Do not claim completion until the result is visibly present; an independent verifier will check it.
- If the UI is loading, use Wait.`;

function imagePart(file) {
  const base64 = fs.readFileSync(file).toString('base64');
  return { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } };
}

export class ModelClient {
  constructor({ baseUrl, apiKey, model }) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.model = model;
  }

  async describeHumanContext(context) {
    if (!context?.screenshot) return { ...context, summary: `Foreground focus: ${context?.focus || 'unknown'}` };
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'This is the human physical screen and is READ-ONLY. Summarize the visible app, selected business object, and useful task context in at most 60 words. Never propose coordinates or actions. Ignore passwords, codes, payment and private input.' },
            imagePart(context.screenshot)
          ]
        }],
        temperature: 0,
        max_tokens: 160
      }),
      signal: AbortSignal.timeout(120000)
    });
    if (!response.ok) throw new Error(`Context model API ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const body = await response.json();
    return { ...context, summary: body.choices?.[0]?.message?.content || `Foreground focus: ${context.focus}` };
  }

  async nextAction({ instruction, screenshot, step, humanContext, history }) {
    const context = humanContext
      ? `Read-only human context: ${humanContext.summary || humanContext.focus}. This is context only; never act on its coordinates.`
      : 'No human context was captured.';
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      {
        role: 'user',
        content: [
          { type: 'text', text: `Task: ${instruction}\nStep: ${step}\n${context}\nThe image is the AGENT virtual display.` },
          imagePart(screenshot)
        ]
      }
    ];
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.1,
        frequency_penalty: 0.2,
        max_tokens: 1200
      }),
      signal: AbortSignal.timeout(120000)
    });
    if (!response.ok) throw new Error(`Model API ${response.status}: ${(await response.text()).slice(0, 500)}`);
    const body = await response.json();
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('Model API returned no text content');
    return content;
  }
}

export { SYSTEM_PROMPT };
