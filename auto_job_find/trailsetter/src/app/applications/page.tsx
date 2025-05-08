// UI MVP: Applications Page
// Follows Airbnb Style Guide, mobile-first, uses Tailwind, Shadcn UI, TanStack Query, React Hook Form, Zod, Context

'use client';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

const ApplicationSchema = z.object({
  jobUrl: z.string().url({ message: 'Valid job URL required' }),
  resumeId: z.string().min(1, 'Resume required'),
});

type ApplicationForm = z.infer<typeof ApplicationSchema>;

function fetchApplications() {
  return fetch('/api/v1/applications', { credentials: 'include' }).then((res) => res.json());
}

function submitApplication(data: ApplicationForm) {
  return fetch('/api/v1/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  }).then((res) => res.json());
}

export function ApplicationsPage() {
  const { data: applications, refetch, isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: fetchApplications,
  });
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ApplicationForm>({
    resolver: zodResolver(ApplicationSchema),
  });

  const onSubmit = async (formData: ApplicationForm) => {
    setSubmitting(true);
    await submitApplication(formData);
    setSubmitting(false);
    reset();
    refetch();
  };

  return (
    <div className="max-w-md mx-auto py-8 px-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Submit Job Application</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input
              {...register('jobUrl')}
              placeholder="LinkedIn Job URL"
              type="url"
              disabled={submitting}
            />
            {errors.jobUrl && <span className="text-red-500 text-xs">{errors.jobUrl.message}</span>}
            <Input
              {...register('resumeId')}
              placeholder="Resume ID"
              type="text"
              disabled={submitting}
            />
            {errors.resumeId && <span className="text-red-500 text-xs">{errors.resumeId.message}</span>}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-2">Your Applications</h2>
        {isLoading ? (
          <div>Loading...</div>
        ) : (
          <div className="flex flex-col gap-2">
            {applications?.length === 0 && <div>No applications yet.</div>}
            {applications?.map((app: any) => (
              <Card key={app.id} className="shadow-sm">
                <CardContent className="py-2 px-4 flex flex-col gap-1">
                  <span className="font-medium">{app.job?.title || 'Job'}</span>
                  <span className="text-xs text-gray-500 truncate">{app.job?.url}</span>
                  <span className="text-xs">Status: <span className="font-semibold">{app.status}</span></span>
                  {app.errorMessage && <span className="text-xs text-red-500">Error: {app.errorMessage}</span>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ApplicationsPage;
