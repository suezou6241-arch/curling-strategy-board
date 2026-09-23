// 作戦提案AIの接続設定。localStorage に保存する。
// バックエンドを持たないPWAのため、OpenAI互換のAPIをクライアントから直接呼ぶ構成。
// APIキー未設定でもオフラインの簡易ロジックで動作する(settings.ts 参照先の client.ts)。

export interface AiSettings {
  // OpenAI互換エンドポイントのベースURL(末尾に /chat/completions を付けて呼ぶ)
  baseUrl: string;
  apiKey: string;
  model: string;
}

const KEY = "curling_ai_settings_v1";

const DEFAULTS: AiSettings = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
};

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    return {
      baseUrl: parsed.baseUrl?.trim() || DEFAULTS.baseUrl,
      apiKey: parsed.apiKey ?? DEFAULTS.apiKey,
      model: parsed.model?.trim() || DEFAULTS.model,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveAiSettings(s: AiSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function hasApiKey(): boolean {
  return loadAiSettings().apiKey.trim().length > 0;
}
