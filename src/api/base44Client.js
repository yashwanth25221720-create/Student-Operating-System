import { supabase } from '@/api/supabaseClient';

const TABLES = {
  Task: 'tasks',
  Goal: 'goals',
  Note: 'notes',
  Flashcard: 'flashcards',
  StudySession: 'study_sessions',
};

const toAppUser = (user) => ({
  id: user.id,
  email: user.email,
  full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Student',
  avatar_url: user.user_metadata?.avatar_url,
  raw: user,
});

const appUrl = (path = '/') => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${window.location.origin}${normalizedPath}`;
};

const throwIfError = ({ error }) => {
  if (error) throw error;
};

const currentUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user.id;
};

const parseSort = (sort = '-created_date') => {
  const descending = sort.startsWith('-');
  return {
    column: descending ? sort.slice(1) : sort,
    ascending: !descending,
  };
};

const normalizeRows = (rows) => rows || [];

const createEntity = (name) => {
  const table = TABLES[name];

  return {
    async list(sort = '-created_date', limit) {
      const { column, ascending } = parseSort(sort);
      let query = supabase.from(table).select('*').order(column, { ascending });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      throwIfError({ error });
      return normalizeRows(data);
    },

    async filter(filters = {}, sort = '-created_date', limit) {
      const { column, ascending } = parseSort(sort);
      let query = supabase.from(table).select('*').order(column, { ascending });

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) query = query.eq(key, value);
      });

      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      throwIfError({ error });
      return normalizeRows(data);
    },

    async create(payload) {
      const userId = await currentUserId();
      const insertPayload = userId ? { ...payload, user_id: userId } : payload;
      const { data, error } = await supabase.from(table).insert(insertPayload).select('*').single();
      throwIfError({ error });
      return data;
    },

    async bulkCreate(payloads) {
      const userId = await currentUserId();
      const rows = userId ? payloads.map((payload) => ({ ...payload, user_id: userId })) : payloads;
      const { data, error } = await supabase.from(table).insert(rows).select('*');
      throwIfError({ error });
      return normalizeRows(data);
    },

    async update(id, payload) {
      const { data, error } = await supabase
        .from(table)
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();
      throwIfError({ error });
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      throwIfError({ error });
      return true;
    },
  };
};

const buildJsonInstruction = (schema) => {
  if (!schema) return '';
  return `\n\nReturn only valid JSON matching this JSON schema:\n${JSON.stringify(schema)}`;
};

const callConfiguredAiEndpoint = async ({ prompt, response_json_schema }) => {
  const endpoint = import.meta.env.VITE_AI_ENDPOINT;
  const apiKey = import.meta.env.VITE_AI_API_KEY;
  if (!endpoint) return null;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ prompt, response_json_schema }),
  });

  if (!response.ok) throw new Error(`AI request failed: ${response.status}`);
  const data = await response.json();
  return data.result ?? data.content ?? data;
};

const callOpenAiDirectly = async ({ prompt, response_json_schema }) => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('AI is not configured. Set VITE_AI_ENDPOINT or VITE_OPENAI_API_KEY in .env.local.');
  }

  const model = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4.1-mini';
  const wantsJson = Boolean(response_json_schema);
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: `${prompt}${buildJsonInstruction(response_json_schema)}` }],
      response_format: wantsJson ? { type: 'json_object' } : undefined,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  return wantsJson ? JSON.parse(content) : content;
};

const InvokeLLM = async (request) => {
  const endpointResult = await callConfiguredAiEndpoint(request);
  if (endpointResult !== null) return endpointResult;
  return callOpenAiDirectly(request);
};

export const base44 = {
  auth: {
    async me() {
      const { data, error } = await supabase.auth.getUser();
      throwIfError({ error });
      if (!data.user) throw new Error('Not authenticated');
      return toAppUser(data.user);
    },

    async loginViaEmailPassword(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      throwIfError({ error });
      return data;
    },

    async register({ email, password }) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: appUrl('/') },
      });
      throwIfError({ error });
      return data;
    },

    async verifyOtp({ email, otpCode }) {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'signup',
      });
      throwIfError({ error });
      return {
        ...data,
        access_token: data.session?.access_token,
      };
    },

    async resendOtp(email) {
      const { data, error } = await supabase.auth.resend({ type: 'signup', email });
      throwIfError({ error });
      return data;
    },

    async setToken() {
      return true;
    },

    async loginWithProvider(provider = 'google', redirectTo = '/') {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: appUrl(redirectTo),
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });
      throwIfError({ error });
      return data;
    },

    async resetPasswordRequest(email) {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: appUrl('/reset-password'),
      });
      throwIfError({ error });
      return data;
    },

    async resetPassword({ newPassword }) {
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      throwIfError({ error });
      return data;
    },

    async logout() {
      const { error } = await supabase.auth.signOut();
      throwIfError({ error });
      window.location.href = '/sign-in';
    },

    redirectToLogin() {
      window.location.href = '/sign-in';
    },
  },

  entities: {
    Task: createEntity('Task'),
    Goal: createEntity('Goal'),
    Note: createEntity('Note'),
    Flashcard: createEntity('Flashcard'),
    StudySession: createEntity('StudySession'),
  },

  integrations: {
    Core: {
      InvokeLLM,
    },
  },
};
