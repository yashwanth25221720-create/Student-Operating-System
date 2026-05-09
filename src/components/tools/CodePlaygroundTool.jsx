import React, { useState } from 'react';
import { Code2, Sparkles, Loader2, Copy, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button.jsx";
import { Textarea } from "@/components/ui/textarea.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.jsx";
import ReactMarkdown from 'react-markdown';
import { useSOS } from '@/lib/SOSContext.jsx';

export default function CodePlaygroundTool() {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const { addXp } = useSOS();

  const generateCode = async () => {
    if (!prompt.trim()) return;
    setIsRunning(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate ${language} code for: "${prompt}". Return ONLY the code with comments explaining key parts. No markdown fences.`,
    });
    setCode(result);
    setIsRunning(false);
    addXp(10);
  };

  const explainCode = async () => {
    if (!code.trim()) return;
    setIsRunning(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Explain this ${language} code step by step in simple terms:\n\n${code}\n\nUse markdown formatting. Be concise but thorough.`,
    });
    setOutput(result);
    setIsRunning(false);
  };

  const debugCode = async () => {
    if (!code.trim()) return;
    setIsRunning(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Debug this ${language} code. Find issues and suggest fixes:\n\n${code}\n\nFormat: list issues and corrected code.`,
    });
    setOutput(result);
    setIsRunning(false);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Code2 className="w-5 h-5 text-chart-3" />
          <h2 className="font-semibold">Code Playground</h2>
        </div>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="python">Python</SelectItem>
            <SelectItem value="javascript">JavaScript</SelectItem>
            <SelectItem value="java">Java</SelectItem>
            <SelectItem value="cpp">C++</SelectItem>
            <SelectItem value="sql">SQL</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        {/* AI Generate */}
        <div className="p-4 border-b border-border">
          <div className="flex gap-2">
            <Input
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe what you want to code..."
              className="flex-1"
              onKeyDown={e => e.key === 'Enter' && generateCode()}
            />
            <Button onClick={generateCode} disabled={isRunning}>
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Code Editor */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-mono">{language}</span>
            <Button variant="ghost" size="sm" onClick={copyCode}>
              {copied ? <Check className="w-3 h-3 text-chart-3" /> : <Copy className="w-3 h-3" />}
            </Button>
          </div>
          <Textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Write or generate code here..."
            className="min-h-[200px] font-mono text-sm bg-background"
          />
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="outline" onClick={explainCode} disabled={!code.trim() || isRunning}>
              Explain
            </Button>
            <Button size="sm" variant="outline" onClick={debugCode} disabled={!code.trim() || isRunning}>
              Debug
            </Button>
          </div>
        </div>

        {/* Output */}
        {output && (
          <div className="p-4">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">AI Output</h3>
            <div className="bg-muted/30 rounded-xl p-4 border border-border">
              <ReactMarkdown className="text-sm prose prose-sm prose-invert max-w-none">
                {output}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
