// ResumeUpload: Upload and list resumes
'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function ResumeUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  const onSubmit = async (data: any) => {
    if (!file) return;
    setUploading(true);
    // TODO: Implement actual upload logic (API call)
    setTimeout(() => {
      setUploading(false);
      setUploaded(true);
      reset();
      setFile(null);
    }, 1500);
  };

  return (
    <Card className="w-full max-w-md p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <h2 className="text-lg font-semibold mb-2">Upload Resume</h2>
        <Input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
        <Button type="submit" disabled={uploading || !file} className="w-full">{uploading ? 'Uploading…' : 'Upload'}</Button>
        {uploaded && <div className="text-green-600 text-center">Upload successful!</div>}
      </form>
      {/* TODO: List of uploaded resumes goes here */}
    </Card>
  );
}
