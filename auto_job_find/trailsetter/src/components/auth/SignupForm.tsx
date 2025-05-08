// SignupForm: User registration form
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  confirmPassword: z.string().min(6),
});

type SignupData = z.infer<typeof signupSchema>;

export function SignupForm() {
  const { register, handleSubmit, formState, watch } = useForm<SignupData>({ resolver: zodResolver(signupSchema) });
  const onSubmit = (data: SignupData) => {
    // TODO: Implement registration logic (API call)
  };
  return (
    <Card className="w-full max-w-md p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <h2 className="text-lg font-semibold mb-2">Sign Up</h2>
        <Input {...register('email')} placeholder="Email" type="email" />
        <Input {...register('password')} placeholder="Password" type="password" />
        <Input {...register('confirmPassword')} placeholder="Confirm Password" type="password" />
        <Button type="submit" className="w-full">Sign Up</Button>
      </form>
    </Card>
  );
}
