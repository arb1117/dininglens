import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { useMealContext } from '../context/MealContext';
import type { RootStackParamList } from '../../App';

const SERVER_URL = process.env.EXPO_PUBLIC_PROXY_URL ?? 'http://192.168.1.71:3001';
const MAX_HISTORY = 10;

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

// Bold **text** → array of parts for rendering
function parseBold(text: string): { bold: boolean; text: string }[] {
  const parts: { bold: boolean; text: string }[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ bold: false, text: text.slice(last, m.index) });
    parts.push({ bold: true, text: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ bold: false, text: text.slice(last) });
  return parts;
}

// Extract **Food Name** - description lines → tappable chip suggestions
function extractFoodSuggestions(text: string): string[] {
  const suggestions: string[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const candidate = m[1].trim();
    if (candidate.length > 2 && candidate.length < 60) suggestions.push(candidate);
  }
  return [...new Set(suggestions)];
}

function BubbleText({ text }: { text: string }) {
  const parts = parseBold(text);
  return (
    <Text style={bub.text}>
      {parts.map((p, i) => (
        <Text key={i} style={p.bold ? bub.bold : undefined}>{p.text}</Text>
      ))}
    </Text>
  );
}

const bub = StyleSheet.create({
  text: { fontSize: 15, color: '#FFFFFF', lineHeight: 22 },
  bold: { fontWeight: '700', color: '#00E5A0' },
});

export default function AIChatScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { mealLog, goals } = useMealContext();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      text: "Hey! I'm your AI coach. I can see your food log and help you hit your goals. What's on your mind?",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  const today = new Date().toDateString();

  const context = useMemo(() => {
    const todayMeals = mealLog.filter(m => new Date(m.timestamp).toDateString() === today);
    const totals = todayMeals.reduce(
      (a, m) => ({ cal: a.cal + m.totals.cal, protein: a.protein + m.totals.protein, carbs: a.carbs + m.totals.carbs, fat: a.fat + m.totals.fat }),
      { cal: 0, protein: 0, carbs: 0, fat: 0 }
    );
    const loggedDates = new Set(mealLog.map(m => new Date(m.timestamp).toDateString()));
    const d = new Date();
    if (!loggedDates.has(d.toDateString())) d.setDate(d.getDate() - 1);
    let streak = 0;
    while (loggedDates.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }
    return { todayLog: { meals: todayMeals.length, totals }, goals, streak };
  }, [mealLog, goals, today]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: Message = { id: String(Date.now()), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Keep last MAX_HISTORY messages as history (excluding the initial greeting)
    const history = messages.slice(-MAX_HISTORY).map(m => ({ role: m.role, content: m.text }));

    try {
      const res = await fetch(`${SERVER_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, context, history }),
      });
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const data = await res.json();
      const reply: Message = { id: String(Date.now() + 1), role: 'assistant', text: data.reply ?? 'Sorry, I had trouble responding.' };
      setMessages(prev => [...prev, reply]);
    } catch {
      const errMsg: Message = { id: String(Date.now() + 1), role: 'assistant', text: "Sorry, I couldn't connect right now. Try again in a moment." };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [input, loading, messages, context]);

  function renderMessage({ item }: { item: Message }) {
    const isUser = item.role === 'user';
    const suggestions = isUser ? [] : extractFoodSuggestions(item.text);
    return (
      <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleAI]}>
        <BubbleText text={item.text} />
        {suggestions.length > 0 && (
          <View style={s.chips}>
            {suggestions.map(food => (
              <TouchableOpacity
                key={food}
                style={s.chip}
                onPress={() => navigation.navigate('Search', { query: food })}
              >
                <Text style={s.chipText}>+ {food}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.titleBar}>
        <Text style={s.title}>AI Coach</Text>
        <Text style={s.subtitle}>Powered by Claude</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={m => m.id}
          style={s.list}
          contentContainerStyle={s.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {loading && (
          <View style={s.typingRow}>
            <ActivityIndicator size="small" color="#00E5A0" />
            <Text style={s.typingText}>Thinking…</Text>
          </View>
        )}

        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything about your nutrition…"
            placeholderTextColor="#555"
            multiline
            maxLength={500}
            onSubmitEditing={send}
            returnKeyType="send"
            blurOnSubmit
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDisabled]}
            onPress={send}
            disabled={!input.trim() || loading}
          >
            <Text style={s.sendBtnText}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },

  titleBar: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' },
  title: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  subtitle: { fontSize: 12, color: '#8A8A8A', marginTop: 2 },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },

  bubble: {
    maxWidth: '85%',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  bubbleUser: {
    backgroundColor: '#1E1E1E',
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor: '#111',
    alignSelf: 'flex-start',
    borderLeftWidth: 3,
    borderLeftColor: '#00E5A0',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 8 },
  chip: {
    backgroundColor: '#1A2A1A',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#00E5A0',
  },
  chipText: { color: '#00E5A0', fontSize: 13, fontWeight: '600' },

  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 8 },
  typingText: { fontSize: 13, color: '#8A8A8A' },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#2A2A2A',
    backgroundColor: '#0F0F0F',
  },
  input: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#FFFFFF',
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#00E5A0',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.35 },
  sendBtnText: { fontSize: 20, color: '#0F0F0F', fontWeight: '700' },
});
