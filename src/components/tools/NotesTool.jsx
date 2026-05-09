import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Plus, Sparkles, Loader2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSOS } from '@/lib/SOSContext';

export default function NotesTool() {
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [subject, setSubject] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { addXp, addRecentAction } = useSOS();
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: () => base44.entities.Note.list('-created_date', 20),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Note.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setShowCreate(false);
      setTitle('');
      setContent('');
      setSubject('');
      addXp(15);
      addRecentAction({ type: 'note_created', timestamp: new Date().toISOString() });
    },
  });

  const generateNotes = async () => {
    if (!subject.trim()) return;
    setIsGenerating(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate comprehensive study notes on the topic: "${subject}". Format with clear headings, bullet points, and key concepts. Make it student-friendly.`,
    });
    setContent(result);
    setTitle(`Notes: ${subject}`);
    setIsGenerating(false);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Smart Notes</h2>
        </div>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>

      {showCreate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="p-4 border-b border-border space-y-3"
        >
          <div className="flex gap-2">
            <Input
              placeholder="Topic for AI generation..."
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="flex-1"
            />
            <Button onClick={generateNotes} disabled={isGenerating} variant="outline" size="sm">
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            </Button>
          </div>
          <Input
            placeholder="Note title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <Textarea
            placeholder="Write your notes or let AI generate them..."
            value={content}
            onChange={e => setContent(e.target.value)}
            className="min-h-[150px] font-mono text-sm"
          />
          <Button
            onClick={() => createMutation.mutate({ title, content, subject, type: 'note' })}
            disabled={!title.trim()}
            className="w-full"
          >
            Save Note
          </Button>
        </motion.div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No notes yet. Create one or let AI generate them!</p>
          </div>
        ) : (
          notes.map(note => (
            <div key={note.id} className="p-3 rounded-xl bg-muted/30 border border-border hover:border-primary/20 transition-colors cursor-pointer">
              <h3 className="font-medium text-sm">{note.title}</h3>
              {note.subject && <span className="text-xs text-primary mt-1 inline-block">{note.subject}</span>}
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{note.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}