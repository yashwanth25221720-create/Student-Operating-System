import React, { useState } from 'react';
import { Briefcase, Sparkles, Loader2, Plus, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Textarea } from "@/components/ui/textarea.jsx";
import { useSOS } from '@/lib/SOSContext.jsx';

export default function ResumeBuilderTool() {
  const [resume, setResume] = useState({
    name: '', email: '', phone: '', summary: '',
    education: [{ school: '', degree: '', year: '' }],
    experience: [{ company: '', role: '', duration: '', description: '' }],
    skills: '',
    projects: [{ name: '', description: '' }],
  });
  const [generatedSummary, setGeneratedSummary] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { addXp } = useSOS();

  const updateField = (field, value) => setResume(prev => ({ ...prev, [field]: value }));
  
  const updateArrayField = (field, index, key, value) => {
    const arr = [...resume[field]];
    arr[index] = { ...arr[index], [key]: value };
    setResume(prev => ({ ...prev, [field]: arr }));
  };

  const addArrayItem = (field, template) => {
    setResume(prev => ({ ...prev, [field]: [...prev[field], template] }));
  };

  const removeArrayItem = (field, index) => {
    setResume(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
  };

  const generateSummary = async () => {
    setIsGenerating(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Write a professional resume summary for a student with:
Name: ${resume.name}
Skills: ${resume.skills}
Education: ${resume.education.map(e => `${e.degree} at ${e.school}`).join(', ')}
Experience: ${resume.experience.map(e => `${e.role} at ${e.company}`).join(', ')}

Write 2-3 sentences, professional tone, highlighting strengths. Return plain text only.`
    });
    setGeneratedSummary(result);
    updateField('summary', result);
    setIsGenerating(false);
    addXp(15);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-chart-2" />
          <h2 className="font-semibold">Resume Builder</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        {/* Personal Info */}
        <section className="space-y-3">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Personal Info</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="Full Name" value={resume.name} onChange={e => updateField('name', e.target.value)} />
            <Input placeholder="Email" value={resume.email} onChange={e => updateField('email', e.target.value)} />
            <Input placeholder="Phone" value={resume.phone} onChange={e => updateField('phone', e.target.value)} />
            <Input placeholder="Skills (comma separated)" value={resume.skills} onChange={e => updateField('skills', e.target.value)} />
          </div>
        </section>

        {/* Summary */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Summary</h3>
            <Button size="sm" variant="outline" onClick={generateSummary} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
              AI Generate
            </Button>
          </div>
          <Textarea
            placeholder="Professional summary..."
            value={resume.summary}
            onChange={e => updateField('summary', e.target.value)}
            className="min-h-[80px]"
          />
        </section>

        {/* Education */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Education</h3>
            <Button size="sm" variant="ghost" onClick={() => addArrayItem('education', { school: '', degree: '', year: '' })}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          {resume.education.map((edu, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 items-start">
              <Input placeholder="School" value={edu.school} onChange={e => updateArrayField('education', i, 'school', e.target.value)} />
              <Input placeholder="Degree" value={edu.degree} onChange={e => updateArrayField('education', i, 'degree', e.target.value)} />
              <div className="flex gap-1">
                <Input placeholder="Year" value={edu.year} onChange={e => updateArrayField('education', i, 'year', e.target.value)} />
                {resume.education.length > 1 && (
                  <Button size="icon" variant="ghost" onClick={() => removeArrayItem('education', i)}>
                    <Trash2 className="w-3 h-3 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </section>

        {/* Experience */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Experience</h3>
            <Button size="sm" variant="ghost" onClick={() => addArrayItem('experience', { company: '', role: '', duration: '', description: '' })}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          {resume.experience.map((exp, i) => (
            <div key={i} className="space-y-2 p-3 rounded-lg bg-muted/20 border border-border">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Company" value={exp.company} onChange={e => updateArrayField('experience', i, 'company', e.target.value)} />
                <Input placeholder="Role" value={exp.role} onChange={e => updateArrayField('experience', i, 'role', e.target.value)} />
              </div>
              <Input placeholder="Duration" value={exp.duration} onChange={e => updateArrayField('experience', i, 'duration', e.target.value)} />
              <Textarea placeholder="Description" value={exp.description} onChange={e => updateArrayField('experience', i, 'description', e.target.value)} className="min-h-[60px]" />
              {resume.experience.length > 1 && (
                <Button size="sm" variant="ghost" onClick={() => removeArrayItem('experience', i)}>
                  <Trash2 className="w-3 h-3 mr-1" /> Remove
                </Button>
              )}
            </div>
          ))}
        </section>

        {/* Projects */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Projects</h3>
            <Button size="sm" variant="ghost" onClick={() => addArrayItem('projects', { name: '', description: '' })}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          {resume.projects.map((proj, i) => (
            <div key={i} className="space-y-2">
              <div className="flex gap-2">
                <Input placeholder="Project name" value={proj.name} onChange={e => updateArrayField('projects', i, 'name', e.target.value)} className="flex-1" />
                {resume.projects.length > 1 && (
                  <Button size="icon" variant="ghost" onClick={() => removeArrayItem('projects', i)}>
                    <Trash2 className="w-3 h-3 text-muted-foreground" />
                  </Button>
                )}
              </div>
              <Textarea placeholder="Brief description" value={proj.description} onChange={e => updateArrayField('projects', i, 'description', e.target.value)} className="min-h-[50px]" />
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
