import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Sparkles, Loader2, Check, X as XIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { useSOS } from '@/lib/SOSContext.jsx';

export default function FlashcardsTool() {
  const [mode, setMode] = useState('list'); // list, study, generate
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [genTopic, setGenTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { addXp } = useSOS();
  const queryClient = useQueryClient();

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['flashcards'],
    queryFn: () => base44.entities.Flashcard.list('-created_date', 50),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Flashcard.bulkCreate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards'] });
      setMode('list');
      addXp(25);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Flashcard.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flashcards'] }),
  });

  const generateCards = async () => {
    if (!genTopic.trim()) return;
    setIsGenerating(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate 8 flashcards for studying: "${genTopic}". Each card should test a key concept.`,
      response_json_schema: {
        type: "object",
        properties: {
          cards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                answer: { type: "string" },
                difficulty: { type: "string", enum: ["easy", "medium", "hard"] }
              }
            }
          }
        }
      }
    });
    createMutation.mutate(result.cards.map(c => ({ ...c, subject: genTopic })));
    setIsGenerating(false);
  };

  const markCard = (known) => {
    if (cards[currentIndex]) {
      const card = cards[currentIndex];
      updateMutation.mutate({
        id: card.id,
        data: {
          review_count: (card.review_count || 0) + 1,
          mastery: known ? Math.min(100, (card.mastery || 0) + 15) : Math.max(0, (card.mastery || 0) - 5),
          last_reviewed: new Date().toISOString()
        }
      });
      if (known) addXp(5);
    }
    setFlipped(false);
    if (currentIndex < cards.length - 1) setCurrentIndex(currentIndex + 1);
    else { setCurrentIndex(0); setMode('list'); }
  };

  if (mode === 'study' && cards.length > 0) {
    const card = cards[currentIndex];
    return (
      <div className="h-full flex flex-col items-center justify-center p-6">
        <p className="text-xs text-muted-foreground mb-2">{currentIndex + 1} / {cards.length}</p>
        <motion.div
          className="w-full max-w-md aspect-[3/2] rounded-2xl border border-border bg-card cursor-pointer flex items-center justify-center p-8 relative overflow-hidden"
          onClick={() => setFlipped(!flipped)}
          whileTap={{ scale: 0.98 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={flipped ? 'answer' : 'question'}
              initial={{ opacity: 0, rotateY: 90 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0, rotateY: -90 }}
              transition={{ duration: 0.2 }}
              className="text-center"
            >
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                {flipped ? 'Answer' : 'Question'}
              </p>
              <p className={`${flipped ? 'text-sm' : 'text-lg font-medium'}`}>
                {flipped ? card?.answer : card?.question}
              </p>
            </motion.div>
          </AnimatePresence>
          <div className="absolute bottom-3 text-[10px] text-muted-foreground">
            tap to flip
          </div>
        </motion.div>
        <div className="flex gap-3 mt-6">
          <Button variant="outline" size="lg" onClick={() => markCard(false)} className="gap-2">
            <XIcon className="w-4 h-4 text-destructive" /> Don't Know
          </Button>
          <Button size="lg" onClick={() => markCard(true)} className="gap-2">
            <Check className="w-4 h-4" /> Got It
          </Button>
        </div>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => { setMode('list'); setFlipped(false); }}>
          Exit Study
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-secondary" />
          <h2 className="font-semibold">Flashcards</h2>
          <span className="text-xs text-muted-foreground">({cards.length})</span>
        </div>
        <div className="flex gap-2">
          {cards.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => { setMode('study'); setCurrentIndex(0); }}>
              Study
            </Button>
          )}
          <Button size="sm" onClick={() => setMode(mode === 'generate' ? 'list' : 'generate')}>
            {mode === 'generate' ? 'Cancel' : <><Sparkles className="w-3 h-3 mr-1" />Generate</>}
          </Button>
        </div>
      </div>

      {mode === 'generate' && (
        <div className="p-4 border-b border-border space-y-3">
          <Input
            placeholder="Topic (e.g., Python OOP, DBMS Normalization)"
            value={genTopic}
            onChange={e => setGenTopic(e.target.value)}
          />
          <Button onClick={generateCards} disabled={isGenerating} className="w-full">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Generate Flashcards
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 pb-20">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : cards.length === 0 ? (
          <div className="text-center py-12">
            <Layers className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No flashcards yet. Generate some with AI!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cards.map(card => (
              <div key={card.id} className="p-3 rounded-xl bg-muted/30 border border-border">
                <p className="text-sm font-medium line-clamp-2">{card.question}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-muted-foreground">{card.subject}</span>
                  <div className="flex items-center gap-1">
                    <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${card.mastery || 0}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{card.mastery || 0}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
