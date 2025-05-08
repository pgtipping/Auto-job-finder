// OnboardingForm: Multi-step onboarding for account, LinkedIn, ApplyRight
'use client';
import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const onboardingSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  linkedinUsername: z.string().min(2),
  linkedinPassword: z.string().min(6),
  applyrightToken: z.string().min(10),
});

type OnboardingData = z.infer<typeof onboardingSchema>;

export function OnboardingForm() {
  const [step, setStep] = useState(0);
  const methods = useForm<OnboardingData>({ resolver: zodResolver(onboardingSchema) });
  const onSubmit = methods.handleSubmit((data) => {
    // TODO: API call to save onboarding data
    setStep(3);
  });

  return (
    <Card className="w-full max-w-md p-6">
      <FormProvider {...methods}>
        <form onSubmit={onSubmit} className="space-y-6">
          {step === 0 && (
            <>
              <h2 className="text-lg font-semibold mb-2">Account Info</h2>
              <Input {...methods.register('fullName')} placeholder="Full Name" />
              <Input {...methods.register('email')} placeholder="Email" type="email" />
              <Button type="button" onClick={() => setStep(1)} className="w-full mt-4">Next</Button>
            </>
          )}
          {step === 1 && (
            <>
              <h2 className="text-lg font-semibold mb-2">LinkedIn Credentials</h2>
              <Input {...methods.register('linkedinUsername')} placeholder="LinkedIn Username" />
              <Input {...methods.register('linkedinPassword')} placeholder="LinkedIn Password" type="password" />
              <div className="flex gap-2 mt-4">
                <Button type="button" variant="secondary" onClick={() => setStep(0)}>Back</Button>
                <Button type="button" onClick={() => setStep(2)}>Next</Button>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="text-lg font-semibold mb-2">ApplyRight Connection</h2>
              <Input {...methods.register('applyrightToken')} placeholder="ApplyRight API Token" />
              <div className="flex gap-2 mt-4">
                <Button type="button" variant="secondary" onClick={() => setStep(1)}>Back</Button>
                <Button type="submit">Finish</Button>
              </div>
            </>
          )}
          {step === 3 && (
            <div className="text-center">
              <h2 className="text-lg font-semibold mb-2">Onboarding Complete!</h2>
              <p className="mb-4">You are ready to start using Trailsetter.</p>
              <Button type="button" onClick={() => setStep(0)}>Start Over</Button>
            </div>
          )}
        </form>
      </FormProvider>
    </Card>
  );
}
